/**
 * MarketplaceCatalog — the item catalog behind the Marketplace screen.
 *
 * Covers every category the store sells: skin packs, capes, gear/cosmetics,
 * mods, worlds, mini-games, shaders and texture packs. Items are either free
 * (placeholders you can play with immediately) or priced in coins.
 *
 * Ownership and creator-published items persist to localStorage.
 */

export type MarketCategory =
  | 'skins'
  | 'capes'
  | 'gear'
  | 'mods'
  | 'worlds'
  | 'minigames'
  | 'shaders'
  | 'textures';

export interface MarketCategoryMeta {
  id: MarketCategory;
  label: string;
  icon: string;
  blurb: string;
}

export const MARKET_CATEGORIES: MarketCategoryMeta[] = [
  { id: 'skins', label: 'Skin Packs', icon: '🧑‍🎨', blurb: 'Character skins and full skin packs.' },
  { id: 'capes', label: 'Capes', icon: '🦸', blurb: 'Flowing capes that render on your avatar.' },
  { id: 'gear', label: 'Gear & Cosmetics', icon: '🎩', blurb: 'Hats, wings, trails, pets and accessories.' },
  { id: 'mods', label: 'Mods', icon: '🧩', blurb: 'Gameplay mods, new systems and content packs.' },
  { id: 'worlds', label: 'Worlds', icon: '🌍', blurb: 'Prebuilt worlds and adventure maps.' },
  { id: 'minigames', label: 'Mini-Games', icon: '🎮', blurb: 'Drop-in game modes and arenas.' },
  { id: 'shaders', label: 'Shaders', icon: '✨', blurb: 'Lighting and post-processing looks.' },
  { id: 'textures', label: 'Texture Packs', icon: '🎨', blurb: 'Reskin every block in the game.' },
];

/** Cosmetic slots a `gear` or `capes` item can occupy on the avatar. */
export type CosmeticSlot = 'cape' | 'hat' | 'wings' | 'trail' | 'pet' | 'aura' | 'skin';

export interface MarketItem {
  id: string;
  name: string;
  creator: string;
  category: MarketCategory;
  /** Price in coins. 0 means free. */
  priceCoins: number;
  description: string;
  /** Emoji/glyph used as the tile art placeholder. */
  art: string;
  /** CSS gradient used behind the tile art. */
  tint: string;
  downloads: number;
  rating: number;
  tags: string[];
  /** Set for wearable items so equipping knows which slot to fill. */
  slot?: CosmeticSlot;
  /** True for first-party content bundled with the game. */
  official: boolean;
  /** True when the item was published from Editor Mode by a player. */
  userCreated?: boolean;
  featured?: boolean;
}

/**
 * The built-in catalog. Free items are genuinely playable placeholders so a
 * player with zero coins still has content to use.
 */
