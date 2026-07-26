// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  COIN_PACKS,
  CoinWallet,
  InsufficientCoinsError,
  WELCOME_GRANT,
  bestValuePack,
  coinsPerDollar,
  formatPrice,
  getCoinPack,
} from '../../src/economy/CoinEconomy';
import { MockPaymentProvider } from '../../src/economy/PaymentProvider';
import { StoreService, CREATOR_REVENUE_SHARE } from '../../src/economy/StoreService';
import { CATALOG, MarketplaceLibrary } from '../../src/marketplace/MarketplaceCatalog';

beforeEach(() => { localStorage.clear(); });

describe('coin packs', () => {
  it('publishes the three advertised packs at the right prices', () => {
    expect(getCoinPack('starter')).toMatchObject({ coins: 1_000, priceCents: 500 });
    expect(getCoinPack('plus')).toMatchObject({ coins: 1_600, priceCents: 1_500 });
    expect(getCoinPack('mega')).toMatchObject({ coins: 7_000, priceCents: 1_900 });
  });

  it('formats prices as whole-cent currency', () => {
    expect(formatPrice(500)).toBe('$5.00');
    expect(formatPrice(1_500)).toBe('$15.00');
    expect(formatPrice(1_900)).toBe('$19.00');
  });

  it('identifies the 7,000-coin pack as the best value', () => {
    expect(bestValuePack().id).toBe('mega');
    // Sanity-check the rate ordering the store advertises.
    expect(coinsPerDollar(getCoinPack('mega')!)).toBeGreaterThan(
      coinsPerDollar(getCoinPack('starter')!)
    );
  });

  it('stores prices as integer cents so money never uses floats', () => {
    for (const pack of COIN_PACKS) {
      expect(Number.isInteger(pack.priceCents)).toBe(true);
      expect(Number.isInteger(pack.coins)).toBe(true);
    }
  });
});

describe('CoinWallet', () => {
  it('gives a new wallet the welcome grant', () => {
    const wallet = new CoinWallet();
    expect(wallet.getBalance()).toBe(WELCOME_GRANT);
  });

  it('credits a purchase and records it in the ledger', () => {
    const wallet = new CoinWallet();
    const start = wallet.getBalance();
    wallet.creditPurchase(getCoinPack('mega')!, 'order_123');

    expect(wallet.getBalance()).toBe(start + 7_000);
    const snapshot = wallet.snapshot();
    expect(snapshot.lifetimePurchased).toBe(7_000);
    expect(snapshot.entries[0]).toMatchObject({ kind: 'purchase', orderRef: 'order_123' });
  });

  it('debits a spend', () => {
    const wallet = new CoinWallet();
    wallet.creditPurchase(getCoinPack('starter')!, 'order_1');
    const start = wallet.getBalance();
    wallet.spend(300, 'Aurora Cape');
    expect(wallet.getBalance()).toBe(start - 300);
    expect(wallet.snapshot().lifetimeSpent).toBe(300);
  });

  it('refuses to overdraw and leaves the balance untouched', () => {
    const wallet = new CoinWallet();
    const start = wallet.getBalance();
    expect(() => wallet.spend(start + 1, 'too expensive')).toThrow(InsufficientCoinsError);
    expect(wallet.getBalance()).toBe(start);
  });

  it('notifies subscribers on every change', () => {
    const wallet = new CoinWallet();
    const seen: number[] = [];
    const unsubscribe = wallet.subscribe((snapshot) => seen.push(snapshot.balance));
    wallet.grant(100, 'test');
    wallet.spend(50, 'test');
    unsubscribe();
    wallet.grant(999, 'after unsubscribe');
    expect(seen).toHaveLength(2);
  });

  it('persists across instances', () => {
    const first = new CoinWallet();
    first.creditPurchase(getCoinPack('plus')!, 'order_x');
    const expected = first.getBalance();

    const second = new CoinWallet();
    expect(second.getBalance()).toBe(expected);
  });

  it('survives corrupt storage without throwing', () => {
    localStorage.setItem('eaoin:wallet:v1', '{{{not json');
    expect(() => new CoinWallet()).not.toThrow();
  });
});

