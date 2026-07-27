/**
 * PaymentProvider — checkout flow for buying coin packs with real money.
 *
 * ============================ HOW THIS WORKS =============================
 * The client CANNOT take a payment on its own, and that is a security
 * property, not a gap. Rules that hold in every deployment:
 *
 *  1. The client never holds a PayPal secret. Only the public client id may
 *     ever reach a browser.
 *  2. The client never decides that a payment succeeded — otherwise a player
 *     could call `wallet.creditPurchase(...)` from devtools. Coins are
 *     credited only after the SERVER has captured the order with PayPal.
 *  3. Prices are authoritative on the server. `priceCents` here is for display
 *     only; `server/src/payments` re-derives the real charge from the pack id
 *     via the shared table, so a tampered client cannot buy 7,000 coins for 1¢.
 *
 * The implemented flow:
 *
 *     client                    EAOIN server                PayPal
 *       │  createCheckout(pack)      │                         │
 *       ├───────────────────────────>│  create order (secret)  │
 *       │                            ├────────────────────────>│
 *       │   { orderRef, approveUrl } │<────────────────────────┤
 *       │<───────────────────────────┤                         │
 *       │  open approveUrl ────────── buyer approves ─────────>│
 *       │                            │   webhook: captured     │
 *       │                            │<────────────────────────┤
 *       │  confirmCheckout(orderRef) │  (captures + credits)   │
 *       ├───────────────────────────>│                         │
 *       │   { status, coins }        │                         │
 *       │<───────────────────────────┤                         │
 *
 * `PayPalPaymentProvider` drives that. When no backend is configured,
 * `MockPaymentProvider` keeps the marketplace playable offline and says so
 * plainly in the UI.
 * ========================================================================
 */
import { CoinPack, CoinPackID } from './CoinEconomy';

export type PaymentMethod = 'paypal' | 'card';

export type CheckoutStatus = 'created' | 'approved' | 'pending' | 'completed' | 'failed' | 'cancelled';

export interface CheckoutSession {
  /** Server-side order reference; the only id the client should trust. */
  orderRef: string;
  packId: CoinPackID;
  method: PaymentMethod;
  status: CheckoutStatus;
  /** URL the player is sent to in order to approve the payment. */
  approveUrl?: string;
  /** Amount the server says it will charge, in cents. Display only. */
  amountCents?: number;
  currency?: string;
  /** Human-readable failure reason when status is 'failed'. */
  error?: string;
}

export interface CheckoutResult {
  status: CheckoutStatus;
  orderRef: string;
  /** Coins the SERVER says were credited. Never computed on the client. */
  coinsCredited: number;
  error?: string;
}

/** Progress callbacks so the UI can narrate a multi-second PayPal round trip. */
export interface CheckoutProgress {
  onStatus?: (message: string) => void;
}

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  /** True when this provider settles real money. */
  readonly isLive: boolean;
  /** Ask the backend to open a checkout session for a pack. */
  createCheckout(pack: CoinPack, method: PaymentMethod): Promise<CheckoutSession>;
  /** Poll/confirm the session; the backend reports the authoritative outcome. */
  confirmCheckout(session: CheckoutSession, progress?: CheckoutProgress): Promise<CheckoutResult>;
}

/* -------------------------------------------------------------------------- */
/*                        Live PayPal (backend-backed)                         */
/* -------------------------------------------------------------------------- */

export interface ServerPaymentConfig {
  /** Base URL of YOUR backend, e.g. '/api/payments'. Not PayPal's API. */
  baseUrl: string;
  /** Bearer token for the signed-in player. */
  authToken?: string;
  /** How long to wait for the buyer to finish approving, in ms. */
  approvalTimeoutMs?: number;
  /** Gap between confirm polls, in ms. */
  pollIntervalMs?: number;
}

/**
 * Talks to the EAOIN backend, which in turn talks to PayPal with the secret.
 *
 * Confirmation is a poll loop rather than a single request because the buyer
 * approves in a separate window on paypal.com; the order isn't capturable
 * until they finish, and the webhook may land first.
 */
export class PayPalPaymentProvider implements PaymentProvider {
  readonly id = 'paypal';
  readonly label = 'PayPal';
  readonly isLive = true;

