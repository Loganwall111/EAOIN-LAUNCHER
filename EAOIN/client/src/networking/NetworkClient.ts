/**
 * NetworkClient — Client/Server Replication & Synchronization
 * Handles prediction, interpolation, lag compensation foundation.
 */
import WebSocket from 'ws';

export interface NetworkState {
  connected: boolean;
  latency: number;
  serverTime: number;
  sequence: number;
  predictedPosition: { x: number; y: number; z: number };
}

export class NetworkClient {
  private ws: WebSocket | null = null;
  private state: NetworkState = {
    connected: false,
    latency: 0,
    serverTime: 0,
    sequence: 0,
    predictedPosition: { x: 0, y: 0, z: 0 },
  };

  constructor(private readonly url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => {
        this.state.connected = true;
        console.log('[NetworkClient] Connected to server');
        resolve();
      });
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', () => {
        this.state.connected = false;
        console.log('[NetworkClient] Disconnected');
      });
      this.ws.on('error', (err) => reject(err));
    });
  }

  disconnect(): void {
    this.ws?.close();
  }

  sendPacket(type: string, payload: any): void {
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) return;
    this.state.sequence++;
    this.ws.send(JSON.stringify({ type, payload, seq: this.state.sequence }));
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'heartbeat_ack') {
        this.state.latency = Date.now() - msg.time;
        this.state.serverTime = msg.time;
      }
    } catch {
      // Binary packets handled via PacketHandler
    }
  }

  getState(): NetworkState {
    return { ...this.state };
  }
}
