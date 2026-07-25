/**
 * PacketHandler — Client-side binary packet decoding
 */
import { PacketType, ChunkPacket, BlockUpdatePacket } from '@shared/protocol/Packets';

export class PacketHandler {
  private chunkCallback?: (pkt: ChunkPacket) => void;
  private blockUpdateCallback?: (pkt: BlockUpdatePacket) => void;
  private chatCallback?: (msg: any) => void;

  registerChunkHandler(cb: (pkt: ChunkPacket) => void): void {
    this.chunkCallback = cb;
  }
  registerBlockUpdateHandler(cb: (pkt: BlockUpdatePacket) => void): void {
    this.blockUpdateCallback = cb;
  }
  registerChatHandler(cb: (msg: any) => void): void {
    this.chatCallback = cb;
  }

  handlePacket(type: PacketType, data: any): void {
    switch (type) {
      case PacketType.ChunkData:
        this.chunkCallback?.(data as ChunkPacket);
        break;
      case PacketType.BlockUpdate:
        this.blockUpdateCallback?.(data as BlockUpdatePacket);
        break;
      case PacketType.ChatMessage:
        this.chatCallback?.(data);
        break;
      default:
        console.log(`[PacketHandler] Received type ${type}`, data);
    }
  }
}
