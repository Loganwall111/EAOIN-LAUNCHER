/**
 * RemotePlayer — Replicated remote entity representation
 */
export interface RemotePlayerData {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  health: number;
  name: string;
  timestamp: number;
}

export class RemotePlayer {
  private data: RemotePlayerData;

  constructor(id: string, name: string) {
    this.data = {
      id,
      name,
      position: { x: 0, y: 8, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      timestamp: Date.now(),
    };
  }

  updateFromServer(data: Partial<RemotePlayerData>): void {
    this.data = { ...this.data, ...data, timestamp: Date.now() };
  }

  interpolateTo(target: RemotePlayerData, alpha: number): RemotePlayerData {
    return {
      ...this.data,
      position: {
        x: this.data.position.x + (target.position.x - this.data.position.x) * alpha,
        y: this.data.position.y + (target.position.y - this.data.position.y) * alpha,
        z: this.data.position.z + (target.position.z - this.data.position.z) * alpha,
      },
    };
  }

  getData(): RemotePlayerData {
    return { ...this.data };
  }
}
