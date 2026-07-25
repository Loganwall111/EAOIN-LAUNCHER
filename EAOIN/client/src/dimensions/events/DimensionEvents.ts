/**
 * DimensionEvents — Reality-Specific Dynamic Events
 */
export interface DimensionEventDef {
  id: string;
  dimensionId: string;
  eventType: 'storm' | 'distortion' | 'merge' | 'growth';
  duration: number; // ticks
  effects: string[];
  probability: number;
}

export class DimensionEventSystem {
  private events = new Map<string, DimensionEventDef>();
  private activeEvents = new Map<string, { event: DimensionEventDef; remaining: number }>();

  registerEvent(event: DimensionEventDef): void {
    this.events.set(event.id, event);
  }

  tick(dimensionId: string): string[] {
    const effects: string[] = [];
    // Random event trigger
    if (Math.random() < 0.02) {
      const candidates = Array.from(this.events.values()).filter(e => e.dimensionId === dimensionId);
      if (candidates.length > 0) {
        const event = candidates[Math.floor(Math.random() * candidates.length)];
        this.activeEvents.set(event.id, { event, remaining: event.duration });
        effects.push(`Event started: ${event.eventType}`);
      }
    }

    // Tick active events
    for (const [id, state] of Array.from(this.activeEvents.entries())) {
      state.remaining--;
      effects.push(`Event ${state.event.eventType}: ${state.remaining} ticks remaining`);
      if (state.remaining <= 0) {
        this.activeEvents.delete(id);
        effects.push(`Event ${state.event.eventType} ended`);
      }
    }
    return effects;
  }

  getActiveEvents(): DimensionEventDef[] {
    return Array.from(this.activeEvents.values()).map(s => s.event);
  }
}
