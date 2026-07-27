/**
 * PayPalClient — a real PayPal Orders v2 + webhook-verification client.
 *
 * This is the only place in the codebase that holds the PayPal secret, and it
 * only ever runs on the server. Nothing here is ever bundled into the browser.
 *
 * What it does, for real:
 *   - OAuth2 client-credentials token exchange, with token caching + refresh.
 *   - `POST /v2/checkout/orders`   — create an order for a fixed pack price.
 *   - `POST /v2/checkout/orders/{id}/capture` — take the money.
 *   - `GET  /v2/checkout/orders/{id}`         — read authoritative status.
 *   - `POST /v1/notifications/verify-webhook-signature` — prove a webhook
 *     really came from PayPal before crediting anything.
 *
 * Sandbox vs live is chosen purely by `PAYPAL_ENV`. There is no code path that
 * credits coins without a `COMPLETED` capture confirmed by PayPal itself.
 */

export type PayPalEnvironment = 'sandbox' | 'live';

const API_BASE: Record<PayPalEnvironment, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
  /** Webhook id from the PayPal developer dashboard; required to verify events. */
  webhookId?: string;
  /** Where PayPal sends the buyer after approving / cancelling. */
  returnUrl: string;
  cancelUrl: string;
  /** Shown on the buyer's PayPal receipt. Max 127 chars. */
  brandName?: string;
}

export interface CreatedOrder {
  id: string;
  status: string;
  /** The URL the buyer must visit to approve the payment. */
  approveUrl?: string;
}

export interface CapturedOrder {
  id: string;
  status: string;
  /** Gross amount actually captured, in integer cents. */
  amountCents: number;
  currency: string;
  captureId?: string;
  payerEmail?: string;
}

export class PayPalError extends Error {
  constructor(message: string, readonly status?: number, readonly detail?: unknown) {
    super(message);
    this.name = 'PayPalError';
  }
}

interface CachedToken {
  accessToken: string;
  /** Epoch ms after which the token must be refreshed. */
  expiresAt: number;
}

/** Minimal shape of the parts of a PayPal order we actually read. */
interface PayPalOrderResponse {
  id?: string;
  status?: string;
  links?: Array<{ rel?: string; href?: string }>;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { value?: string; currency_code?: string };
      }>;
    };
  }>;
  payer?: { email_address?: string };
}

export class PayPalClient {
  private token: CachedToken | null = null;

