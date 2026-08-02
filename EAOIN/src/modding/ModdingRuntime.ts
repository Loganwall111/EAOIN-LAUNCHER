import { GameSettings, TexturePackID } from '../settings/GameSettings';
import { ModPackRegistry } from './ModPackRegistry';

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
  private registry: ModPackRegistry | null = null;

  /** Attach the shared mod registry so enabled mods actually take effect. */
  attachRegistry(registry: ModPackRegistry): void {
    this.registry = registry;
    this.loadedMods = registry.getTotalEnabled();
  }

  registerMockPack(): void {
    this.loadedMods = Math.max(this.loadedMods, 1);
  }

  /**
   * The extra item/block ids granted by every currently-enabled mod. The
   * starter inventory adds these so enabling a content mod "actually works"
   * in-game instead of being a placeholder toggle.
   */
  grantedBlockIds(): number[] {
    if (!this.registry) return [];
    const ids = new Set<number>();
    for (const mod of this.registry.list()) {
      if (!mod.enabled) continue;
      for (const block of mod.adds.blocks ?? []) ids.add(block.id);
      for (const item of mod.adds.items ?? []) ids.add(item);
    }
    return Array.from(ids);
  }

  /** Any custom commands exposed by enabled mods (mirrored into the CLI). */
  extraCommands(): string[] {
    if (!this.registry) return [];
    const cmds = new Set<string>();
    for (const mod of this.registry.list()) {
      if (mod.enabled) for (const c of mod.adds.commands ?? []) cmds.add(c);
    }
    return Array.from(cmds);
  }

  getStatus(settings: GameSettings): ModdingRuntimeStatus {
    const enabled = this.registry ? this.registry.getTotalEnabled() : this.loadedMods;
    return {
      apiVersion: MODDING_API.apiVersion,
      loadedMods: Math.max(this.loadedMods, enabled),
      texturePack: settings.texturePack,
      shaderExperimental: settings.experimentalShaders,
      commandBlocksEnabled: settings.commandBlocksEnabled,
      resourcePacksEnabled: true,
    };
  }
}
