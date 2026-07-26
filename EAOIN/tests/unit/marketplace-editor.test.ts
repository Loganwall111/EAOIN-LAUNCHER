// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CATALOG,
  MARKET_CATEGORIES,
  MarketplaceLibrary,
  filterCatalog,
} from '../../src/marketplace/MarketplaceCatalog';
import {
  createCustomBlock,
  createCustomEntity,
  createEmptyProject,
  exportProject,
  importProject,
  toMarketItem,
  validateForPublish,
} from '../../src/editor/EditorProject';

beforeEach(() => { localStorage.clear(); });

describe('marketplace catalog', () => {
  it('covers every advertised category', () => {
    const ids = new Set(CATALOG.map((item) => item.category));
    for (const category of MARKET_CATEGORIES) {
      expect(ids.has(category.id), `missing content for ${category.id}`).toBe(true);
    }
  });

  it('ships free placeholder content in every category', () => {
    for (const category of MARKET_CATEGORIES) {
      const free = CATALOG.filter((item) => item.category === category.id && item.priceCoins === 0);
      expect(free.length, `${category.id} needs a free item`).toBeGreaterThan(0);
    }
  });

  it('gives every item a unique id', () => {
    const ids = CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every wearable a cosmetic slot', () => {
    for (const item of CATALOG) {
      if (item.category === 'capes' || item.category === 'gear' || item.category === 'skins') {
        expect(item.slot, `${item.id} needs a slot`).toBeTruthy();
      }
    }
  });
});

describe('MarketplaceLibrary', () => {
  it('owns all free items from the start', () => {
    const library = new MarketplaceLibrary();
    for (const item of CATALOG.filter((entry) => entry.priceCoins === 0)) {
      expect(library.isOwned(item.id)).toBe(true);
    }
  });

  it('does not own paid items until granted', () => {
    const library = new MarketplaceLibrary();
    const paid = CATALOG.find((item) => item.priceCoins > 0)!;
    expect(library.isOwned(paid.id)).toBe(false);
    library.grantOwnership(paid.id);
    expect(library.isOwned(paid.id)).toBe(true);
  });

  it('equips an owned cosmetic into its slot and swaps within that slot', () => {
    const library = new MarketplaceLibrary();
    const capes = CATALOG.filter((item) => item.slot === 'cape');
    const [first, second] = capes;
    library.grantOwnership(first.id);
    library.grantOwnership(second.id);

    expect(library.equip(first.id)).toBe(true);
    expect(library.getEquipped().cape).toBe(first.id);

    // Equipping a second cape replaces the first rather than stacking.
    library.equip(second.id);
    expect(library.getEquipped().cape).toBe(second.id);
    expect(library.isEquipped(first.id)).toBe(false);
  });

  it('refuses to equip an item the player does not own', () => {
    const library = new MarketplaceLibrary();
    const paid = CATALOG.find((item) => item.priceCoins > 0 && item.slot)!;
    expect(library.equip(paid.id)).toBe(false);
  });

  it('toggles a cosmetic off when it is already equipped', () => {
    const library = new MarketplaceLibrary();
    const cape = CATALOG.find((item) => item.slot === 'cape')!;
    library.grantOwnership(cape.id);
    expect(library.toggleEquip(cape.id)).toBe(true);
    expect(library.toggleEquip(cape.id)).toBe(false);
    expect(library.getEquipped().cape).toBeUndefined();
  });

  it('publishes a creation and makes it purchasable and owned by its author', () => {
    const library = new MarketplaceLibrary();
    const before = library.allItems().length;
    library.publish({
      id: 'creator-1', name: 'My World', creator: 'Me', category: 'worlds',
      priceCoins: 400, description: 'Mine', art: '🌍', tint: '#000',
      downloads: 0, rating: 0, tags: [], official: false, userCreated: true,
    });
    expect(library.allItems().length).toBe(before + 1);
    expect(library.isOwned('creator-1')).toBe(true);
    expect(library.publishedItems()).toHaveLength(1);
  });

  it('persists ownership across instances', () => {
    const first = new MarketplaceLibrary();
    const paid = CATALOG.find((item) => item.priceCoins > 0)!;
    first.grantOwnership(paid.id);
    expect(new MarketplaceLibrary().isOwned(paid.id)).toBe(true);
  });
});

