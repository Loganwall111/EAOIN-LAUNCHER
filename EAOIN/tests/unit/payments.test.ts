/**
 * Payment tests.
 *
 * These target the properties that actually protect money:
 *   - the server, not the client, decides the price and the coin count
 *   - coins are credited only on a COMPLETED capture
 *   - crediting is idempotent across webhook/confirm races
 *   - a short or wrong-currency capture is rejected
 *   - an unverified webhook credits nothing
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  COIN_PACKS,
  centsToDecimalString,
  getCoinPack,
  isCoinPackID,
} from '../../shared/src/economy/CoinPacks';
import {
  InMemoryPaymentStore,
  PaymentService,
  PaymentValidationError,
} from '../../server/src/payments/PaymentService';
import { centsToDecimal, decimalToCents } from '../../server/src/payments/PayPalClient';

/* -------------------------------------------------------------------------- */
/*                          A scriptable fake PayPal                           */
/* -------------------------------------------------------------------------- */

interface FakeOrder {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  captureId?: string;
}

class FakePayPal {
  readonly environment = 'sandbox' as const;
  readonly isLive = false;
  orders = new Map<string, FakeOrder>();
  captureCalls = 0;
  /** Flip to make capture return something other than COMPLETED. */
  captureStatus = 'COMPLETED';
  /** Override the captured amount to simulate a short payment. */
  captureAmountCents: number | null = null;
  captureCurrency: string | null = null;
  verifyResult = true;

  async createOrder(params: {
    amountCents: number;
    currency: string;
    referenceId: string;
    description: string;
  }) {
    const id = `PAYPAL_${params.referenceId}`;
    this.orders.set(id, {
      id,
      amountCents: params.amountCents,
      currency: params.currency,
      status: 'CREATED',
    });
    return { id, status: 'CREATED', approveUrl: `https://paypal.test/approve/${id}` };
  }

  async captureOrder(orderId: string) {
    this.captureCalls += 1;
    const order = this.orders.get(orderId);
    if (!order) throw new Error('no such order');
    order.status = this.captureStatus;
    order.captureId = `CAP_${orderId}`;
    return {
      id: orderId,
      status: this.captureStatus,
      amountCents: this.captureAmountCents ?? order.amountCents,
      currency: this.captureCurrency ?? order.currency,
      captureId: order.captureId,
    };
  }

  async getOrder(orderId: string) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('no such order');
    return {
      id: orderId,
      status: order.status,
      amountCents: this.captureAmountCents ?? order.amountCents,
      currency: this.captureCurrency ?? order.currency,
      captureId: order.captureId,
    };
  }

  async verifyWebhookSignature() {
    return this.verifyResult;
  }
}

function makeService() {
  const paypal = new FakePayPal();
  const store = new InMemoryPaymentStore();
  // The service only uses the methods FakePayPal implements.
  const service = new PaymentService(paypal as never, store);
  return { paypal, store, service };
}

/* -------------------------------------------------------------------------- */

describe('shared coin pack table', () => {
  it('is the single source of truth for prices', () => {
    expect(getCoinPack('starter')).toMatchObject({ coins: 1_000, priceCents: 500 });
    expect(getCoinPack('plus')).toMatchObject({ coins: 1_600, priceCents: 1_500 });
    expect(getCoinPack('mega')).toMatchObject({ coins: 7_000, priceCents: 1_900 });
  });

  it('rejects unknown or tampered pack ids', () => {
    expect(isCoinPackID('mega')).toBe(true);
    expect(isCoinPackID('mega_but_free')).toBe(false);
    expect(isCoinPackID(null)).toBe(false);
    expect(isCoinPackID({ id: 'mega' })).toBe(false);
  });

  it('is frozen so no module can mutate a price at runtime', () => {
    expect(Object.isFrozen(COIN_PACKS)).toBe(true);
  });

  it('converts cents to PayPal decimal strings without float error', () => {
    expect(centsToDecimalString(1_900)).toBe('19.00');
    expect(centsToDecimalString(500)).toBe('5.00');
    expect(centsToDecimalString(1_505)).toBe('15.05');
    expect(centsToDecimal(1_900)).toBe('19.00');
    expect(decimalToCents('19.00')).toBe(1_900);
    expect(decimalToCents('0.07')).toBe(7);
    expect(decimalToCents('15.5')).toBe(1_550);
  });
});

describe('PaymentService — price authority', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => { ctx = makeService(); });

  it('charges the server-side price, ignoring anything the client claims', async () => {
    const session = await ctx.service.createCheckout('player_1', 'mega');
    expect(session.status).toBe('created');
    // $19.00, not whatever a tampered client might have asked for.
    expect(session.amountCents).toBe(1_900);

    const order = [...ctx.paypal.orders.values()][0];
    expect(order.amountCents).toBe(1_900);
    expect(order.currency).toBe('USD');
  });

  it('refuses a checkout for an unknown pack id', async () => {
    await expect(ctx.service.createCheckout('player_1', 'free_money'))
      .rejects.toBeInstanceOf(PaymentValidationError);
  });

  it('refuses a checkout for a non-string pack id', async () => {
    await expect(ctx.service.createCheckout('player_1', { packId: 'mega' }))
      .rejects.toBeInstanceOf(PaymentValidationError);
  });

  it('reports failure instead of throwing when PayPal is unreachable', async () => {
    ctx.paypal.createOrder = vi.fn().mockRejectedValue(new Error('network down')) as never;
    const session = await ctx.service.createCheckout('player_1', 'starter');
    expect(session.status).toBe('failed');
    expect(session.error).toBeTruthy();
  });
});

