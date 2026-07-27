/**
 * PaymentService — server-authoritative coin purchasing.
 *
 * This is the component that decides whether a player gets coins. The rules it
 * enforces, all of which the client is structurally unable to bypass:
 *
 *  1. **The server prices the order.** The client sends only a pack id. The
 *     amount charged is looked up from the shared pack table, so a tampered
 *     request cannot buy 7,000 coins for one cent.
 *  2. **Coins are credited only on a PayPal `COMPLETED` capture.** Not on
 *     "order created", not on the buyer returning to the site.
 *  3. **The captured amount must equal the expected amount.** A capture for
 *     the wrong currency or a short amount is rejected and flagged.
 *  4. **Crediting is idempotent.** A capture id is credited exactly once, even
 *     if the webhook and the client's confirm call race each other — which in
 *     practice they always do.
 *
 * Order records are held behind a small `PaymentStore` interface. The default
 * is in-memory (fine for a single game server); swap in Postgres/Redis for a
 * multi-instance deployment without touching this file.
 */
import { randomUUID } from 'crypto';
import {
  COIN_CURRENCY,
  CoinPack,
  CoinPackID,
  getCoinPack,
  isCoinPackID,
} from '../../../shared/src/economy/CoinPacks';
import { CapturedOrder, PayPalClient, PayPalError } from './PayPalClient';

export type OrderStatus = 'created' | 'approved' | 'completed' | 'failed' | 'cancelled';

export interface PaymentOrder {
  /** Our reference, also used as PayPal's `reference_id`. */
  orderRef: string;
  /** PayPal's order id. */
  providerOrderId: string;
  packId: CoinPackID;
  /** Price the SERVER decided on, in integer cents. */
  amountCents: number;
  currency: string;
  /** Coins the SERVER will credit on capture. */
  coins: number;
  status: OrderStatus;
  /** Player this order belongs to; only they may confirm it. */
  playerId: string;
  createdAt: number;
  updatedAt: number;
  /** Set once money has actually moved. */
  captureId?: string;
  /** True after coins have been added to the ledger. Prevents double-credit. */
  credited: boolean;
  error?: string;
}

export interface PaymentStore {
  get(orderRef: string): PaymentOrder | undefined;
  findByProviderOrderId(providerOrderId: string): PaymentOrder | undefined;
  save(order: PaymentOrder): void;
  /** Total coins ever credited to a player. */
  creditedCoins(playerId: string): number;
}

/** Default single-process store. Replace for horizontally scaled deployments. */
export class InMemoryPaymentStore implements PaymentStore {
  private readonly byRef = new Map<string, PaymentOrder>();
  private readonly byProviderId = new Map<string, string>();
  private readonly credited = new Map<string, number>();

  get(orderRef: string): PaymentOrder | undefined {
    return this.byRef.get(orderRef);
  }

  findByProviderOrderId(providerOrderId: string): PaymentOrder | undefined {
    const ref = this.byProviderId.get(providerOrderId);
    return ref ? this.byRef.get(ref) : undefined;
  }

  save(order: PaymentOrder): void {
    this.byRef.set(order.orderRef, order);
    if (order.providerOrderId) this.byProviderId.set(order.providerOrderId, order.orderRef);
    if (order.credited) {
      this.credited.set(order.playerId, (this.credited.get(order.playerId) ?? 0) + 0);
    }
  }

  creditedCoins(playerId: string): number {
    return this.credited.get(playerId) ?? 0;
  }

  addCredit(playerId: string, coins: number): void {
    this.credited.set(playerId, (this.credited.get(playerId) ?? 0) + coins);
  }
}

export interface CheckoutSessionDTO {
  orderRef: string;
  packId: CoinPackID;
  method: 'paypal';
  status: OrderStatus;
  approveUrl?: string;
  /** Display-only; the charge is already fixed server-side. */
  amountCents: number;
  currency: string;
  error?: string;
}

export interface CheckoutResultDTO {
  status: OrderStatus;
  orderRef: string;
  /** Coins the SERVER credited. The client must trust only this number. */
  coinsCredited: number;
  /** Running server-side total, so the client can reconcile a lost response. */
  balanceHint?: number;
  error?: string;
}

/** Called when a purchase settles, so the host app can persist the coins. */
export type CreditHandler = (event: {
  playerId: string;
  coins: number;
  orderRef: string;
  captureId: string;
  amountCents: number;
}) => void;

export class PaymentService {
  private onCredit: CreditHandler | null = null;

  constructor(
    private readonly paypal: PayPalClient,
    private readonly store: PaymentStore = new InMemoryPaymentStore()
  ) {}

  /** Register the callback that persists credited coins. */
  setCreditHandler(handler: CreditHandler | null): void {
    this.onCredit = handler;
  }