export const CATALOG: MarketItem[] = [
  /* ------------------------------- skin packs ------------------------------ */
  {
    id: 'skins-starter', name: 'Starter Skins', creator: 'EAOIN Labs', category: 'skins',
    priceCoins: 0, description: 'Eight clean starter skins. Free for everyone, forever.',
    art: '🧑', tint: 'linear-gradient(135deg,#4a90d9,#2c5f8d)', downloads: 184_320, rating: 4.6,
    tags: ['free', 'starter'], slot: 'skin', official: true,
  },
  {
    id: 'skins-heroes', name: 'Hero Legends Pack', creator: 'Nova Studio', category: 'skins',
    priceCoins: 660, description: 'Twelve caped heroes and villains with animated visors.',
    art: '🦹', tint: 'linear-gradient(135deg,#c0392b,#7b241c)', downloads: 92_140, rating: 4.8,
    tags: ['heroes', 'animated'], slot: 'skin', official: false, featured: true,
  },
  {
    id: 'skins-mythic', name: 'Mythic Beasts', creator: 'Emberforge', category: 'skins',
    priceCoins: 480, description: 'Dragonkin, griffins and phoenix-touched characters.',
    art: '🐉', tint: 'linear-gradient(135deg,#8e44ad,#4a235a)', downloads: 61_880, rating: 4.5,
    tags: ['fantasy'], slot: 'skin', official: false,
  },

  /* ---------------------------------- capes -------------------------------- */
  {
    id: 'cape-explorer', name: "Explorer's Cape", creator: 'EAOIN Labs', category: 'capes',
    priceCoins: 0, description: 'The classic tan traveller cape. Free starter cosmetic.',
    art: '🧭', tint: 'linear-gradient(135deg,#b9884f,#7a5528)', downloads: 210_400, rating: 4.4,
    tags: ['free'], slot: 'cape', official: true,
  },
  {
    id: 'cape-aurora', name: 'Aurora Cape', creator: 'Skyward', category: 'capes',
    priceCoins: 850, description: 'Shifting northern-lights fabric that glows at night.',
    art: '🌌', tint: 'linear-gradient(135deg,#16a085,#2980b9)', downloads: 48_300, rating: 4.9,
    tags: ['animated', 'glow'], slot: 'cape', official: false, featured: true,
  },
  {
    id: 'cape-ember', name: 'Ember Drift Cape', creator: 'Emberforge', category: 'capes',
    priceCoins: 700, description: 'Trails live embers behind you as you sprint.',
    art: '🔥', tint: 'linear-gradient(135deg,#e67e22,#a04000)', downloads: 37_120, rating: 4.7,
    tags: ['particles'], slot: 'cape', official: false,
  },

  /* ------------------------------ gear/cosmetics --------------------------- */
  {
    id: 'gear-starter-hats', name: 'Everyday Hats', creator: 'EAOIN Labs', category: 'gear',
    priceCoins: 0, description: 'Six free hats: cap, beanie, straw, hard hat, crown, top hat.',
    art: '🎩', tint: 'linear-gradient(135deg,#5d6d7e,#2c3e50)', downloads: 156_900, rating: 4.3,
    tags: ['free'], slot: 'hat', official: true,
  },
  {
    id: 'gear-wings-seraph', name: 'Seraph Wings', creator: 'Skyward', category: 'gear',
    priceCoins: 1_200, description: 'Six-metre feathered wings that animate while flying.',
    art: '🕊', tint: 'linear-gradient(135deg,#f4f6f7,#aeb6bf)', downloads: 71_450, rating: 4.9,
    tags: ['wings', 'animated'], slot: 'wings', official: false, featured: true,
  },
  {
    id: 'gear-trail-stardust', name: 'Stardust Trail', creator: 'Nova Studio', category: 'gear',
    priceCoins: 540, description: 'Leaves a sparkling trail wherever you walk.',
    art: '✨', tint: 'linear-gradient(135deg,#9b59b6,#5b2c6f)', downloads: 88_010, rating: 4.6,
    tags: ['particles'], slot: 'trail', official: false,
  },
  {
    id: 'gear-pet-cube', name: 'Companion Cube Pet', creator: 'Bitwise', category: 'gear',
    priceCoins: 620, description: 'A loyal floating cube that follows you everywhere.',
    art: '🧊', tint: 'linear-gradient(135deg,#48c9b0,#148f77)', downloads: 54_770, rating: 4.5,
    tags: ['pet'], slot: 'pet', official: false,
  },

  /* ---------------------------------- mods --------------------------------- */
  {
    id: 'mod-creator-tools', name: 'Creator Tools', creator: 'EAOIN Labs', category: 'mods',
    priceCoins: 0, description: 'Free building helpers: fill, clone, brush and symmetry tools.',
    art: '🛠', tint: 'linear-gradient(135deg,#7f8c8d,#34495e)', downloads: 133_600, rating: 4.7,
    tags: ['free', 'building'], official: true,
  },
  {
    id: 'mod-deep-caves', name: 'Deep Caves Overhaul', creator: 'Underhollow', category: 'mods',
    priceCoins: 990, description: 'Rewrites cave generation with tunnels, lakes and new ores.',
    art: '🕳', tint: 'linear-gradient(135deg,#4a4a4a,#1c1c1c)', downloads: 102_330, rating: 4.8,
    tags: ['worldgen'], official: false, featured: true,
  },
  {
    id: 'mod-tech-reactors', name: 'Tech & Reactors', creator: 'Bitwise', category: 'mods',
    priceCoins: 1_450, description: 'Power grids, conveyors, reactors and full automation.',
    art: '⚙', tint: 'linear-gradient(135deg,#f39c12,#9a6407)', downloads: 78_220, rating: 4.6,
    tags: ['tech', 'automation'], official: false,
  },

  /* --------------------------------- worlds -------------------------------- */
  {
    id: 'world-sandbox-flats', name: 'Sandbox Flats', creator: 'EAOIN Labs', category: 'worlds',
    priceCoins: 0, description: 'A clean flat world for testing builds. Free placeholder world.',
    art: '🟩', tint: 'linear-gradient(135deg,#58d68d,#1d8348)', downloads: 240_100, rating: 4.2,
    tags: ['free', 'flat'], official: true,
  },
  {
    id: 'world-skyfall', name: 'Skyfall Isles', creator: 'Skyward', category: 'worlds',
    priceCoins: 1_100, description: 'A hand-built floating archipelago with hidden vaults.',
    art: '🏝', tint: 'linear-gradient(135deg,#5dade2,#1a5276)', downloads: 66_940, rating: 4.9,
    tags: ['adventure'], official: false, featured: true,
  },
  {
    id: 'world-ruins', name: 'Ruins of Kaldar', creator: 'Emberforge', category: 'worlds',
    priceCoins: 880, description: 'A ruined city map with a full questline and boss arena.',
    art: '🏛', tint: 'linear-gradient(135deg,#d5b895,#7e6547)', downloads: 45_610, rating: 4.7,
    tags: ['quest'], official: false,
  },

  /* -------------------------------- minigames ------------------------------ */
  {
    id: 'minigame-parkour', name: 'Parkour Rush', creator: 'EAOIN Labs', category: 'minigames',
    priceCoins: 0, description: 'Twenty free timed parkour courses with leaderboards.',
    art: '🏃', tint: 'linear-gradient(135deg,#f1c40f,#b7950b)', downloads: 198_450, rating: 4.5,
    tags: ['free', 'solo'], official: true,
  },
  {
    id: 'minigame-blockwars', name: 'Block Wars', creator: 'Nova Studio', category: 'minigames',
    priceCoins: 760, description: 'Team-vs-team base capture across eight arenas.',
    art: '⚔', tint: 'linear-gradient(135deg,#e74c3c,#922b21)', downloads: 84_300, rating: 4.6,
    tags: ['pvp', 'multiplayer'], official: false,
  },
  {
    id: 'minigame-survival-tower', name: 'Survival Tower', creator: 'Underhollow', category: 'minigames',
    priceCoins: 640, description: 'Climb one hundred floors of escalating waves.',
    art: '🗼', tint: 'linear-gradient(135deg,#af7ac5,#633974)', downloads: 51_880, rating: 4.4,
    tags: ['waves'], official: false,
  },

  /* --------------------------------- shaders ------------------------------- */
  {
    id: 'shader-vanilla-plus', name: 'Vanilla Plus', creator: 'EAOIN Labs', category: 'shaders',
    priceCoins: 0, description: 'Free subtle shader — better shadows, no performance hit.',
    art: '🔆', tint: 'linear-gradient(135deg,#85c1e9,#2874a6)', downloads: 302_770, rating: 4.7,
    tags: ['free', 'performance'], official: true,
  },
  {
    id: 'shader-cinematic-rt', name: 'Cinematic RT', creator: 'Skyward', category: 'shaders',
    priceCoins: 1_350, description: 'Ray-traced-style reflections, volumetric light and HDR bloom.',
    art: '🎬', tint: 'linear-gradient(135deg,#34495e,#17202a)', downloads: 94_120, rating: 4.9,
    tags: ['raytracing', 'hdr'], official: false, featured: true,
  },
  {
    id: 'shader-vaporwave', name: 'Vaporwave Dream', creator: 'Nova Studio', category: 'shaders',
    priceCoins: 690, description: 'Neon magenta grading with chromatic aberration.',
    art: '🌆', tint: 'linear-gradient(135deg,#ff6ec7,#7d3c98)', downloads: 63_540, rating: 4.5,
    tags: ['stylised'], official: false,
  },

  /* ------------------------------ texture packs ---------------------------- */
  {
    id: 'texture-classic-hd', name: 'Classic HD', creator: 'EAOIN Labs', category: 'textures',
    priceCoins: 0, description: 'Free 64x rework of every vanilla block.',
    art: '🧱', tint: 'linear-gradient(135deg,#d98880,#922b21)', downloads: 221_600, rating: 4.6,
    tags: ['free', '64x'], official: true,
  },
  {
    id: 'texture-soft-clay', name: 'Soft Clay', creator: 'Bitwise', category: 'textures',
    priceCoins: 520, description: 'Hand-sculpted matte clay look with soft edges.',
    art: '🏺', tint: 'linear-gradient(135deg,#e59866,#a04000)', downloads: 47_220, rating: 4.4,
    tags: ['stylised'], official: false,
  },
];

