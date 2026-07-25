import { TexturePackID } from '../settings/GameSettings';

export interface ResourcePackManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  texturePack: TexturePackID;
  blocks: string[];
  commands: string[];
  shaders: string[];
}

export interface ResourcePackLoaderStatus {
  loadedPacks: number;
  activeTexturePack: TexturePackID;
  registeredBlocks: number;
  registeredCommands: number;
  shaderPacks: number;
  hotReloadReady: boolean;
}

export class ResourcePackLoader {
  private readonly packs: ResourcePackManifest[] = [];

  loadPack(manifest: ResourcePackManifest): void {
    const existing = this.packs.findIndex((pack) => pack.id === manifest.id);
    if (existing >= 0) this.packs.splice(existing, 1, manifest);
    else this.packs.push(manifest);
  }

  loadBuiltinPacks(): void {
    this.loadPack({
      id: 'eaoin-classic-soft-vibrant-noir',
      name: 'EAOIN Built-in Texture Packs',
      version: '3.1.0',
      author: 'EAOIN Team',
      texturePack: 'classic',
      blocks: ['Logic Wire', 'Signal Lamp', 'Portal Core', 'Command Block', 'Moon Rock'],
      commands: ['/day', '/time', '/summon', '/shader', '/texture'],
      shaders: ['ReleaseToLifeWebGPU', 'NextGenSky', 'MoonRuntime'],
    });
  }

  getStatus(activeTexturePack: TexturePackID): ResourcePackLoaderStatus {
    return {
      loadedPacks: this.packs.length,
      activeTexturePack,
      registeredBlocks: this.packs.reduce((sum, pack) => sum + pack.blocks.length, 0),
      registeredCommands: this.packs.reduce((sum, pack) => sum + pack.commands.length, 0),
      shaderPacks: this.packs.reduce((sum, pack) => sum + pack.shaders.length, 0),
      hotReloadReady: true,
    };
  }
}
