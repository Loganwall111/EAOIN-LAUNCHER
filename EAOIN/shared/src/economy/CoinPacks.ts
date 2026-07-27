/**
 * CoinPacks — the single authoritative coin-pack table.
 *
 * This lives in `shared/` on purpose. The client renders these prices, and the
 * SERVER re-derives the real charge from the pack id at checkout time. If the
 * two ever drifted apart, a tampered client could ask to be charged $0.01 for
 * the 7,000-coin pack. Because both sides import this exact file, they cannot
 * drift.
 *
 * Money rules enforced here:
 *   - Prices are integer US cents. Never floats, never strings.
 *   - `coins` is the amount the SERVER credits on a settled capture.
 *   - Nothing in this file talks to a payment provider; it is pure data.
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

/** ISO-4217 currency the packs are priced in. PayPal orders use this. */
export const COIN_CURRENCY = 'USD';

/**
 * The three published coin packs.
 *
 *   1,000 coins → $5
 *   1,600 coins → $15
 *   7,000 coins → $19
 */
export const COIN_PACKS: readonly CoinPack[] = Object.freeze([
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
] as const);

export function getCoinPack(id: string): CoinPack | undefined {
  return COIN_PACKS.find((pack) => pack.id === id);
}

/** True when `id` names a real pack. Used to reject tampered checkout bodies. */
export function isCoinPackID(id: unknown): id is CoinPackID {
  return typeof id === 'string' && COIN_PACKS.some((pack) => pack.id === id);
}

/** Format cents as a display price, e.g. 1900 → "$19.00". */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** PayPal wants decimal strings, e.g. 1900 → "19.00". Never use floats here. */
export function centsToDecimalString(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  const whole = Math.floor(safe / 100);
  const fraction = safe % 100;
  return `${whole}.${fraction.toString().padStart(2, '0')}`;
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
