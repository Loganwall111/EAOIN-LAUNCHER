/**
 * MarketplaceScreen — the storefront reached from the main menu.
 *
 * Layout:
 *   • Economy bar across the top with the live coin balance ("+" opens the
 *     coin store).
 *   • Category rail down the left: skins, capes, gear, mods, worlds,
 *     mini-games, shaders, textures — plus "My Library" and "Free".
 *   • Grid of item tiles, with a detail panel for the selected item where you
 *     buy, equip and unequip.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CatalogFilter,
  MARKET_CATEGORIES,
  MarketCategory,
  MarketItem,
  MarketplaceLibrary,
  filterCatalog,
} from '../marketplace/MarketplaceCatalog';
import { CoinWallet } from '../economy/CoinEconomy';
import { StoreService } from '../economy/StoreService';
import CoinStoreModal from './CoinStoreModal';

export interface MarketplaceScreenProps {
  wallet: CoinWallet;
  library: MarketplaceLibrary;
  store: StoreService;
  onBack: () => void;
  /** Opens Editor Mode so the player can build something to sell. */
  onOpenEditor: () => void;
}

type RailKey = MarketCategory | 'all' | 'owned' | 'free';

const SORT_OPTIONS: Array<{ id: NonNullable<CatalogFilter['sort']>; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'popular', label: 'Most Downloaded' },
  { id: 'rating', label: 'Top Rated' },
  { id: 'price-low', label: 'Price: Low to High' },
  { id: 'price-high', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest' },
];