  constructor(private readonly config: ServerPaymentConfig) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.authToken) headers.Authorization = `Bearer ${this.config.authToken}`;
    return headers;
  }

  async createCheckout(pack: CoinPack, method: PaymentMethod): Promise<CheckoutSession> {
    try {
      // Only the pack *id* is sent. The server re-derives the price.
      const response = await fetch(`${this.config.baseUrl}/checkout`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ packId: pack.id, method }),
      });
      const body = (await response.json().catch(() => null)) as (CheckoutSession & { error?: string }) | null;

      if (!response.ok || !body || !body.orderRef) {
        return {
          orderRef: '',
          packId: pack.id,
          method,
          status: 'failed',
          error: body?.error ?? `Checkout could not be started (HTTP ${response.status}).`,
        };
      }
      return { ...body, packId: pack.id, method };
    } catch (error) {
      return {
        orderRef: '',
        packId: pack.id,
        method,
        status: 'failed',
        error: `Could not reach the payment server: ${errorText(error)}`,
      };
    }
  }

  async confirmCheckout(session: CheckoutSession, progress?: CheckoutProgress): Promise<CheckoutResult> {
    const timeoutMs = this.config.approvalTimeoutMs ?? 5 * 60_000;
    const intervalMs = this.config.pollIntervalMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;
    let announcedWait = false;

    while (Date.now() < deadline) {
      const attempt = await this.pollOnce(session.orderRef);

      if (attempt.status === 'completed' || attempt.status === 'failed' || attempt.status === 'cancelled') {
        return attempt;
      }

      if (!announcedWait) {
        announcedWait = true;
        progress?.onStatus?.('Waiting for you to approve the payment in the PayPal window…');
      }
      await delay(intervalMs);
    }

    return {
      status: 'pending',
      orderRef: session.orderRef,
      coinsCredited: 0,
      error: 'Timed out waiting for PayPal approval. If you completed the payment, your coins will appear shortly.',
    };
  }

  private async pollOnce(orderRef: string): Promise<CheckoutResult> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/checkout/${encodeURIComponent(orderRef)}`,
        { headers: this.headers() }
      );
      const body = (await response.json().catch(() => null)) as (CheckoutResult & { error?: string }) | null;

      if (!response.ok || !body) {
        return {
          status: 'failed',
          orderRef,
          coinsCredited: 0,
          error: body?.error ?? `Could not confirm payment (HTTP ${response.status}).`,
        };
      }
      // An un-approved order comes back as 'created'/'approved'; keep polling.
      return { ...body, orderRef };
    } catch (error) {
      // A transient network blip should not abort a payment that may have
      // succeeded — report it as still pending and let the loop retry.
      return { status: 'pending', orderRef, coinsCredited: 0, error: errorText(error) };
    }
  }
}

/** Kept as an alias so older imports keep working. */
export const ServerPaymentProvider = PayPalPaymentProvider;

/* -------------------------------------------------------------------------- */
/*                          Mock (offline sandbox) provider                    */
/* -------------------------------------------------------------------------- */

/**
 * Offline stand-in so the marketplace is fully playable without a backend.
 * Grants sandbox coins only — no money moves.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock';
  readonly label = 'Sandbox Checkout';
  readonly isLive = false;

  /** Simulated network latency in ms; 0 in tests. */
  constructor(private readonly latencyMs = 900) {}

  async createCheckout(pack: CoinPack, method: PaymentMethod): Promise<CheckoutSession> {
    await delay(this.latencyMs * 0.4);
    return {
      orderRef: `sandbox_${pack.id}_${Date.now().toString(36)}`,
      packId: pack.id,
      method,
      status: 'pending',
      amountCents: pack.priceCents,
      currency: 'USD',
      approveUrl: undefined, // nothing to approve in the sandbox
    };
  }

  async confirmCheckout(session: CheckoutSession): Promise<CheckoutResult> {
    await delay(this.latencyMs);
    return {
      status: 'completed',
      orderRef: session.orderRef,
      // The caller looks the coin count up from the pack id; the sandbox simply
      // reports success. Real providers return the server-authoritative amount.
      coinsCredited: -1,
    };
  }
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Chooses the provider for this build.
 *
 * Set `VITE_PAYMENTS_BASE_URL` (e.g. `/api/payments`) to enable real PayPal
 * checkout; otherwise the sandbox provider keeps everything playable and the
 * UI labels itself as such.
 */
export function createPaymentProvider(authToken?: string): PaymentProvider {
  const baseUrl = readEnv('VITE_PAYMENTS_BASE_URL');
  if (baseUrl) {
    return new PayPalPaymentProvider({ baseUrl, authToken });
  }
  return new MockPaymentProvider();
}

function readEnv(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    const value = env?.[key];
    return value && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
