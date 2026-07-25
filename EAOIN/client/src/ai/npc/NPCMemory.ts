/**
 * NPC Memory — Remember player actions, relationships, events
 */
export interface MemoryEntry {
  event: string;
  importance: number; // 0-1
  timestamp: number;
  emotionalTag: 'positive' | 'negative' | 'neutral';
}

export class NPCMemory {
  private memories: MemoryEntry[] = [];
  private maxMemories = 100;

  record(event: string, importance: number, emotionalTag: MemoryEntry['emotionalTag'] = 'neutral'): void {
    this.memories.push({ event, importance, timestamp: Date.now(), emotionalTag });
    if (this.memories.length > this.maxMemories) {
      // Remove least important
      this.memories.sort((a, b) => a.importance - b.importance);
      this.memories = this.memories.slice(-this.maxMemories);
    }
    console.log(`[NPCMemory] Recorded: ${event} (${emotionalTag})`);
  }

  recall(eventType: string, limit = 5): MemoryEntry[] {
    return this.memories
      .filter(m => m.event.includes(eventType))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  getRelationshipScore(playerId: string): number {
    const relevant = this.memories.filter(m => m.event.includes(playerId));
    if (relevant.length === 0) return 0.5; // Neutral
    const sum = relevant.reduce((acc, m) => {
      const modifier = m.emotionalTag === 'positive' ? 1 : m.emotionalTag === 'negative' ? -1 : 0;
      return acc + m.importance * modifier;
    }, 0);
    return Math.max(0, Math.min(1, 0.5 + sum / 10));
  }
}
