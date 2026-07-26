/**
 * PaymentProvider — checkout flow for buying coin packs with real money.
 *
 * ============================ READ THIS FIRST ============================
 * This module deliberately CANNOT take a payment on its own, and that is a
 * security requirement, not a limitation to be "fixed" later.
 *
 * Rules that must hold in any real deployment:
 *
 *  1. The client NEVER holds a PayPal/Stripe secret key. Anything shipped to a
 *     browser is public. Only the publishable/client id may appear here.
 *  2. The client NEVER decides that a payment succeeded. A malicious user can
 *     trivially call `wallet.creditPurchase(...)` from the devtools console.
 *     Coins must only be credited after YOUR SERVER has verified the payment
 *     with the provider (PayPal webhook / order-capture API).
 *  3. Prices are authoritative on the server. The `priceCents` in COIN_PACKS is
 *     for display; the server must re-derive the real price from the pack id so
 *     a tampered client cannot buy 7,000 coins for $0.01.
 *
 * The flow implemented here is the correct one:
 *
 *     client                    your server                 PayPal
 *       │  createCheckout(pack)      │                         │
 *       ├───────────────────────────>│  create order (secret)  │
 *       │                            ├────────────────────────>│
 *       │   { orderRef, approveUrl } │<────────────────────────┤
 *       │<───────────────────────────┤                         │
 *       │  open approveUrl ─────────────────────────────────────>│
 *       │                            │   webhook: captured     │
 *       │                            │<────────────────────────┤
 *       │  confirmCheckout(orderRef) │  (verifies + credits)   │
 *       ├───────────────────────────>│                         │
 *       │   { status, coins }        │                         │
 *       │<───────────────────────────┤                         │
 *
 * Until a backend is wired up, `MockPaymentProvider` is used so the whole
 * marketplace is playable offline. It is clearly labelled in the UI and grants
 * only sandbox coins.
 * ========================================================================
 */
import { CoinPack, CoinPackID } from './CoinEconomy';

export type PaymentMethod = 'paypal' | 'card';

export type CheckoutStatus = 'created' | 'pending' | 'completed' | 'failed' | 'cancelled';

export interface CheckoutSession {
  /** Server-side order reference; the only id the client should trust. */
  orderRef: string;
  packId: CoinPackID;
  method: PaymentMethod;
  status: CheckoutStatus;
  /** URL the player is sent to in order to approve the payment. */
  approveUrl?: string;
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

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  /** True when this provider settles real money. */
  readonly isLive: boolean;
  /** Ask the backend to open a checkout session for a pack. */
  createCheckout(pack: CoinPack, method: PaymentMethod): Promise<CheckoutSession>;
  /** Poll/confirm the session; the backend reports the authoritative outcome. */
  confirmCheckout(session: CheckoutSession): Promise<CheckoutResult>;
}

/* -------------------------------------------------------------------------- */
/*                          Live (backend-backed) provider                     */
/* -------------------------------------------------------------------------- */

export interface ServerPaymentConfig {
  /** Base URL of YOUR backend, e.g. '/api/payments'. Not the provider's API. */
  baseUrl: string;
  /** Optional bearer token for the signed-in player. */
  authToken?: string;
}

/**
 * Talks to your own backend, which in turn talks to PayPal with the secret key.
 * Drop this in once `server/` exposes the two endpoints below.
 */
export class ServerPaymentProvider implements PaymentProvider {
  readonly id = 'server';
  readonly label = 'PayPal / Card';
  readonly isLive = true;

  constructor(private readonly config: ServerPaymentConfig) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.authToken) headers.Authorization = `Bearer ${this.config.authToken}`;
    return headers;
  }

  async createCheckout(pack: CoinPack, method: PaymentMethod): Promise<CheckoutSession> {
    // NOTE: only the pack *id* is sent. The server re-derives the price so a
    // tampered client cannot dictate what it pays.
    const response = await fetch(`${this.config.baseUrl}/checkout`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ packId: pack.id, method }),
    });
    if (!response.ok) {
      return {
        orderRef: '',
        packId: pack.id,
        method,
        status: 'failed',
        error: `Checkout could not be started (HTTP ${response.status}).`,
      };
    }
    return (await response.json()) as CheckoutSession;
  }

  async confirmCheckout(session: CheckoutSession): Promise<CheckoutResult> {
    const response = await fetch(
      `${this.config.baseUrl}/checkout/${encodeURIComponent(session.orderRef)}`,
      { headers: this.headers() }
    );
    if (!response.ok) {
      return {
        status: 'failed',
        orderRef: session.orderRef,
        coinsCredited: 0,
        error: `Could not confirm payment (HTTP ${response.status}).`,
      };
    }
    return (await response.json()) as CheckoutResult;
  }
}

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

/**
 * Chooses the provider for this build. Set `VITE_PAYMENTS_BASE_URL` to enable
 * real checkout; otherwise the sandbox provider keeps everything playable.
 */
export function createPaymentProvider(): PaymentProvider {
  const baseUrl = readEnv('VITE_PAYMENTS_BASE_URL');
  if (baseUrl) {
    return new ServerPaymentProvider({ baseUrl });
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
