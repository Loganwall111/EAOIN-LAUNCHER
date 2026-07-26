/**
 * CoinStoreModal — "buy coins" dialog opened from the coin counter.
 *
 * Shows the three coin packs and runs the checkout through StoreService, which
 * in turn defers to the payment provider. No money logic lives in this file.
 */
import { useCallback, useState } from 'react';
import { COIN_PACKS, CoinPack, coinsPerDollar, formatPrice } from '../economy/CoinEconomy';
import { PaymentMethod } from '../economy/PaymentProvider';
import { StoreService } from '../economy/StoreService';

export interface CoinStoreModalProps {
  store: StoreService;
  balance: number;
  onClose: () => void;
  /** Fired after a successful top-up so the parent can refresh. */
  onPurchased?: (coins: number) => void;
}

export default function CoinStoreModal({ store, balance, onClose, onPurchased }: CoinStoreModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('paypal');
  const [busyPack, setBusyPack] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const handleBuy = useCallback(async (pack: CoinPack) => {
    setBusyPack(pack.id);
    setMessage(null);
    setError(false);
    try {
      const result = await store.buyCoins(pack, method);
      setMessage(result.message);
      setError(!result.ok);
      if (result.ok) onPurchased?.(result.coinsCredited);
    } catch (err) {
      setMessage(`Checkout failed: ${String(err)}`);
      setError(true);
    } finally {
      setBusyPack(null);
    }
  }, [method, onPurchased, store]);

  return (
    <div className="coin-store-overlay" role="dialog" aria-modal="true" aria-label="Buy coins">
      <div className="coin-store-modal">
        <header className="cs-head">
          <div>
            <span className="cs-eyebrow">EAOIN STORE</span>
            <h2 className="cs-title">Get Coins</h2>
          </div>
          <button className="cs-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="cs-balance-row">
          <span className="cs-coin-glyph">🪙</span>
          <span>Current balance</span>
          <strong>{balance.toLocaleString()}</strong>
        </div>

        <div className="cs-method-row" role="radiogroup" aria-label="Payment method">
          <button
            className={`cs-method ${method === 'paypal' ? 'active' : ''}`}
            role="radio" aria-checked={method === 'paypal'}
            onClick={() => setMethod('paypal')}
          >
            <span className="cs-method-mark paypal">P</span> PayPal
          </button>
          <button
            className={`cs-method ${method === 'card' ? 'active' : ''}`}
            role="radio" aria-checked={method === 'card'}
            onClick={() => setMethod('card')}
          >
            <span className="cs-method-mark card">💳</span> Card
          </button>
        </div>

        <div className="cs-pack-grid">
          {COIN_PACKS.map((pack) => (
            <div key={pack.id} className={`cs-pack ${pack.badge ? 'is-best' : ''}`}>
              {pack.badge && <span className="cs-pack-badge">{pack.badge}</span>}
              <div className="cs-pack-coins">
                <span className="cs-pack-glyph">🪙</span>
                <strong>{pack.coins.toLocaleString()}</strong>
                <small>coins</small>
              </div>
              <div className="cs-pack-name">{pack.label}</div>
              <p className="cs-pack-blurb">{pack.blurb}</p>
              <div className="cs-pack-rate">{coinsPerDollar(pack).toLocaleString()} coins / $1</div>
              <button
                className="cs-pack-buy"
                disabled={busyPack !== null}
                onClick={() => { void handleBuy(pack); }}
              >
                {busyPack === pack.id ? 'Processing…' : formatPrice(pack.priceCents)}
              </button>
            </div>
          ))}
        </div>

        {message && (
          <div className={`cs-message ${error ? 'is-error' : 'is-ok'}`} role="status">{message}</div>
        )}

        {!store.isLivePayments() && (
          <p className="cs-sandbox-note">
            ⚠ <strong>Sandbox checkout.</strong> No real payment is taken and no card or PayPal
            details are collected. Coins granted here are for testing only. To accept real
            payments, set <code>VITE_PAYMENTS_BASE_URL</code> to your backend — see{' '}
            <code>src/economy/PaymentProvider.ts</code>.
          </p>
        )}

        <p className="cs-legal">
          Coins are a virtual in-game currency with no cash value and are non-refundable except
          where required by law. Purchases are processed by {store.paymentLabel()}.
        </p>
      </div>
    </div>
  );
}
