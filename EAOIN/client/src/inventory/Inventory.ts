/**
 * Inventory — Player storage with drag/drop, stacking, sorting
 */
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';

export interface InventorySlot {
  itemId: BlockID;
  count: number;
  maxStack: number;
}

export interface InventoryState {
  slots: InventorySlot[];
  hotbarIndex: number;
  selectedSlot: number;
}

export class Inventory {
  private state: InventoryState;
  private readonly size = 36; // 4 rows of 9

  constructor() {
    this.state = {
      slots: Array.from({ length: this.size }, () => ({ itemId: 0, count: 0, maxStack: 64 })),
      hotbarIndex: 27, // Start of hotbar
      selectedSlot: 0,
    };
  }

  addItem(itemId: BlockID, count: number): boolean {
    // Try to stack first
    for (const slot of this.state.slots) {
      if (slot.itemId === itemId && slot.count < slot.maxStack) {
        const add = Math.min(count, slot.maxStack - slot.count);
        slot.count += add;
        count -= add;
        if (count <= 0) return true;
      }
    }
    // Find empty slot
    for (const slot of this.state.slots) {
      if (slot.itemId === 0) {
        slot.itemId = itemId;
        slot.count = Math.min(count, slot.maxStack);
        return true;
      }
    }
    return false; // Full
  }

  removeItem(itemId: BlockID, count: number): number {
    let removed = 0;
    for (const slot of this.state.slots) {
      if (slot.itemId === itemId) {
        const take = Math.min(slot.count, count - removed);
        slot.count -= take;
        removed += take;
        if (slot.count <= 0) slot.itemId = 0;
        if (removed >= count) break;
      }
    }
    return removed;
  }

  getSlot(index: number): InventorySlot {
    return { ...this.state.slots[index] };
  }

  getHotbar(): InventorySlot[] {
    return this.state.slots.slice(this.state.hotbarIndex, this.state.hotbarIndex + 9);
  }

  selectHotbar(index: number): void {
    this.state.selectedSlot = index;
  }

  getState(): InventoryState {
    return { ...this.state, slots: this.state.slots.map(s => ({ ...s })) };
  }
}
