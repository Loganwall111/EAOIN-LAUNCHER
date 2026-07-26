/**
 * CoinEconomy — EAOIN coin wallet, coin packs, and purchase ledger.
 *
 * Coins are the marketplace currency. Players top up their wallet by buying a
 * coin pack through an external payment provider (PayPal / card), then spend
 * coins on marketplace items.
 *
 * IMPORTANT — payments are intentionally NOT settled in the client. The client
 * only ever asks the backend to create a checkout session and then reconciles
 * the wallet from whatever the backend reports. See `PaymentProvider.ts`.
 */

export type CoinPackID = 'starter' | 'plus' | 'mega';

export interface CoinPack {
  id: CoinPackID;
  /** Coins credited on successful purchase. */
  coins: number;
  /** Price in USD cents — integer maths only, never floats for money. */
  priceCents: number;
  label: string;
  blurb: string;
  /** Marketing badge, if any. */
  badge?: string;
  /** Bonus coins over the linear rate of the starter pack, for display. */
  bonusCoins: number;
}

/**
 * The three published coin packs.
 *
 *   1,000 coins → $5
 *   1,600 coins → $15
 *   7,000 coins → $19
 */
export const COIN_PACKS: CoinPack[] = [
  {
    id: 'starter',
    coins: 1_000,
    priceCents: 500,
    label: 'Starter Pouch',
    blurb: 'A handful of coins to grab your first skin pack.',
    bonusCoins: 0,
  },
  {
    id: 'plus',
    coins: 1_600,
    priceCents: 1_500,
    label: 'Adventurer Chest',
    blurb: 'More coins for mods, worlds and cosmetics.',
    bonusCoins: 0,
  },
  {
    id: 'mega',
    coins: 7_000,
    priceCents: 1_900,
    label: 'Creator Vault',
    blurb: 'The best value — stock up and buy anything on the marketplace.',
    badge: 'BEST VALUE',
    bonusCoins: 3_200,
  },
];

export function getCoinPack(id: CoinPackID): CoinPack | undefined {
  return COIN_PACKS.find((pack) => pack.id === id);
}

/** Format cents as a display price, e.g. 1900 → "$19.00". */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Coins per dollar, used to show which pack is the better deal. */
export function coinsPerDollar(pack: CoinPack): number {
  return Math.round((pack.coins / pack.priceCents) * 100);
}

/** The pack with the highest coins-per-dollar rate. */
export function bestValuePack(): CoinPack {
  return COIN_PACKS.reduce((best, pack) =>
    coinsPerDollar(pack) > coinsPerDollar(best) ? pack : best
  );
}

export type LedgerKind = 'purchase' | 'spend' | 'refund' | 'grant' | 'payout';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  /** Signed coin delta: positive credits, negative debits. */
  coins: number;
  description: string;
  /** Epoch milliseconds. */
  at: number;
  /** Present on real-money purchases. */
  priceCents?: number;
  /** Backend order reference, when the entry came from a settled payment. */
  orderRef?: string;
}

export interface WalletSnapshot {
  balance: number;
  lifetimePurchased: number;
  lifetimeSpent: number;
  lifetimeEarned: number;
  entries: LedgerEntry[];
}

const STORAGE_KEY = 'eaoin:wallet:v1';
const MAX_LEDGER_ENTRIES = 200;
/** Coins granted once to a brand-new wallet so the marketplace is explorable. */
export const WELCOME_GRANT = 500;

export class InsufficientCoinsError extends Error {
  constructor(public readonly required: number, public readonly available: number) {
    super(`Need ${required} coins but the wallet only has ${available}.`);
    this.name = 'InsufficientCoinsError';
  }
}

/**
 * The player's coin wallet. Persists to localStorage and notifies subscribers
 * on every change so React views stay in sync.
 */
export class CoinWallet {
  private balance = 0;
  private lifetimePurchased = 0;
  private lifetimeSpent = 0;
  private lifetimeEarned = 0;
  private entries: LedgerEntry[] = [];
  private listeners = new Set<(snapshot: WalletSnapshot) => void>();

  constructor(autoload = true) {
    if (autoload) this.load();
  }

  getBalance(): number {
    return this.balance;
  }

  canAfford(coins: number): boolean {
    return this.balance >= coins;
  }

