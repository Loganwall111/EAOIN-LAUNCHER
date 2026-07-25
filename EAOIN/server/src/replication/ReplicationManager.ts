export interface ReplicatedPlayerState {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  dimension: string;
  sequence: number;
  updatedAt: number;
}

export interface ReplicationSnapshot {
  tick: number;
  serverTime: number;
  players: ReplicatedPlayerState[];
}

export class ReplicationManager {
  private tick = 0;
  private readonly players = new Map<string, ReplicatedPlayerState>();
  private readonly history: ReplicationSnapshot[] = [];

  updatePlayer(id: string, patch: Partial<ReplicatedPlayerState>): ReplicatedPlayerState {
    const existing = this.players.get(id) ?? {
      id,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      pitch: 0,
      dimension: 'overworld',
      sequence: 0,
      updatedAt: Date.now(),
    };
    const next = { ...existing, ...patch, id, sequence: existing.sequence + 1, updatedAt: Date.now() };
    this.players.set(id, next);
    return next;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  advanceTick(): ReplicationSnapshot {
    this.tick += 1;
    const snapshot = {
      tick: this.tick,
      serverTime: Date.now(),
      players: Array.from(this.players.values()),
    };
    this.history.push(snapshot);
    while (this.history.length > 120) this.history.shift();
    return snapshot;
  }

  getSnapshot(): ReplicationSnapshot {
    return this.history[this.history.length - 1] ?? this.advanceTick();
  }

  getStats(): { players: number; tick: number; snapshots: number } {
    return { players: this.players.size, tick: this.tick, snapshots: this.history.length };
  }
}
