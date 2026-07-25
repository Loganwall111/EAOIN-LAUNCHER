/**
 * TradingSystem — NPC ↔ Player Trading Foundation
 */
import { EconomySystem } from '../civilizations/economy/EconomySystem';

export interface TradeOffer {
  traderId: string;
  offeredItems: Record<string, number>;
  requestedItems: Record<string, number>;
  accepted: boolean;
  timestamp: number;
}

export class TradingSystem {
  private offers = new Map<string, TradeOffer>();

  constructor(private economy: EconomySystem) {}

  createOffer(traderId: string, offered: Record<string, number>, requested: Record<string, number>): TradeOffer {
    const offer: TradeOffer = {
      traderId,
      offeredItems: offered,
      requestedItems: requested,
      accepted: false,
      timestamp: Date.now(),
    };
    const offerId = `${traderId}_${Date.now()}`;
    this.offers.set(offerId, offer);
    console.log(`[Trading] Offer from ${traderId}: offered ${Object.keys(offered).join(',')}`);
    return offer;
  }

  acceptOffer(offerId: string, playerId: string): boolean {
    const offer = this.offers.get(offerId);
    if (!offer) return false;
    offer.accepted = true;
    // Deduct from player inventory (would connect to Inventory system)
    console.log(`[Trading] ${playerId} accepted trade from ${offer.traderId}`);
    return true;
  }

  rejectOffer(offerId: string): boolean {
    const offer = this.offers.get(offerId);
    if (!offer) return false;
    this.offers.delete(offerId);
    console.log(`[Trading] Offer ${offerId} rejected`);
    return true;
  }

  getPendingOffers(traderId?: string): TradeOffer[] {
    const offers = Array.from(this.offers.values()).filter(o => !o.accepted);
    return traderId ? offers.filter(o => o.traderId === traderId) : offers;
  }
}
