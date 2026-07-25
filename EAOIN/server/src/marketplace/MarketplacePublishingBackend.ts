export type MarketplaceCategory = 'world' | 'skin' | 'shader' | 'systems' | 'resource-pack';

export interface MarketplaceDraftInput {
  name: string;
  creator: string;
  category: MarketplaceCategory;
  priceCoins: number;
}

export interface MarketplacePublishedItem extends MarketplaceDraftInput {
  id: string;
  publishedAt: number;
  approved: boolean;
  downloads: number;
  revenueCoins: number;
}

export class MarketplacePublishingBackend {
  private readonly items = new Map<string, MarketplacePublishedItem>();

  constructor() {
    this.publishDraft({ name: 'Black Hole Singularity', creator: 'EAOIN Labs', category: 'world', priceCoins: 990 });
    this.publishDraft({ name: 'Space Exploration', creator: 'EAOIN Labs', category: 'world', priceCoins: 850 });
    this.publishDraft({ name: 'Skin Packs + Character Creator', creator: 'EAOIN Labs', category: 'skin', priceCoins: 450 });
    for (const item of this.items.values()) item.approved = true;
  }

  publishDraft(input: MarketplaceDraftInput): MarketplacePublishedItem {
    const id = `${input.creator}-${input.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const item: MarketplacePublishedItem = {
      ...input,
      id,
      publishedAt: Date.now(),
      approved: false,
      downloads: 0,
      revenueCoins: 0,
    };
    this.items.set(id, item);
    return { ...item };
  }

  approve(id: string): boolean {
    const item = this.items.get(id);
    if (!item) return false;
    item.approved = true;
    return true;
  }

  recordDownload(id: string): boolean {
    const item = this.items.get(id);
    if (!item || !item.approved) return false;
    item.downloads += 1;
    item.revenueCoins += item.priceCoins;
    return true;
  }

  snapshot(): { items: MarketplacePublishedItem[]; pending: number; approved: number; grossCoins: number } {
    const items = Array.from(this.items.values()).map((item) => ({ ...item }));
    return {
      items,
      pending: items.filter((item) => !item.approved).length,
      approved: items.filter((item) => item.approved).length,
      grossCoins: items.reduce((sum, item) => sum + item.revenueCoins, 0),
    };
  }
}
