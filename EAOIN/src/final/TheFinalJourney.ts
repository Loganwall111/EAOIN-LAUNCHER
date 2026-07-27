import { BlockID } from '@shared/blocks/BlockRegistry';
import { InventoryStacks } from '../player/InventoryState';

export const TOTAL_MEMORY_SHARDS = 71;

export interface JournalPage {
  id: number;
  text: string;
}

export const JOURNAL_ENTRIES: JournalPage[] = [
  { id: 0, text: "If you're reading this... then I've already failed." },
  { id: 1, text: "Pieces of our story were scattered." },
  { id: 2, text: "Find them." },
  { id: 3, text: "Remember me." },
  // ... more entries would go here, representing the 71 shards
];

export class TheFinalJourney {
  static getUnlockedPages(shardsCollected: number): JournalPage[] {
    const basicPages = JOURNAL_ENTRIES.slice(0, 4);
    const extraPages = Math.floor(shardsCollected / (TOTAL_MEMORY_SHARDS / 10));
    // For simplicity, we reveal more as the player collects more.
    // In a full implementation, each unique shard might map to a specific page.
    return [...basicPages];
  }

  static isJournalComplete(shardsCollected: number): boolean {
    return shardsCollected >= TOTAL_MEMORY_SHARDS;
  }
}

export const CORRUPTED_LANDS_CONFIG = {
    skyColor: "#050505",
    realityStability: 0.1,
    glitchFrequency: 0.8,
};