export default function MarketplaceScreen({
  wallet, library, store, onBack, onOpenEditor,
}: MarketplaceScreenProps) {
  const [balance, setBalance] = useState(() => wallet.getBalance());
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [rail, setRail] = useState<RailKey>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<NonNullable<CatalogFilter['sort']>>('featured');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coinStoreOpen, setCoinStoreOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  // Keep the header balance and the ownership badges live.
  useEffect(() => wallet.subscribe((snap) => setBalance(snap.balance)), [wallet]);
  useEffect(() => library.subscribe(() => setLibraryRevision((v) => v + 1)), [library]);

  // Escape backs out, matching every other EAOIN menu.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (coinStoreOpen) setCoinStoreOpen(false);
      else onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [coinStoreOpen, onBack]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const items = useMemo(() => {
    void libraryRevision;
    return filterCatalog(
      library.allItems(),
      { category: rail, query, sort },
      (id) => library.isOwned(id)
    );
  }, [library, libraryRevision, rail, query, sort]);

  const selected = useMemo(() => {
    void libraryRevision;
    return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  }, [items, selectedId, libraryRevision]);

  const handleBuy = useCallback((item: MarketItem) => {
    const result = store.buyItem(item);
    setToast({ text: result.message, ok: result.ok });
    if (!result.ok && result.balance < item.priceCoins) setCoinStoreOpen(true);
  }, [store]);

  const handleEquip = useCallback((item: MarketItem) => {
    const nowEquipped = library.toggleEquip(item.id);
    setToast({
      text: nowEquipped ? `${item.name} equipped.` : `${item.name} unequipped.`,
      ok: true,
    });
  }, [library]);

  const ownedCount = useMemo(() => {
    void libraryRevision;
    return library.ownedItems().length;
  }, [library, libraryRevision]);

  return (
    <div className="marketplace-screen">
      <div className="mk-backdrop" />

      {/* ------------------------------ economy bar ----------------------- */}
      <header className="mk-topbar">
        <button className="mk-back" onClick={onBack} aria-label="Back to main menu">‹ Back</button>

        <div className="mk-titles">
          <span className="mk-eyebrow">EAOIN</span>
          <h1 className="mk-title">Marketplace</h1>
        </div>

        <div className="mk-economy">
          <button
            className="mk-coin-pill"
            onClick={() => setCoinStoreOpen(true)}
            aria-label={`${balance} coins. Buy more coins.`}
            title="Buy more coins"
          >
            <span className="mk-coin-glyph">🪙</span>
            <span className="mk-coin-amount">{balance.toLocaleString()}</span>
            <span className="mk-coin-plus">+</span>
          </button>
          <button className="mk-creator-btn" onClick={onOpenEditor}>
            🛠 Creator Studio
          </button>
        </div>
      </header>

      <div className="mk-body">
        {/* ---------------------------- category rail --------------------- */}
        <nav className="mk-rail" aria-label="Marketplace categories">
          <button className={`mk-rail-btn ${rail === 'all' ? 'active' : ''}`} onClick={() => setRail('all')}>
            <span className="mk-rail-icon">🏬</span> All
          </button>
          <button className={`mk-rail-btn ${rail === 'owned' ? 'active' : ''}`} onClick={() => setRail('owned')}>
            <span className="mk-rail-icon">📚</span> My Library
            <span className="mk-rail-count">{ownedCount}</span>
          </button>
          <button className={`mk-rail-btn ${rail === 'free' ? 'active' : ''}`} onClick={() => setRail('free')}>
            <span className="mk-rail-icon">🎁</span> Free
          </button>

          <div className="mk-rail-divider" />

          {MARKET_CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={`mk-rail-btn ${rail === category.id ? 'active' : ''}`}
              onClick={() => setRail(category.id)}
              title={category.blurb}
            >
              <span className="mk-rail-icon">{category.icon}</span> {category.label}
            </button>
          ))}
        </nav>

        {/* ------------------------------- grid --------------------------- */}
        <section className="mk-grid-pane">
          <div className="mk-filter-row">
            <input
              className="mk-search"
              placeholder="Search the marketplace…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search the marketplace"
            />
            <select
              className="mk-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as NonNullable<CatalogFilter['sort']>)}
              aria-label="Sort items"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="mk-grid">
            {items.length === 0 && (
              <p className="mk-empty">Nothing here yet. Try another category or search.</p>
            )}
            {items.map((item) => {
              const owned = library.isOwned(item.id);
              const equipped = library.isEquipped(item.id);
              return (
                <button
                  key={item.id}
                  className={`mk-tile ${selected?.id === item.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="mk-tile-art" style={{ background: item.tint }}>
                    <span className="mk-tile-glyph">{item.art}</span>
                    {item.featured && <span className="mk-tile-flag">FEATURED</span>}
                    {item.userCreated && <span className="mk-tile-flag creator">BY CREATOR</span>}
                  </span>
                  <span className="mk-tile-name">{item.name}</span>
                  <span className="mk-tile-creator">{item.creator}</span>
                  <span className="mk-tile-foot">
                    {equipped ? (
                      <span className="mk-tag equipped">Equipped</span>
                    ) : owned ? (
                      <span className="mk-tag owned">Owned</span>
                    ) : item.priceCoins === 0 ? (
                      <span className="mk-tag free">Free</span>
                    ) : (
                      <span className="mk-tile-price">🪙 {item.priceCoins.toLocaleString()}</span>
                    )}
                    <span className="mk-tile-rating">★ {item.rating.toFixed(1)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ------------------------------ detail -------------------------- */}
        <aside className="mk-detail">
          {selected ? (
            <>
              <div className="mk-detail-art" style={{ background: selected.tint }}>
                <span>{selected.art}</span>
              </div>
              <h2 className="mk-detail-name">{selected.name}</h2>
              <p className="mk-detail-creator">
                by {selected.creator}
                {selected.official && <span className="mk-official">OFFICIAL</span>}
              </p>
              <p className="mk-detail-desc">{selected.description}</p>

              <dl className="mk-detail-stats">
                <div><dt>Downloads</dt><dd>{selected.downloads.toLocaleString()}</dd></div>
                <div><dt>Rating</dt><dd>★ {selected.rating.toFixed(1)}</dd></div>
                <div><dt>Category</dt><dd>{MARKET_CATEGORIES.find((c) => c.id === selected.category)?.label}</dd></div>
                {selected.slot && <div><dt>Slot</dt><dd>{selected.slot}</dd></div>}
              </dl>

              <div className="mk-detail-tags">
                {selected.tags.map((tag) => <span key={tag} className="mk-chip">{tag}</span>)}
              </div>

              <div className="mk-detail-actions">
                {library.isOwned(selected.id) ? (
                  <>
                    <div className="mk-owned-note">✓ In your library</div>
                    {selected.slot && (
                      <button className="mk-buy-btn equip" onClick={() => handleEquip(selected)}>
                        {library.isEquipped(selected.id) ? 'Unequip' : 'Equip'}
                      </button>
                    )}
                  </>
                ) : (
                  <button className="mk-buy-btn" onClick={() => handleBuy(selected)}>
                    {selected.priceCoins === 0
                      ? 'Get for Free'
                      : <>Buy for <strong>🪙 {selected.priceCoins.toLocaleString()}</strong></>}
                  </button>
                )}
                {!library.isOwned(selected.id) && selected.priceCoins > balance && (
                  <button className="mk-topup-btn" onClick={() => setCoinStoreOpen(true)}>
                    Need {(selected.priceCoins - balance).toLocaleString()} more — get coins
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="mk-empty">Select an item to see the details.</p>
          )}
        </aside>
      </div>

      {toast && (
        <div className={`mk-toast ${toast.ok ? 'ok' : 'err'}`} role="status">{toast.text}</div>
      )}

      {coinStoreOpen && (
        <CoinStoreModal
          store={store}
          balance={balance}
          onClose={() => setCoinStoreOpen(false)}
          onPurchased={(coins) => setToast({ text: `${coins.toLocaleString()} coins added!`, ok: true })}
        />
      )}
    </div>
  );
}
