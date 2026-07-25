/**
 * Chat Manager — Text & Voice Chat Hooks for Multiplayer
 */
export interface ChatMessage {
  sender: string;
  content: string;
  timestamp: number;
  channel: 'global' | 'local' | 'party';
}

export class ChatManager {
  private messages: ChatMessage[] = [];
  private channels = ['global', 'local', 'party'];

  send(message: ChatMessage): ChatMessage[] {
    this.messages.push(message);
    console.log(`[Chat] ${message.sender}: ${message.content}`);
    return [...this.messages];
  }

  getHistory(channel: string = 'global', limit = 50): ChatMessage[] {
    return this.messages.filter(m => m.channel === channel).slice(-limit);
  }

  clear(): void {
    this.messages = [];
  }
}
