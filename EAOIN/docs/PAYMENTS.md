# EAOIN Payments — real PayPal checkout

The marketplace coin store takes **real money through PayPal**. This document
is everything you need to switch it on.

Until you supply credentials the game still runs: the client falls back to a
clearly-labelled **Sandbox Checkout** that grants test coins and moves no money.

---

## Architecture

```
 browser (client)            EAOIN server                    PayPal
 ────────────────            ─────────────                   ──────
  pick a coin pack
  POST /api/payments/checkout ──────────────>
        { packId: "mega" }        price looked up from
                                  shared/src/economy/CoinPacks.ts
                                  POST /v2/checkout/orders  ────────>
        { orderRef, approveUrl } <────────────────────────────────────
  open approveUrl in a popup ──── buyer approves on paypal.com ──────>
                                  <─── webhook PAYMENT.CAPTURE.COMPLETED
                                       (signature verified)
  GET /api/payments/checkout/:ref ─────────>
                                  capture + credit (idempotent)
        { status, coinsCredited } <───────
```

### The three rules this enforces

1. **The client never holds a secret.** `PAYPAL_CLIENT_SECRET` lives only in the
   server process. The browser bundle contains, at most, the public client id.
2. **The client never decides a payment succeeded.** Coins are credited only
   after PayPal reports a `COMPLETED` capture *to our server*. Calling
   `wallet.creditPurchase()` from devtools grants nothing that survives a
   reload, because the server ledger is the authority.
3. **The server prices the order.** The client sends a pack *id* only. The
   amount is derived from `shared/src/economy/CoinPacks.ts`, which the client
   and server both import — so the two can never drift, and a tampered request
   cannot buy 7,000 coins for one cent.

---

## Setup

### 1. Create a PayPal app

Go to <https://developer.paypal.com/dashboard/applications/sandbox> and create
an app. You get a **Client ID** and a **Secret**. Do this once for Sandbox and
again for Live.

### 2. Configure the server

```bash
export PAYPAL_CLIENT_ID="AY...."
export PAYPAL_CLIENT_SECRET="EK...."     # SECRET — server only, never commit
export PAYPAL_ENV="sandbox"              # or "live"
export PAYPAL_WEBHOOK_ID="8XY...."       # from the dashboard, see step 4
export PUBLIC_ORIGIN="https://your-game.example"
export PAYPAL_RETURN_URL="https://your-game.example/checkout/return"
export PAYPAL_CANCEL_URL="https://your-game.example/checkout/cancel"
export PAYPAL_BRAND_NAME="EAOIN"

npm run server
```

On boot you should see:

```
[Server] PayPal payments ENABLED (sandbox) at /api/payments
```

If credentials are missing the server logs that payments are disabled and
exposes no payment routes at all.

### 3. Point the client at the server

```bash
# .env / .env.production
VITE_PAYMENTS_BASE_URL=/api/payments
```

That single variable flips the client from `MockPaymentProvider` to
`PayPalPaymentProvider`. The coin store swaps its yellow "Sandbox checkout"
warning for the blue "Secure PayPal checkout" notice.

In dev, proxy the API to the game server in `vite.config.ts` (already wired for
`/api`).

### 4. Register the webhook

In the PayPal dashboard, add a webhook pointing at:

```
https://your-game.example/api/payments/webhook
```

Subscribe to at least:

- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`

Copy the generated **Webhook ID** into `PAYPAL_WEBHOOK_ID`.

> Every webhook is signature-verified against PayPal's
> `verify-webhook-signature` endpoint before it is acted on. Verification
> **fails closed**: without `PAYPAL_WEBHOOK_ID` set, all webhooks are rejected
> rather than trusted.

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/payments/config` | Public client id, environment, pack table |
| `POST` | `/api/payments/checkout` | Create an order — body `{ packId }` |
| `GET` | `/api/payments/checkout/:orderRef` | Capture + report authoritative outcome |
| `POST` | `/api/payments/webhook` | PayPal server-to-server callback |

Authentication is via `Authorization: Bearer <token>`. Replace
`defaultResolvePlayerId` in `server/src/payments/paymentRoutes.ts` with your
real session check — the default derives a stable id from the token so the flow
is testable without an auth server.

---

## Persisting coins

`PaymentService.setCreditHandler()` is the single hook where a settled purchase
becomes coins. The default implementation logs an audit line:

```ts
service.setCreditHandler((event) => {
  // event: { playerId, coins, orderRef, captureId, amountCents }
  db.wallets.increment(event.playerId, event.coins);
});
```

The default `InMemoryPaymentStore` is fine for a single server. For more than
one instance, implement `PaymentStore` against Postgres/Redis so order state
and the credited-once guarantee survive a restart and are shared across nodes.

---

## Safety properties, and the tests that prove them

`tests/unit/payments.test.ts` covers:

| Property | Test |
|---|---|
| Server prices the order, not the client | *charges the server-side price…* |
| Tampered pack ids rejected | *refuses a checkout for an unknown pack id* |
| Coins credited only on `COMPLETED` | *does not credit when the capture is not COMPLETED* |
| Short payment rejected | *rejects a capture that paid less…* |
| Wrong currency rejected | *rejects a capture in the wrong currency* |
| Credit is idempotent | *credits exactly once even when confirm is called repeatedly* |
| Webhook/confirm race is safe | *does not double-credit when the webhook and the client race* |
| Orders are per-player | *will not let another player confirm someone else's order* |
| Unverified webhooks credit nothing | verification fails closed in `PayPalClient` |

---

## Going live

1. Swap the sandbox app credentials for live ones and set `PAYPAL_ENV=live`.
2. Re-register the webhook against the live app and update `PAYPAL_WEBHOOK_ID`.
3. Serve the game over HTTPS — PayPal will not call an http webhook.
4. Test one real purchase of the $5 pack end-to-end before announcing it.

**Never** commit `PAYPAL_CLIENT_SECRET`. If it leaks, rotate it immediately in
the PayPal dashboard.
