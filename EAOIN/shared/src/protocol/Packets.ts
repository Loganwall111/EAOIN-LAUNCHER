/**
 * Shared Protocol — Binary Packet Definitions
 * Client/server authoritative architecture.
 */
export interface PacketHeader {
  id: number;
  length: number;
  sequence: number;
}

export enum PacketType {
  PlayerMove = 1,
  ChunkData = 2,
  BlockUpdate = 3,
  ChatMessage = 4,
  PlayerJoin = 5,
  PlayerLeave = 6,
  InventorySync = 7,
  WeatherSync = 8,
  DimensionTransfer = 9,
  DimensionRulesSync = 13,
  NetworkAuthority = 14,
  ClientPrediction = 15,
  CommandRequest = 10,
  WorldState = 11,
  AntiCheatHeartbeat = 12,
}

export interface ChunkPacket {
  type: PacketType.ChunkData;
  cx: number;
  cz: number;
  blocks: Uint8Array; // serialized chunk blocks
  seedHash: string;
}

export interface BlockUpdatePacket {
  type: PacketType.BlockUpdate;
  cx: number;
  cy: number;
  cz: number;
  blockId: number;
  timestamp: number;
}
