/**
 * CustomBlockAPI — Modding API for Custom Blocks
 */
import { BlockDef, BlockID, BLOCKS, getBlock } from '@shared/blocks/BlockRegistry';

export interface CustomBlockRegistration {
  blockId: number;
  definition: Partial<BlockDef>;
  registerCallback?: () => void;
}

export class CustomBlockAPI {
  private customBlocks = new Map<BlockID, BlockDef>();

  registerCustomBlock(registration: CustomBlockRegistration): boolean {
    const baseDef = getBlock(registration.blockId);
    const customDef: BlockDef = {
      ...baseDef,
      ...registration.definition,
      id: registration.blockId,
    };
    this.customBlocks.set(registration.blockId, customDef);
    console.log(`[CustomBlockAPI] Registered custom block ID: ${registration.blockId}`);
    if (registration.registerCallback) {
      registration.registerCallback();
    }
    return true;
  }

  getCustomBlock(id: BlockID): BlockDef | null {
    return this.customBlocks.get(id) ?? BLOCKS[id] ?? null;
  }

  getAllCustomBlocks(): BlockDef[] {
    return Array.from(this.customBlocks.values());
  }
}
