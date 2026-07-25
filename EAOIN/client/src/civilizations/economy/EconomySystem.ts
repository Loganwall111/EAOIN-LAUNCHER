/**
 * EconomySystem — Global Trade, Supply Chains, Currency
 */
export interface TradeItem {
  itemId: string;
  baseValue: number;
  supply: number;
  demand: number;
}

export interface TradeRoute {
  fromVillage: string;
  toVillage: string;
  items: string[];
  volume: number;
  value: number;
}

export class EconomySystem {
  private items = new Map<string, TradeItem>();
  private routes = new Map<string, TradeRoute>();
  private currencyReserve = 10000;

  constructor() {
    this.registerTradeItems();
  }

  private registerTradeItems(): void {
    const items = [
      { itemId: 'wheat', baseValue: 2, supply: 100, demand: 80 },
      { itemId: 'stone', baseValue: 1, supply: 200, demand: 120 },
      { itemId: 'iron_ore', baseValue: 5, supply: 30, demand: 50 },
      { itemId: 'gold_ore', baseValue: 15, supply: 10, demand: 25 },
      { itemId: 'diamond_ore', baseValue: 50, supply: 2, demand: 15 },
    ];
    for (const item of items) {
      this.items.set(item.itemId, item);
    }
    console.log('[Economy] Trade items registered');
  }

  calculatePrice(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) return 0;
    const ratio = item.demand / Math.max(1, item.supply);
    return Math.round(item.baseValue * Math.sqrt(ratio));
  }

  createRoute(from: string, to: string, itemIds: string[], volume: number): TradeRoute {
    const value = itemIds.reduce((acc, id) => acc + this.calculatePrice(id) * volume, 0);
    const route: TradeRoute = {
      fromVillage: from,
      toVillage: to,
      items: itemIds,
      volume,
      value,
    };
    const routeId = `${from}_${to}`;
    this.routes.set(routeId, route);
    this.currencyReserve += value * 0.05; // Tax
    console.log(`[Economy] Trade route created: ${from} → ${to} (${value} value)`);
    return route;
  }

  getCurrencyReserve(): number {
    return this.currencyReserve;
  }

  getRoutes(): TradeRoute[] {
    return Array.from(this.routes.values());
  }
}