  /**
   * Start a checkout. The only client-supplied value that matters is `packId`,
   * and it is validated against the shared table before anything else happens.
   */
  async createCheckout(playerId: string, packIdInput: unknown): Promise<CheckoutSessionDTO> {
    if (!isCoinPackID(packIdInput)) {
      throw new PaymentValidationError('Unknown coin pack.');
    }
    const pack = getCoinPack(packIdInput) as CoinPack;

    const orderRef = `eaoin_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;

    try {
      const created = await this.paypal.createOrder({
        // Price comes from the server table, never from the request body.
        amountCents: pack.priceCents,
        currency: COIN_CURRENCY,
        referenceId: orderRef,
        description: `${pack.label} — ${pack.coins.toLocaleString()} EAOIN coins`,
        idempotencyKey: orderRef,
      });

      const order: PaymentOrder = {
        orderRef,
        providerOrderId: created.id,
        packId: pack.id,
        amountCents: pack.priceCents,
        currency: COIN_CURRENCY,
        coins: pack.coins,
        status: 'created',
        playerId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        credited: false,
      };
      this.store.save(order);

      return {
        orderRef,
        packId: pack.id,
        method: 'paypal',
        status: 'created',
        approveUrl: created.approveUrl,
        amountCents: pack.priceCents,
        currency: COIN_CURRENCY,
      };
    } catch (error) {
      const message = error instanceof PayPalError ? error.message : 'Checkout could not be started.';
      return {
        orderRef,
        packId: pack.id,
        method: 'paypal',
        status: 'failed',
        amountCents: pack.priceCents,
        currency: COIN_CURRENCY,
        error: message,
      };
    }
  }

  /**
   * Called when the buyer returns from PayPal. Captures the order if it has
   * been approved, then credits coins exactly once.
   */
  async confirmCheckout(playerId: string, orderRef: string): Promise<CheckoutResultDTO> {
    const order = this.store.get(orderRef);
    if (!order) {
      return { status: 'failed', orderRef, coinsCredited: 0, error: 'Unknown order.' };
    }
    // An order belongs to exactly one player. Without this check, any signed-in
    // user could confirm somebody else's paid order and take the coins.
    if (order.playerId !== playerId) {
      return { status: 'failed', orderRef, coinsCredited: 0, error: 'Order does not belong to this player.' };
    }
    if (order.credited) {
      // Idempotent replay: report success without crediting a second time.
      return { status: 'completed', orderRef, coinsCredited: order.coins };
    }

    try {
      const captured = await this.paypal.captureOrder(order.providerOrderId, `${orderRef}_capture`);
      return this.settle(order, captured);
    } catch (error) {
      const message = error instanceof PayPalError ? error.message : String(error);
      order.status = 'failed';
      order.error = message;
      order.updatedAt = Date.now();
      this.store.save(order);
      return { status: 'failed', orderRef, coinsCredited: 0, error: message };
    }
  }

  /**
   * Handle a verified PayPal webhook. The caller MUST have already checked the
   * signature — this method assumes authenticity and acts on it.
   */
  async handleWebhookEvent(event: { event_type?: string; resource?: unknown }): Promise<void> {
    const type = event.event_type;
    if (!type) return;

    const resource = (event.resource ?? {}) as {
      id?: string;
      status?: string;
      amount?: { value?: string; currency_code?: string };
      supplementary_data?: { related_ids?: { order_id?: string } };
    };

    const providerOrderId = resource.supplementary_data?.related_ids?.order_id ?? resource.id;
    if (!providerOrderId) return;

    const order = this.store.findByProviderOrderId(providerOrderId);
    if (!order) return;

    if (type === 'PAYMENT.CAPTURE.COMPLETED' || type === 'CHECKOUT.ORDER.APPROVED') {
      // Re-read from PayPal rather than trusting the amounts in the event body.
      const authoritative = await this.paypal.getOrder(order.providerOrderId);
      if (authoritative.status === 'COMPLETED') this.settle(order, authoritative);
      else if (type === 'CHECKOUT.ORDER.APPROVED') {
        const captured = await this.paypal.captureOrder(order.providerOrderId, `${order.orderRef}_capture`);
        this.settle(order, captured);
      }
      return;
    }

    if (type === 'PAYMENT.CAPTURE.DENIED' || type === 'PAYMENT.CAPTURE.REVERSED' || type === 'PAYMENT.CAPTURE.REFUNDED') {
      order.status = 'failed';
      order.error = `PayPal reported ${type}.`;
      order.updatedAt = Date.now();
      this.store.save(order);
    }
  }

  /** Read-only view for the confirm endpoint and for support tooling. */
  getOrder(orderRef: string): PaymentOrder | undefined {
    return this.store.get(orderRef);
  }

  /**
   * Apply a capture to an order. This is the single credit path; every route
   * into "the player gets coins" funnels through here.
   */
  private settle(order: PaymentOrder, captured: CapturedOrder): CheckoutResultDTO {
    if (captured.status !== 'COMPLETED') {
      order.status = captured.status === 'VOIDED' ? 'cancelled' : 'approved';
      order.updatedAt = Date.now();
      this.store.save(order);
      return {
        status: order.status,
        orderRef: order.orderRef,
        coinsCredited: 0,
        error: `Payment is ${captured.status.toLowerCase()}; no coins were added.`,
      };
    }

    // Guard against a capture that does not match what we asked to be paid.
    if (captured.currency !== order.currency || captured.amountCents < order.amountCents) {
      order.status = 'failed';
      order.error = `Captured ${captured.amountCents} ${captured.currency}, expected ${order.amountCents} ${order.currency}.`;
      order.updatedAt = Date.now();
      this.store.save(order);
      return { status: 'failed', orderRef: order.orderRef, coinsCredited: 0, error: order.error };
    }

    if (order.credited) {
      return { status: 'completed', orderRef: order.orderRef, coinsCredited: order.coins };
    }

    order.status = 'completed';
    order.captureId = captured.captureId;
    order.credited = true;
    order.updatedAt = Date.now();
    order.error = undefined;
    this.store.save(order);

    if (this.store instanceof InMemoryPaymentStore) {
      this.store.addCredit(order.playerId, order.coins);
    }

    this.onCredit?.({
      playerId: order.playerId,
      coins: order.coins,
      orderRef: order.orderRef,
      captureId: captured.captureId ?? '',
      amountCents: captured.amountCents,
    });

    return {
      status: 'completed',
      orderRef: order.orderRef,
      coinsCredited: order.coins,
      balanceHint: this.store.creditedCoins(order.playerId),
    };
  }
}

export class PaymentValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

export default PaymentService;
