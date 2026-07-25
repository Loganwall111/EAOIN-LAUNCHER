/**
 * Network Manager — Packet Registry, Serialization, Anti-Cheat Foundation
 */
import { PacketType, ChunkPacket, BlockUpdatePacket } from '@shared/protocol/Packets';

export class PacketRegistry {
  private handlers = new Map<number, (data: any) => void>();

  register(type: PacketType, handler: (data: any) => void): void {
    this.handlers.set(type, handler);
  }

  handle(type: number, data: any): void {
    const handler = this.handlers.get(type);
    if (handler) handler(data);
    else console.warn(`[Network] No handler for packet type: ${type}`);
  }

  serializeChunk(chunk: ChunkPacket): ArrayBuffer {
    const encoder = new TextEncoder();
    const header = new Uint32Array([
      chunk.type,
      chunk.cx,
      chunk.cz,
      chunk.blocks.length,
    ]);
    return this.concatBuffers(header.buffer, chunk.blocks.buffer);
  }

  private concatBuffers(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
    const combined = new Uint8Array(a.byteLength + b.byteLength);
    combined.set(new Uint8Array(a), 0);
    combined.set(new Uint8Array(b), a.byteLength);
    return combined.buffer;
  }
}

export interface NetworkConfig {
  serverUrl: string;
  tickRate: number;
  compression: boolean;
  binarySerialization: boolean;
  antiCheatEnabled: boolean;
}

export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  serverUrl: 'ws://localhost:8080',
  tickRate: 20,
  compression: true,
  binarySerialization: true,
  antiCheatEnabled: true,
};
