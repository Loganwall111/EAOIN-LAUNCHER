/**
 * createPaymentsFromEnv — build the payment stack from environment variables.
 *
 * Returns `null` when credentials are missing, which is what keeps the game
 * fully playable for anyone who clones the repo without a merchant account:
 * the server simply doesn't expose payment routes, and the client falls back
 * to its clearly-labelled sandbox provider.
 *
 * Required to go live:
 *   PAYPAL_CLIENT_ID       — from developer.paypal.com
 *   PAYPAL_CLIENT_SECRET   — SECRET. Server only. Never in the client bundle.
 *   PAYPAL_ENV             — 'sandbox' (default) or 'live'
 *   PAYPAL_WEBHOOK_ID      — required for webhook verification
 *   PAYPAL_RETURN_URL      — where PayPal sends the buyer after approval
 *   PAYPAL_CANCEL_URL      — where PayPal sends the buyer on cancel
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { PayPalClient, PayPalEnvironment } from './PayPalClient';
import { InMemoryPaymentStore, PaymentService } from './PaymentService';
import { createPaymentRoutes } from './paymentRoutes';

export interface PaymentsBundle {
  service: PaymentService;
  paypal: PayPalClient;
  environment: PayPalEnvironment;
  handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
}

export function createPaymentsFromEnv(env: NodeJS.ProcessEnv = process.env): PaymentsBundle | null {
  const clientId = env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const environment: PayPalEnvironment = env.PAYPAL_ENV?.trim() === 'live' ? 'live' : 'sandbox';
  const publicOrigin = env.PUBLIC_ORIGIN?.trim() || 'http://localhost:3000';

  const paypal = new PayPalClient({
    clientId,
    clientSecret,
    environment,
    webhookId: env.PAYPAL_WEBHOOK_ID?.trim(),
    returnUrl: env.PAYPAL_RETURN_URL?.trim() || `${publicOrigin}/checkout/return`,
    cancelUrl: env.PAYPAL_CANCEL_URL?.trim() || `${publicOrigin}/checkout/cancel`,
    brandName: env.PAYPAL_BRAND_NAME?.trim() || 'EAOIN',
  });

  const store = new InMemoryPaymentStore();
  const service = new PaymentService(paypal, store);

  // Audit trail. Replace with a database write in a real deployment — this is
  // the exact hook where credited coins should be persisted per player.
  service.setCreditHandler((event) => {
    console.log(
      `[Payments] CREDIT ${event.coins} coins to ${event.playerId} ` +
      `(order ${event.orderRef}, capture ${event.captureId}, ${(event.amountCents / 100).toFixed(2)} USD)`
    );
  });

  if (environment === 'live' && !env.PAYPAL_WEBHOOK_ID?.trim()) {
    console.warn('[Payments] PAYPAL_ENV=live but PAYPAL_WEBHOOK_ID is unset — webhooks will be rejected.');
  }

  const handleRequest = createPaymentRoutes({ service, paypal, publicClientId: clientId });

  return { service, paypal, environment, handleRequest };
}

export default createPaymentsFromEnv;
