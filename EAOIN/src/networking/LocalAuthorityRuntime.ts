/** Local multiplayer-authority scaffold: deterministic client id, ticks, ping, packet stats, sync status. */
export interface LocalAuthorityStatus {
  clientId: string;
  ping: number;
  jitter: number;
  ticks: number;
  localActions: number;
  remotePlayers: number;
  outboundPackets: number;
  inboundPackets: number;
  packetLoss: number;
  snapshotBuffer: number;
  rollbackEvents: number;
  predictionError: number;
  syncQuality: number;
  syncState: 'green' | 'yellow' | 'red';
  mode: 'local-authoritative';
}

export class LocalAuthorityRuntime {
  private elapsed = 0;
  private ticks = 0;
  private localActions = 0;
  private ping = 18;
  private jitter = 0;
  private outboundPackets = 0;
  private inboundPackets = 0;
  private packetLoss = 0;
  private snapshotBuffer = 4;
  private rollbackEvents = 0;
  private predictionError = 0;
  private remotePlayers = 1;
  private readonly clientId: string;

  constructor(seed: string) {
    this.clientId = `local-${this.hash(seed).toString(16).slice(0, 6)}`;
    this.remotePlayers = 1 + (this.hash(`${seed}:remote`) % 3);
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    while (this.elapsed >= 0.05) {
      this.elapsed -= 0.05;
      this.ticks += 1;
      const previousPing = this.ping;
      this.ping = 18 + Math.round(Math.sin(this.ticks * 0.08) * 4 + Math.cos(this.ticks * 0.031) * 3);
      this.jitter = Math.abs(this.ping - previousPing);
      this.outboundPackets += 1 + (this.localActions % 2);
      this.inboundPackets += 1 + (this.remotePlayers > 1 ? 1 : 0);
      this.packetLoss = Math.max(0, Number((0.8 + Math.sin(this.ticks * 0.017) * 0.8).toFixed(2)));
      this.snapshotBuffer = 3 + Math.round(Math.sin(this.ticks * 0.021) * 2 + this.remotePlayers);
      this.predictionError = Math.max(0, Number((this.packetLoss * 0.25 + this.jitter * 0.08).toFixed(2)));
      if (this.predictionError > 1.2 && this.ticks % 60 === 0) this.rollbackEvents += 1;
    }
  }

  recordAction(): void {
    this.localActions += 1;
    this.outboundPackets += 2;
    this.predictionError = Math.max(0, this.predictionError + 0.05);
  }

  getStatus(): LocalAuthorityStatus {
    const syncQuality = Math.max(0, Math.min(100, Math.round(100 - this.packetLoss * 18 - this.jitter * 2 - this.predictionError * 7)));
    return {
      clientId: this.clientId,
      ping: Math.max(1, this.ping),
      jitter: this.jitter,
      ticks: this.ticks,
      localActions: this.localActions,
      remotePlayers: this.remotePlayers,
      outboundPackets: this.outboundPackets,
      inboundPackets: this.inboundPackets,
      packetLoss: this.packetLoss,
      snapshotBuffer: this.snapshotBuffer,
      rollbackEvents: this.rollbackEvents,
      predictionError: this.predictionError,
      syncQuality,
      syncState: syncQuality > 78 ? 'green' : syncQuality > 50 ? 'yellow' : 'red',
      mode: 'local-authoritative',
    };
  }

  private hash(value: string): number {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
}