/* -------------------------------------------------------------------------- */
/*                                  Library                                   */
/* -------------------------------------------------------------------------- */

const OWNED_KEY = 'eaoin:marketplace:owned:v1';
const EQUIPPED_KEY = 'eaoin:marketplace:equipped:v1';
const PUBLISHED_KEY = 'eaoin:marketplace:published:v1';

export type EquippedCosmetics = Partial<Record<CosmeticSlot, string>>;

/**
 * Tracks which items the player owns, what they have equipped, and any items
 * they published from Editor Mode.
 */
export class MarketplaceLibrary {
  private owned = new Set<string>();
  private equipped: EquippedCosmetics = {};
  private published: MarketItem[] = [];
  private listeners = new Set<() => void>();

  constructor(autoload = true) {
    if (autoload) this.load();
    // Free items are always owned — no purchase step needed.
    for (const item of CATALOG) {
      if (item.priceCoins === 0) this.owned.add(item.id);
    }
  }

  /** Every item in the store: built-in catalog plus player-published items. */
  allItems(): MarketItem[] {
    return [...this.published, ...CATALOG];
  }

  getItem(id: string): MarketItem | undefined {
    return this.allItems().find((item) => item.id === id);
  }

  isOwned(id: string): boolean {
    return this.owned.has(id);
  }

