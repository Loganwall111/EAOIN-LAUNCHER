/**
 * EAOIN Engine — Core Game Loop & System Manager
 * Production-quality architecture: ECS + Chunk Streaming + Async Pipeline
 */
export interface System {
  name: string;
  update(deltaTime: number): void;
  init?(): void;
  dispose?(): void;
}

export class GameEngine {
  private systems: System[] = [];
  private running = false;
  private lastTime = 0;
  private tickRate = 20; // 20 TPS server tick

  constructor(private readonly targetFPS = 60) {}

  register(system: System): void {
    this.systems.push(system);
    system.init?.();
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    console.log(
      '[Engine] GameEngine started with',
      this.systems.length,
      'systems at',
      this.targetFPS,
      'FPS target /',
      this.tickRate,
      'TPS'
    );
  }

  stop(): void {
    this.running = false;
    for (const s of this.systems) s.dispose?.();
    console.log('[Engine] GameEngine stopped');
  }

  update(): void {
    if (!this.running) return;
    const now = performance.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    for (const system of this.systems) {
      system.update(delta);
    }
  }

  getSystems(): System[] {
    return [...this.systems];
  }
}