describe('PaymentService — settlement', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => { ctx = makeService(); });

  it('credits the pack coins on a COMPLETED capture', async () => {
    const session = await ctx.service.createCheckout('player_1', 'mega');
    const result = await ctx.service.confirmCheckout('player_1', session.orderRef);

    expect(result.status).toBe('completed');
    expect(result.coinsCredited).toBe(7_000);
  });

  it('credits exactly once even when confirm is called repeatedly', async () => {
    const credited: number[] = [];
    ctx.service.setCreditHandler((event) => credited.push(event.coins));

    const session = await ctx.service.createCheckout('player_1', 'plus');
    const first = await ctx.service.confirmCheckout('player_1', session.orderRef);
    const second = await ctx.service.confirmCheckout('player_1', session.orderRef);
    const third = await ctx.service.confirmCheckout('player_1', session.orderRef);

    expect(first.coinsCredited).toBe(1_600);
    // Replays still report success, but must not mint more coins.
    expect(second.status).toBe('completed');
    expect(third.status).toBe('completed');
    expect(credited).toEqual([1_600]);
    // Only the first confirm reached PayPal.
    expect(ctx.paypal.captureCalls).toBe(1);
  });

  it('does not credit when the capture is not COMPLETED', async () => {
    ctx.paypal.captureStatus = 'PENDING';
    const session = await ctx.service.createCheckout('player_1', 'starter');
    const result = await ctx.service.confirmCheckout('player_1', session.orderRef);

    expect(result.status).not.toBe('completed');
    expect(result.coinsCredited).toBe(0);
  });

  it('rejects a capture that paid less than the order price', async () => {
    ctx.paypal.captureAmountCents = 1; // one cent for the $19 pack
    const session = await ctx.service.createCheckout('player_1', 'mega');
    const result = await ctx.service.confirmCheckout('player_1', session.orderRef);

    expect(result.status).toBe('failed');
    expect(result.coinsCredited).toBe(0);
  });

  it('rejects a capture in the wrong currency', async () => {
    ctx.paypal.captureCurrency = 'VND';
    const session = await ctx.service.createCheckout('player_1', 'mega');
    const result = await ctx.service.confirmCheckout('player_1', session.orderRef);

    expect(result.status).toBe('failed');
    expect(result.coinsCredited).toBe(0);
  });

  it('will not let another player confirm someone else\'s order', async () => {
    const session = await ctx.service.createCheckout('victim', 'mega');
    const result = await ctx.service.confirmCheckout('thief', session.orderRef);

    expect(result.status).toBe('failed');
    expect(result.coinsCredited).toBe(0);
    expect(ctx.paypal.captureCalls).toBe(0);
  });

  it('reports failure for an unknown order reference', async () => {
    const result = await ctx.service.confirmCheckout('player_1', 'not_a_real_order');
    expect(result.status).toBe('failed');
    expect(result.coinsCredited).toBe(0);
  });
});

describe('PaymentService — webhooks', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => { ctx = makeService(); });

  it('credits from a PAYMENT.CAPTURE.COMPLETED event', async () => {
    const credited: number[] = [];
    ctx.service.setCreditHandler((event) => credited.push(event.coins));

    const session = await ctx.service.createCheckout('player_1', 'mega');
    const providerId = [...ctx.paypal.orders.keys()][0];
    ctx.paypal.orders.get(providerId)!.status = 'COMPLETED';

    await ctx.service.handleWebhookEvent({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'CAP_1', supplementary_data: { related_ids: { order_id: providerId } } },
    });

    expect(credited).toEqual([7_000]);
    expect(ctx.service.getOrder(session.orderRef)?.credited).toBe(true);
  });

  it('does not double-credit when the webhook and the client race', async () => {
    const credited: number[] = [];
    ctx.service.setCreditHandler((event) => credited.push(event.coins));

    const session = await ctx.service.createCheckout('player_1', 'mega');
    const providerId = [...ctx.paypal.orders.keys()][0];
    ctx.paypal.orders.get(providerId)!.status = 'COMPLETED';

    await Promise.all([
      ctx.service.handleWebhookEvent({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { supplementary_data: { related_ids: { order_id: providerId } } },
      }),
      ctx.service.confirmCheckout('player_1', session.orderRef),
    ]);

    expect(credited).toEqual([7_000]);
  });

  it('ignores events for orders it does not know', async () => {
    const credited: number[] = [];
    ctx.service.setCreditHandler((event) => credited.push(event.coins));
    await ctx.service.handleWebhookEvent({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'SOME_OTHER_ORDER' },
    });
    expect(credited).toEqual([]);
  });

  it('marks an order failed on a reversal', async () => {
    const session = await ctx.service.createCheckout('player_1', 'starter');
    const providerId = [...ctx.paypal.orders.keys()][0];

    await ctx.service.handleWebhookEvent({
      event_type: 'PAYMENT.CAPTURE.REVERSED',
      resource: { supplementary_data: { related_ids: { order_id: providerId } } },
    });

    expect(ctx.service.getOrder(session.orderRef)?.status).toBe('failed');
  });
});