  ownedItems(): MarketItem[] {
    return this.allItems().filter((item) => this.owned.has(item.id));
  }

  /** Mark an item owned. Called after the coins have been debited. */
  grantOwnership(id: string): void {
    this.owned.add(id);
    this.commit();
  }

  getEquipped(): EquippedCosmetics {
    return { ...this.equipped };
  }

  isEquipped(id: string): boolean {
    return Object.values(this.equipped).includes(id);
  }

  /** Equip an owned wearable into its slot. Returns false if not permitted. */
  equip(id: string): boolean {
    const item = this.getItem(id);
    if (!item?.slot || !this.isOwned(id)) return false;
    this.equipped = { ...this.equipped, [item.slot]: id };
    this.commit();
    return true;
  }

  unequip(slot: CosmeticSlot): void {
    const next = { ...this.equipped };
    delete next[slot];
    this.equipped = next;
    this.commit();
  }

  /** Toggle a wearable on/off. */
  toggleEquip(id: string): boolean {
    const item = this.getItem(id);
    if (!item?.slot) return false;
    if (this.equipped[item.slot] === id) {
      this.unequip(item.slot);
      return false;
    }
    return this.equip(id);
  }

  /* ------------------------- creator-published items ------------------------ */

  publishedItems(): MarketItem[] {
    return this.published.map((item) => ({ ...item }));
  }

  /** Publish a creation from Editor Mode to the marketplace. */
  publish(item: MarketItem): MarketItem {
    const entry: MarketItem = { ...item, userCreated: true, official: false };
    this.published = [entry, ...this.published.filter((p) => p.id !== entry.id)];
    this.owned.add(entry.id); // you always own what you made
    this.commit();
    return entry;
  }

  unpublish(id: string): void {
    this.published = this.published.filter((item) => item.id !== id);
    this.commit();
  }

  /* -------------------------------- plumbing -------------------------------- */

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private commit(): void {
    this.save();
    for (const listener of this.listeners) {
      try { listener(); } catch { /* a bad subscriber must not break the library */ }
    }
  }

  private load(): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      const owned = storage.getItem(OWNED_KEY);
      if (owned) this.owned = new Set(JSON.parse(owned) as string[]);
      const equipped = storage.getItem(EQUIPPED_KEY);
      if (equipped) this.equipped = JSON.parse(equipped) as EquippedCosmetics;
      const published = storage.getItem(PUBLISHED_KEY);
      if (published) this.published = JSON.parse(published) as MarketItem[];
    } catch { /* corrupt storage falls back to defaults */ }
  }

  private save(): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(OWNED_KEY, JSON.stringify([...this.owned]));
      storage.setItem(EQUIPPED_KEY, JSON.stringify(this.equipped));
      storage.setItem(PUBLISHED_KEY, JSON.stringify(this.published));
    } catch { /* non-fatal */ }
  }

  reset(): void {
    this.owned = new Set(CATALOG.filter((i) => i.priceCoins === 0).map((i) => i.id));
    this.equipped = {};
    this.published = [];
    this.commit();
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Queries                                    */
/* -------------------------------------------------------------------------- */

export interface CatalogFilter {
  category?: MarketCategory | 'all' | 'owned' | 'free';
  query?: string;
  sort?: 'featured' | 'popular' | 'rating' | 'price-low' | 'price-high' | 'newest';
}

export function filterCatalog(
  items: MarketItem[],
  filter: CatalogFilter,
  isOwned: (id: string) => boolean = () => false
): MarketItem[] {
  let result = [...items];

  if (filter.category === 'owned') {
    result = result.filter((item) => isOwned(item.id));
  } else if (filter.category === 'free') {
    result = result.filter((item) => item.priceCoins === 0);
  } else if (filter.category && filter.category !== 'all') {
    result = result.filter((item) => item.category === filter.category);
  }

  const text = filter.query?.trim().toLowerCase();
  if (text) {
    result = result.filter((item) =>
      item.name.toLowerCase().includes(text) ||
      item.creator.toLowerCase().includes(text) ||
      item.tags.some((tag) => tag.includes(text))
    );
  }

  switch (filter.sort) {
    case 'popular': result.sort((a, b) => b.downloads - a.downloads); break;
    case 'rating': result.sort((a, b) => b.rating - a.rating); break;
    case 'price-low': result.sort((a, b) => a.priceCoins - b.priceCoins); break;
    case 'price-high': result.sort((a, b) => b.priceCoins - a.priceCoins); break;
    case 'newest': result.sort((a, b) => Number(Boolean(b.userCreated)) - Number(Boolean(a.userCreated))); break;
    case 'featured':
    default:
      result.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.downloads - a.downloads);
      break;
  }

  return result;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}