describe('catalog filtering', () => {
  const library = new MarketplaceLibrary(false);

  it('filters by category', () => {
    const capes = filterCatalog(CATALOG, { category: 'capes' });
    expect(capes.length).toBeGreaterThan(0);
    expect(capes.every((item) => item.category === 'capes')).toBe(true);
  });

  it('filters to free items only', () => {
    const free = filterCatalog(CATALOG, { category: 'free' });
    expect(free.every((item) => item.priceCoins === 0)).toBe(true);
  });

  it('searches name, creator and tags', () => {
    expect(filterCatalog(CATALOG, { query: 'aurora' }).length).toBeGreaterThan(0);
    expect(filterCatalog(CATALOG, { query: 'skyward' }).length).toBeGreaterThan(0);
    expect(filterCatalog(CATALOG, { query: 'zzzznope' })).toHaveLength(0);
  });

  it('sorts by price ascending', () => {
    const sorted = filterCatalog(CATALOG, { sort: 'price-low' });
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].priceCoins).toBeGreaterThanOrEqual(sorted[i - 1].priceCoins);
    }
  });

  it('lists only owned items for the library view', () => {
    const paid = CATALOG.find((item) => item.priceCoins > 0)!;
    const owned = filterCatalog(CATALOG, { category: 'owned' }, (id) => id === paid.id);
    expect(owned).toHaveLength(1);
    expect(owned[0].id).toBe(paid.id);
  });

  it('never mutates the array it was given', () => {
    const snapshot = [...CATALOG];
    filterCatalog(CATALOG, { sort: 'price-high' });
    expect(CATALOG).toEqual(snapshot);
  });

  void library;
});

describe('Editor projects', () => {
  it('creates an empty project with sane defaults', () => {
    const project = createEmptyProject('Alex');
    expect(project.meta.author).toBe('Alex');
    expect(project.blocks).toHaveLength(0);
    expect(project.published).toBe(false);
  });

  it('rejects an empty project at publish time', () => {
    const result = validateForPublish(createEmptyProject());
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('accepts a fully filled-in project', () => {
    const project = createEmptyProject('Alex');
    project.meta.name = 'Crystal Caverns';
    project.meta.description = 'A deep cave world full of crystals.';
    project.meta.priceCoins = 500;
    project.blocks.push(createCustomBlock({ name: 'Crystal' }));

    const result = validateForPublish(project);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects a price above the cap or below zero', () => {
    const project = createEmptyProject();
    project.meta.name = 'Valid Name';
    project.meta.description = 'A long enough description.';
    project.blocks.push(createCustomBlock());

    project.meta.priceCoins = 999_999;
    expect(validateForPublish(project).ok).toBe(false);

    project.meta.priceCoins = -5;
    expect(validateForPublish(project).ok).toBe(false);
  });

  it('warns but still allows publishing for free', () => {
    const project = createEmptyProject();
    project.meta.name = 'Free Thing';
    project.meta.description = 'Completely free to use.';
    project.meta.priceCoins = 0;
    project.entities.push(createCustomEntity());

    const result = validateForPublish(project);
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/free/i);
  });

  it('converts a project into a marketplace listing', () => {
    const project = createEmptyProject('Alex');
    project.meta.name = '  Spaced Name  ';
    project.meta.description = ' A description. ';
    project.meta.priceCoins = 750;

    const item = toMarketItem(project);
    expect(item.name).toBe('Spaced Name');
    expect(item.description).toBe('A description.');
    expect(item.priceCoins).toBe(750);
    expect(item.userCreated).toBe(true);
    expect(item.official).toBe(false);
  });

  it('round-trips through export and import', () => {
    const project = createEmptyProject('Alex');
    project.meta.name = 'Round Trip';
    project.blocks.push(createCustomBlock({ name: 'Stone' }));

    const restored = importProject(exportProject(project));
    expect(restored).not.toBeNull();
    expect(restored!.meta.name).toBe('Round Trip');
    expect(restored!.blocks).toHaveLength(1);
    // Re-keyed so importing twice cannot collide.
    expect(restored!.id).not.toBe(project.id);
  });

  it('rejects a file that is not an EAOIN project', () => {
    expect(importProject('{"format":"something-else"}')).toBeNull();
    expect(importProject('not json at all')).toBeNull();
  });
});
