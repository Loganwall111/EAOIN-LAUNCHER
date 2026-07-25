/**
 * CustomDimensionModdingAPI — API for Custom Dimensions
 */
import { DimensionDef } from '@client/dimensions/DimensionManager';

export class CustomDimensionModdingAPI {
  private customDimensions = new Map<string, DimensionDef>();

  registerDimension(def: DimensionDef): boolean {
    this.customDimensions.set(def.id, def);
    console.log(`[CustomDimensionAPI] Registered dimension: ${def.id}`);
    return true;
  }

  getDimension(id: string): DimensionDef | null {
    return this.customDimensions.get(id) ?? null;
  }

  listCustomDimensions(): DimensionDef[] {
    return Array.from(this.customDimensions.values());
  }
}
