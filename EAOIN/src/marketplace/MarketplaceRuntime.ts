export interface MarketplacePack {
  id: string;
  name: string;
  creator: string;
  category: 'world' | 'skin' | 'shader' | 'systems';
  priceCoins: number;
  downloads: number;
  published: boolean;
}

export interface MarketplaceStatus {
  packs: number;
  publishedPacks: number;
  creatorToolsOnline: boolean;
  pendingReviews: number;
  grossCoins: number;
}

export class MarketplaceRuntime {
  private readonly packs: MarketplacePack[] = [
    { id: 'black-hole-singularity', name: 'Black Hole Singularity', creator: 'EAOIN Labs', category: 'world', priceCoins: 990, downloads: 1240, published: true },
    { id: 'space-exploration', name: 'Space Exploration', creator: 'EAOIN Labs', category: 'world', priceCoins: 850, downloads: 980, published: true },
    { id: 'skin-character-creator', name: 'Skin Packs + Character Creator', creator: 'EAOIN Labs', category: 'skin', priceCoins: 450, downloads: 2100, published: true },
  ];
  private pendingReviews = 1;

  publishDraft(name: string, creator = 'Local Creator'): MarketplacePack {
    const pack: MarketplacePack = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      creator,
      category: 'systems',
      priceCoins: 0,
      downloads: 0,
      published: false,
    };
    this.packs.push(pack);
    this.pendingReviews += 1;
    return pack;
  }

  approveAll(): void {
    for (const pack of this.packs) pack.published = true;
    this.pendingReviews = 0;
  }

  getPacks(): MarketplacePack[] {
    return this.packs.map((pack) => ({ ...pack }));
  }

  getStatus(): MarketplaceStatus {
    return {
      packs: this.packs.length,
      publishedPacks: this.packs.filter((pack) => pack.published).length,
      creatorToolsOnline: true,
      pendingReviews: this.pendingReviews,
      grossCoins: this.packs.reduce((sum, pack) => sum + pack.downloads * pack.priceCoins, 0),
    };
  }
}
export const MARKET_CATEGORIES = ['world', 'skin', 'shader', 'systems', 'texture', 'dlc', 'modpack', 'music'];
