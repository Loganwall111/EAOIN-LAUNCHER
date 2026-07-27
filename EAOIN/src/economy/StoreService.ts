/**
 * StoreService — the one place that mutates coins and ownership together.
 *
 * Keeping both sides of every transaction here means a UI component can never
 * accidentally grant an item without debiting, or debit without granting.
 */
import { CoinPack, CoinWallet, InsufficientCoinsError, getCoinPack } from './CoinEconomy';
import { PaymentProvider, PaymentMethod, CheckoutSession } from './PaymentProvider';
import { MarketItem, MarketplaceLibrary } from '../marketplace/MarketplaceCatalog';

/** Optional UI hooks so a slow PayPal round trip can narrate itself. */
export interface BuyCoinsOptions {
  method?: PaymentMethod;
  /** Called with human-readable progress, e.g. "Waiting for approval…". */
  onStatus?: (message: string) => void;
}

export interface BuyItemResult {
  ok: boolean;
  message: string;
  /** Wallet balance after the attempt. */
  balance: number;
  /** True when the player already owned the item. */
  alreadyOwned?: boolean;
}

export interface BuyCoinsResult {
  ok: boolean;
  message: string;
  balance: number;
  coinsCredited: number;
  session?: CheckoutSession;
}

export class StoreService {
  constructor(
    private readonly wallet: CoinWallet,
    private readonly library: MarketplaceLibrary,
    private readonly payments: PaymentProvider
  ) {}

  /** Whether real money can actually be taken in this build. */
  isLivePayments(): boolean {
    return this.payments.isLive;
  }

  paymentLabel(): string {
    return this.payments.label;
  }

  /**
   * Buy a marketplace item with coins.
   * Debits first, then grants ownership; a failed grant refunds automatically.
   */
  buyItem(item: MarketItem): BuyItemResult {
    if (this.library.isOwned(item.id)) {
      return {
        ok: true,
        alreadyOwned: true,
        message: `You already own ${item.name}.`,
        balance: this.wallet.getBalance(),
      };
    }

    if (item.priceCoins === 0) {
      this.library.grantOwnership(item.id);
      return { ok: true, message: `${item.name} added to your library.`, balance: this.wallet.getBalance() };
    }

    try {
      this.wallet.spend(item.priceCoins, `${item.name} — ${item.creator}`);
    } catch (error) {
      if (error instanceof InsufficientCoinsError) {
        const short = item.priceCoins - this.wallet.getBalance();
        return {
          ok: false,
          message: `Not enough coins — you need ${short.toLocaleString()} more.`,
          balance: this.wallet.getBalance(),
        };
      }
      throw error;
    }

    try {
      this.library.grantOwnership(item.id);
    } catch (error) {
      // Never take coins without delivering the item.
      this.wallet.refund(item.priceCoins, `Refund — ${item.name} could not be delivered`);
      return {
        ok: false,
        message: `Purchase failed and your coins were refunded. (${String(error)})`,
        balance: this.wallet.getBalance(),
      };
    }

    // Creators earn a share when their content sells.
    if (item.userCreated) {
      const share = Math.floor(item.priceCoins * CREATOR_REVENUE_SHARE);
      if (share > 0) this.wallet.creditEarnings(share, `Creator payout — ${item.name}`);
    }

    return {
      ok: true,
      message: `${item.name} purchased for ${item.priceCoins.toLocaleString()} coins.`,
      balance: this.wallet.getBalance(),
    };
  }

  /**
   * Buy a coin pack with real money.
   *
   * SECURITY: coins are credited from the amount the PROVIDER reports, not from
   * anything the caller passes in. With the sandbox provider (`coinsCredited`
   * of -1) we fall back to the pack's advertised amount, which is safe because
   * no money changed hands.
   */
  async buyCoins(
    pack: CoinPack,
    methodOrOptions: PaymentMethod | BuyCoinsOptions = 'paypal'
  ): Promise<BuyCoinsResult> {
    const options: BuyCoinsOptions =
      typeof methodOrOptions === 'string' ? { method: methodOrOptions } : methodOrOptions;
    const method = options.method ?? 'paypal';

    options.onStatus?.('Opening checkout…');
    const session = await this.payments.createCheckout(pack, method);

    if (session.status === 'failed') {
      return {
        ok: false,
        message: session.error ?? 'Checkout could not be started.',
        balance: this.wallet.getBalance(),
        coinsCredited: 0,
        session,
      };
    }

    // A live provider hands back a URL the player must approve on PayPal.
    let approvalWindow: Window | null = null;
    if (session.approveUrl) {
      approvalWindow = openApprovalWindow(session.approveUrl);
      options.onStatus?.(
        approvalWindow
          ? 'Complete your payment in the PayPal window.'
          : 'Popup blocked — open the PayPal link to finish paying.'
      );
    }

    let result;
    try {
      result = await this.payments.confirmCheckout(session, { onStatus: options.onStatus });
    } finally {
      // Always tidy up the popup, even if confirmation threw.
      closeApprovalWindow(approvalWindow);
    }

    if (result.status !== 'completed') {
      return {
        ok: false,
        message: result.error ?? `Payment ${result.status}. No coins were added.`,
        balance: this.wallet.getBalance(),
        coinsCredited: 0,
        session,
      };
    }

    // Trust the server's figure whenever it gives one.
    const credited = result.coinsCredited >= 0 ? result.coinsCredited : pack.coins;
    const settledPack: CoinPack =
      credited === pack.coins ? pack : { ...pack, coins: credited };

    this.wallet.creditPurchase(settledPack, result.orderRef);

    return {
      ok: true,
      message: `${credited.toLocaleString()} coins added to your wallet.`,
      balance: this.wallet.getBalance(),
      coinsCredited: credited,
      session,
    };
  }

  /** Convenience overload used by the UI, which only knows the pack id. */
  async buyCoinsById(
    packId: CoinPack['id'],
    methodOrOptions: PaymentMethod | BuyCoinsOptions = 'paypal'
  ): Promise<BuyCoinsResult> {
    const pack = getCoinPack(packId);
    if (!pack) {
      return { ok: false, message: 'Unknown coin pack.', balance: this.wallet.getBalance(), coinsCredited: 0 };
    }
    return this.buyCoins(pack, methodOrOptions);
  }

  /**
   * Publish a creation from Editor Mode so other players can buy it.
   * Publishing is free; the creator earns a share of each sale.
   */
  publishCreation(item: MarketItem): MarketItem {
    return this.library.publish(item);
  }
}

/** Share of each sale that goes to the creator. */
export const CREATOR_REVENUE_SHARE = 0.7;

/**
 * Open PayPal's approval page.
 *
 * Note the absence of `noopener`: we deliberately keep the handle so the popup
 * can be closed once the server confirms the capture. Nothing is read from the
 * popup — cross-origin rules forbid it, and the outcome comes from our server
 * either way.
 */
function openApprovalWindow(url: string): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.open(url, 'eaoin_checkout', 'width=500,height=760');
  } catch {
    // Popup blocked — the confirm step still polls the backend.
    return null;
  }
}

function closeApprovalWindow(handle: Window | null): void {
  if (!handle) return;
  try {
    if (!handle.closed) handle.close();
  } catch { /* cross-origin close can throw; harmless */ }
}

export default StoreService;
