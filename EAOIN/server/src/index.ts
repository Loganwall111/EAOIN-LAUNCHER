/**
 * Dedicated Server — EAOIN Multiplayer Replication Backend
 * Server-authoritative simulation with persistent snapshots.
 */
import { IncomingMessage, Server, ServerResponse } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { ReplicationManager } from './replication/ReplicationManager';
import { MarketplacePublishingBackend } from './marketplace/MarketplacePublishingBackend';
import { createPaymentsFromEnv, PaymentsBundle } from './payments/createPaymentsFromEnv';

export class EAOINServer {
  private readonly httpServer = new Server();
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<string, WebSocket>();
  private readonly replication = new ReplicationManager();
  private readonly marketplace = new MarketplacePublishingBackend();
  /** Null when PayPal credentials are absent; the game then runs sandbox coins. */
  private readonly payments: PaymentsBundle | null;
  private tickInterval: NodeJS.Timeout | null = null;
  private readonly tickRate = 20; // 20 TPS

  constructor(private readonly port = 8080) {
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.payments = createPaymentsFromEnv();
    this.setupHttpRoutes();
    this.setupEvents();
  }

  /**
   * Real-money endpoints ride on the same http server as the websocket
   * backend, so a deployment needs one process and one port.
   */
  private setupHttpRoutes(): void {
    this.httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
      void (async () => {
        try {
          if (this.payments && (await this.payments.handleRequest(req, res))) return;
          if (req.url === '/healthz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: true,
              players: this.clients.size,
              payments: this.payments ? this.payments.environment : 'disabled',
            }));
            return;
          }
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (error) {
          console.error('[Server] Request handling failed', error);
          if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal error' }));
        }
      })();
    });
  }

  private setupEvents(): void {
    this.wss.on('connection', (ws, req) => {
      const id = `${req.socket.remoteAddress}:${Math.random().toString(36).slice(2, 9)}`;
      this.clients.set(id, ws);
      this.replication.updatePlayer(id, { x: 0, y: 16, z: 0, dimension: 'overworld' });
      ws.send(JSON.stringify({ type: 'welcome', id, tickRate: this.tickRate }));
      ws.send(JSON.stringify({ type: 'marketplace_snapshot', data: this.marketplace.snapshot() }));
      console.log(`[Server] Client connected: ${id} (total: ${this.clients.size})`);

      ws.on('message', (data) => {
        this.handlePacket(id, data);
      });

      ws.on('close', () => {
        this.clients.delete(id);
        this.replication.removePlayer(id);
        this.broadcast({ type: 'player_leave', id });
        console.log(`[Server] Client disconnected: ${id} (total: ${this.clients.size})`);
      });
    });
  }

  private handlePacket(clientId: string, data: WebSocket.Data): void {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'heartbeat') {
        this.clients.get(clientId)?.send(JSON.stringify({ type: 'heartbeat_ack', time: Date.now() }));
        return;
      }
      if (msg.type === 'player_move') {
        const state = this.replication.updatePlayer(clientId, {
          x: Number(msg.x ?? 0),
          y: Number(msg.y ?? 0),
          z: Number(msg.z ?? 0),
          yaw: Number(msg.yaw ?? 0),
          pitch: Number(msg.pitch ?? 0),
          dimension: String(msg.dimension ?? 'overworld'),
        });
        this.broadcast({ type: 'player_state', state }, clientId);
        return;
      }
      if (msg.type === 'block_update') {
        this.broadcast({ type: 'block_update', source: clientId, update: msg }, clientId);
        return;
      }
      if (msg.type === 'chat' || msg.type === 'command') {
        this.broadcast({ type: msg.type, source: clientId, text: String(msg.text ?? '') });
        return;
      }
      if (msg.type === 'marketplace_publish') {
        const item = this.marketplace.publishDraft({
          name: String(msg.name ?? 'Untitled Pack'),
          creator: String(msg.creator ?? clientId),
          category: msg.category ?? 'world',
          priceCoins: Number(msg.priceCoins ?? 0),
        });
        this.broadcast({ type: 'marketplace_published', item });
      }
    } catch {
      // Binary packets can be decoded by the shared protocol layer later.
    }
  }

  start(): void {
    this.httpServer.listen(this.port, () => {
      console.log(`[Server] EAOIN Dedicated Server listening on port ${this.port}`);
      console.log(`[Server] Tick rate: ${this.tickRate} TPS`);
      if (this.payments) {
        console.log(`[Server] PayPal payments ENABLED (${this.payments.environment}) at /api/payments`);
      } else {
        console.log('[Server] PayPal payments disabled — set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable.');
      }
    });
    this.tickInterval = setInterval(() => this.tick(), 1000 / this.tickRate);
  }

  private tick(): void {
    const snapshot = this.replication.advanceTick();
    this.broadcast({ type: 'replication_snapshot', snapshot });
  }

  broadcast(msg: object, excludeClientId?: string): void {
    const payload = JSON.stringify(msg);
    for (const [id, ws] of this.clients) {
      if (id !== excludeClientId && ws.readyState === ws.OPEN) ws.send(payload);
    }
  }

  stop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    this.clients.clear();
    this.wss.close();
    this.httpServer.close();
    console.log('[Server] EAOIN Dedicated Server stopped');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const srv = new EAOINServer();
  srv.start();
}