  constructor(private readonly config: PayPalConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new PayPalError('PayPal client id and secret are required.');
    }
  }

  get environment(): PayPalEnvironment {
    return this.config.environment;
  }

  get isLive(): boolean {
    return this.config.environment === 'live';
  }

  private get baseUrl(): string {
    return API_BASE[this.config.environment];
  }

  /**
   * Client-credentials OAuth2. Tokens last ~9 hours; we refresh a minute early
   * so a long-running server never uses one that expires mid-request.
   */
  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.accessToken;

    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new PayPalError(
        `PayPal token request failed (HTTP ${response.status}).`,
        response.status,
        await safeJson(response)
      );
    }

    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new PayPalError('PayPal returned no access token.');

    const ttlSeconds = typeof body.expires_in === 'number' ? body.expires_in : 300;
    this.token = {
      accessToken: body.access_token,
      expiresAt: Date.now() + Math.max(30, ttlSeconds - 60) * 1000,
    };
    return this.token.accessToken;
  }

  private async request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
    const token = await this.accessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    // PayPal de-duplicates retried order creations by this key, which stops a
    // double-clicked buy button from opening two orders.
    if (init.idempotencyKey) headers['PayPal-Request-Id'] = init.idempotencyKey;

    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const payload = await safeJson(response);

    if (!response.ok) {
      const detail = extractPayPalMessage(payload) ?? `HTTP ${response.status}`;
      throw new PayPalError(`PayPal ${path} failed: ${detail}`, response.status, payload);
    }
    return payload as T;
  }

  /**
   * Create an order for an exact amount. The caller derives `amountCents` from
   * the server-side pack table — never from client input.
   */
  async createOrder(params: {
    amountCents: number;
    currency: string;
    referenceId: string;
    description: string;
    idempotencyKey?: string;
  }): Promise<CreatedOrder> {
    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.referenceId,
          description: params.description.slice(0, 127),
          amount: {
            currency_code: params.currency,
            value: centsToDecimal(params.amountCents),
          },
        },
      ],
      application_context: {
        brand_name: (this.config.brandName ?? 'EAOIN').slice(0, 127),
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: this.config.returnUrl,
        cancel_url: this.config.cancelUrl,
      },
    };

    const order = await this.request<PayPalOrderResponse>('/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey: params.idempotencyKey,
    });

    if (!order.id) throw new PayPalError('PayPal created an order with no id.');

    return {
      id: order.id,
      status: order.status ?? 'CREATED',
      approveUrl: order.links?.find((link) => link.rel === 'approve' || link.rel === 'payer-action')?.href,
    };
  }

  /** Read an order's authoritative current state. */
  async getOrder(orderId: string): Promise<CapturedOrder> {
    const order = await this.request<PayPalOrderResponse>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      { method: 'GET' }
    );
    return summarize(order, orderId);
  }

  /**
   * Capture an approved order — this is the call that actually moves money.
   *
   * PayPal returns 422 `ORDER_ALREADY_CAPTURED` when a webhook beat us to it.
   * That is a success from our side, so we fall back to reading the order.
   */
  async captureOrder(orderId: string, idempotencyKey?: string): Promise<CapturedOrder> {
    try {
      const order = await this.request<PayPalOrderResponse>(
        `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        { method: 'POST', body: '{}', idempotencyKey }
      );
      return summarize(order, orderId);
    } catch (error) {
      if (error instanceof PayPalError && isAlreadyCaptured(error.detail)) {
        return this.getOrder(orderId);
      }
      throw error;
    }
  }

  /**
   * Verify a webhook really came from PayPal.
   *
   * Without this, anyone who learns the webhook URL could POST a fake
   * "payment completed" event and mint themselves coins. Returns false when no
   * webhook id is configured, so an unconfigured deployment fails closed.
   */
  async verifyWebhookSignature(headers: Record<string, string | undefined>, rawBody: string): Promise<boolean> {
    if (!this.config.webhookId) return false;

    const required = {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
    };
    if (Object.values(required).some((value) => !value)) return false;

    let parsedEvent: unknown;
    try {
      parsedEvent = JSON.parse(rawBody);
    } catch {
      return false;
    }

    try {
      const result = await this.request<{ verification_status?: string }>(
        '/v1/notifications/verify-webhook-signature',
        {
          method: 'POST',
          body: JSON.stringify({ ...required, webhook_id: this.config.webhookId, webhook_event: parsedEvent }),
        }
      );
      return result.verification_status === 'SUCCESS';
    } catch {
      // A verification failure must never be treated as a pass.
      return false;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                   helpers                                   */
/* -------------------------------------------------------------------------- */

function summarize(order: PayPalOrderResponse, fallbackId: string): CapturedOrder {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  const value = capture?.amount?.value;
  return {
    id: order.id ?? fallbackId,
    status: capture?.status ?? order.status ?? 'UNKNOWN',
    amountCents: value ? decimalToCents(value) : 0,
    currency: capture?.amount?.currency_code ?? 'USD',
    captureId: capture?.id,
    payerEmail: order.payer?.email_address,
  };
}

/** "19.00" → 1900, without ever touching floating-point rounding. */
export function decimalToCents(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return 0;
  const whole = Number.parseInt(match[1], 10);
  const fraction = Number.parseInt((match[2] ?? '0').padEnd(2, '0'), 10);
  return whole * 100 + fraction;
}

/** 1900 → "19.00". */
export function centsToDecimal(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  return `${Math.floor(safe / 100)}.${(safe % 100).toString().padStart(2, '0')}`;
}

function isAlreadyCaptured(detail: unknown): boolean {
  if (!detail || typeof detail !== 'object') return false;
  const body = detail as { details?: Array<{ issue?: string }>; name?: string };
  if (body.name === 'UNPROCESSABLE_ENTITY') {
    return Boolean(body.details?.some((entry) => entry.issue === 'ORDER_ALREADY_CAPTURED'));
  }
  return false;
}

function extractPayPalMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const body = payload as { message?: string; details?: Array<{ description?: string; issue?: string }> };
  const first = body.details?.[0];
  return first?.description ?? first?.issue ?? body.message;
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export default PayPalClient;
