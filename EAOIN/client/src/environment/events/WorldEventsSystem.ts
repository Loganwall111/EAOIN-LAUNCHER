// EAOIN Next-Gen World Events System
export class WorldEventsSystem {
  triggerEvent(type: string) {
    console.log(`[EAOIN] World Event Triggered: ${type}`);
    window.dispatchEvent(new CustomEvent('eaoin:world-event', { detail: { type } }));
  }

  scheduleRandomEvent() {
    const events = ['meteor_shower', 'eclipse', 'volcano_eruption', 'tornado', 'flood'];
    const chosen = events[Math.floor(Math.random() * events.length)];
    setTimeout(() => this.triggerEvent(chosen), 30000 + Math.random() * 120000);
  }
}
