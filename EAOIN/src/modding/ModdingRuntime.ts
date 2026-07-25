import { GameSettings, TexturePackID } from '../settings/GameSettings';

export interface ModdingRuntimeStatus {
  apiVersion: string;
  loadedMods: number;
  texturePack: TexturePackID;
  shaderExperimental: boolean;
  commandBlocksEnabled: boolean;
  resourcePacksEnabled: boolean;
}

export const MODDING_API = {
  apiVersion: '2.0.0-release-to-life',
  capabilities: [
    'registerBlockDefinition',
    'registerRecipe',
    'registerCommand',
    'registerTexturePack',
    'registerShaderToggle',
    'subscribeWorldEvent',
  ],
};

export class ModdingRuntime {
  private loadedMods = 0;

  registerMockPack(): void {
    this.loadedMods = Math.max(this.loadedMods, 1);
  }

  getStatus(settings: GameSettings): ModdingRuntimeStatus {
    return {
      apiVersion: MODDING_API.apiVersion,
      loadedMods: this.loadedMods,
      texturePack: settings.texturePack,
      shaderExperimental: settings.experimentalShaders,
      commandBlocksEnabled: settings.commandBlocksEnabled,
      resourcePacksEnabled: true,
    };
  }
}