describe('StoreService — buying items', () => {
  function setup() {
    const wallet = new CoinWallet();
    const library = new MarketplaceLibrary();
    const store = new StoreService(wallet, library, new MockPaymentProvider(0));
    return { wallet, library, store };
  }

  it('grants free items without touching the balance', () => {
    const { wallet, library, store } = setup();
    const free = CATALOG.find((item) => item.priceCoins === 0)!;
    const before = wallet.getBalance();

    const result = store.buyItem(free);
    expect(result.ok).toBe(true);
    expect(wallet.getBalance()).toBe(before);
    expect(library.isOwned(free.id)).toBe(true);
  });

  it('debits coins and grants ownership for a paid item', () => {
    const { wallet, library, store } = setup();
    wallet.creditPurchase(getCoinPack('mega')!, 'order_1');
    const before = wallet.getBalance();
    const paid = CATALOG.find((item) => item.priceCoins > 0)!;

    const result = store.buyItem(paid);
    expect(result.ok).toBe(true);
    expect(wallet.getBalance()).toBe(before - paid.priceCoins);
    expect(library.isOwned(paid.id)).toBe(true);
  });

  it('refuses the purchase when the player cannot afford it', () => {
    const { wallet, library, store } = setup();
    const expensive = [...CATALOG].sort((a, b) => b.priceCoins - a.priceCoins)[0];
    const before = wallet.getBalance();

    const result = store.buyItem(expensive);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not enough coins/i);
    expect(wallet.getBalance()).toBe(before);
    expect(library.isOwned(expensive.id)).toBe(false);
  });

  it('does not double-charge for an item already owned', () => {
    const { wallet, store } = setup();
    wallet.creditPurchase(getCoinPack('mega')!, 'order_1');
    const paid = CATALOG.find((item) => item.priceCoins > 0)!;

    store.buyItem(paid);
    const afterFirst = wallet.getBalance();
    const second = store.buyItem(paid);

    expect(second.alreadyOwned).toBe(true);
    expect(wallet.getBalance()).toBe(afterFirst);
  });

  it('pays the creator a share when user-made content sells', () => {
    const { wallet, store } = setup();
    wallet.creditPurchase(getCoinPack('mega')!, 'order_1');

    const creation = store.publishCreation({
      id: 'creator-test', name: 'Test Creation', creator: 'Me', category: 'worlds',
      priceCoins: 1_000, description: 'A test', art: '🌍', tint: '#000',
      downloads: 0, rating: 0, tags: [], official: false, userCreated: true,
    });

    // Publishing grants the author ownership, so model a *different* buyer with
    // their own non-persisted wallet and library rather than reusing storage.
    const wallet2 = new CoinWallet(false);
    const library2 = new MarketplaceLibrary(false);
    const store2 = new StoreService(wallet2, library2, new MockPaymentProvider(0));
    wallet2.creditPurchase(getCoinPack('mega')!, 'order_2');
    const before = wallet2.getBalance();
    expect(library2.isOwned(creation.id)).toBe(false);

    store2.buyItem(creation);
    const expectedShare = Math.floor(1_000 * CREATOR_REVENUE_SHARE);
    expect(wallet2.getBalance()).toBe(before - 1_000 + expectedShare);
  });
});

describe('StoreService — buying coins', () => {
  it('credits the pack amount through the sandbox provider', async () => {
    const wallet = new CoinWallet();
    const store = new StoreService(wallet, new MarketplaceLibrary(), new MockPaymentProvider(0));
    const before = wallet.getBalance();

    const result = await store.buyCoins(getCoinPack('starter')!, 'paypal');
    expect(result.ok).toBe(true);
    expect(result.coinsCredited).toBe(1_000);
    expect(wallet.getBalance()).toBe(before + 1_000);
  });

  it('reports the sandbox provider as not live', () => {
    const store = new StoreService(new CoinWallet(), new MarketplaceLibrary(), new MockPaymentProvider(0));
    expect(store.isLivePayments()).toBe(false);
  });

  it('rejects an unknown pack id without crediting anything', async () => {
    const wallet = new CoinWallet();
    const store = new StoreService(wallet, new MarketplaceLibrary(), new MockPaymentProvider(0));
    const before = wallet.getBalance();

    const result = await store.buyCoinsById('nope' as never);
    expect(result.ok).toBe(false);
    expect(wallet.getBalance()).toBe(before);
  });
});