  snapshot(): WalletSnapshot {
    return {
      balance: this.balance,
      lifetimePurchased: this.lifetimePurchased,
      lifetimeSpent: this.lifetimeSpent,
      lifetimeEarned: this.lifetimeEarned,
      entries: this.entries.map((entry) => ({ ...entry })),
    };
  }

  subscribe(listener: (snapshot: WalletSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * Credit coins from a settled real-money purchase.
   * `orderRef` should be the backend's order id so the ledger is auditable.
   */
  creditPurchase(pack: CoinPack, orderRef: string): LedgerEntry {
    const entry = this.append({
      kind: 'purchase',
      coins: pack.coins,
      description: `${pack.label} — ${pack.coins.toLocaleString()} coins`,
      priceCents: pack.priceCents,
      orderRef,
    });
    this.lifetimePurchased += pack.coins;
    this.commit();
    return entry;
  }

  /** Credit coins earned from a creator payout (someone bought your content). */
  creditEarnings(coins: number, description: string): LedgerEntry {
    const entry = this.append({ kind: 'payout', coins, description });
    this.lifetimeEarned += coins;
    this.commit();
    return entry;
  }

  /** Credit promotional / welcome coins. */
  grant(coins: number, description: string): LedgerEntry {
    const entry = this.append({ kind: 'grant', coins, description });
    this.commit();
    return entry;
  }

  /**
   * Debit coins for a marketplace purchase.
   * @throws {InsufficientCoinsError} when the balance is too low.
   */
  spend(coins: number, description: string): LedgerEntry {
    if (coins < 0) throw new Error('Spend amount must be positive.');
    if (!this.canAfford(coins)) throw new InsufficientCoinsError(coins, this.balance);
    const entry = this.append({ kind: 'spend', coins: -coins, description });
    this.lifetimeSpent += coins;
    this.commit();
    return entry;
  }

  /** Reverse a spend, e.g. a failed download or a refunded item. */
  refund(coins: number, description: string): LedgerEntry {
    const entry = this.append({ kind: 'refund', coins, description });
    this.lifetimeSpent = Math.max(0, this.lifetimeSpent - coins);
    this.commit();
    return entry;
  }

  private append(partial: Omit<LedgerEntry, 'id' | 'at'>): LedgerEntry {
    const entry: LedgerEntry = {
      ...partial,
      id: `led_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
    };
    this.balance += entry.coins;
    this.entries = [entry, ...this.entries].slice(0, MAX_LEDGER_ENTRIES);
    return entry;
  }

  private commit(): void {
    this.save();
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      try { listener(snap); } catch { /* a bad subscriber must not break the wallet */ }
    }
  }

  /* ------------------------------------------------------------ persistence */

  private load(): void {
    const storage = getStorage();
    if (!storage) { this.applyWelcomeGrantIfNew(); return; }
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) { this.applyWelcomeGrantIfNew(); return; }
      const parsed = JSON.parse(raw) as Partial<WalletSnapshot>;
      this.balance = numberOr(parsed.balance, 0);
      this.lifetimePurchased = numberOr(parsed.lifetimePurchased, 0);
      this.lifetimeSpent = numberOr(parsed.lifetimeSpent, 0);
      this.lifetimeEarned = numberOr(parsed.lifetimeEarned, 0);
      this.entries = Array.isArray(parsed.entries) ? parsed.entries.slice(0, MAX_LEDGER_ENTRIES) : [];
    } catch {
      this.applyWelcomeGrantIfNew();
    }
  }

  private applyWelcomeGrantIfNew(): void {
    if (this.entries.length > 0 || this.balance > 0) return;
    this.append({
      kind: 'grant',
      coins: WELCOME_GRANT,
      description: 'Welcome to EAOIN — enjoy some coins on us!',
    });
    this.save();
  }

  private save(): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()));
    } catch { /* non-fatal: the wallet still works for this session */ }
  }

  /** Wipe the wallet. Exposed for tests and for "reset progress". */
  reset(): void {
    this.balance = 0;
    this.lifetimePurchased = 0;
    this.lifetimeSpent = 0;
    this.lifetimeEarned = 0;
    this.entries = [];
    const storage = getStorage();
    try { storage?.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    this.commit();
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

export default CoinWallet;
