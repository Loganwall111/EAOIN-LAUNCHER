/**
 * PortalSystem — Dimension Travel Foundation
 */
import { DimensionManager } from './DimensionManager';

export interface PortalData {
  id: string;
  position: { x: number; y: number; z: number };
  destinationDimension: string;
  destinationPosition: { x: number; y: number; z: number };
  active: boolean;
  cooldown: number;
}

export class PortalSystem {
  private portals = new Map<string, PortalData>();

  constructor(private dimensionManager: DimensionManager) {}

  createPortal(portal: PortalData): void {
    this.portals.set(portal.id, portal);
    console.log(`[Portal] Created portal ${portal.id} to ${portal.destinationDimension}`);
  }

  activatePortal(id: string): boolean {
    const portal = this.portals.get(id);
    if (!portal || !portal.active || portal.cooldown > 0) return false;
    portal.cooldown = 60; // 3 second cooldown at 20 TPS
    const instance = this.dimensionManager.loadDimension(portal.destinationDimension);
    return !!instance;
  }

  tick(): void {
    for (const portal of this.portals.values()) {
      if (portal.cooldown > 0) portal.cooldown--;
    }
  }

  getPortals(): PortalData[] {
    return Array.from(this.portals.values());
  }
}
