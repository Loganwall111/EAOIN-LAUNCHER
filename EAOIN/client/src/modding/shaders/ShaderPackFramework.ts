/**
 * ShaderPackFramework — Custom Shader Pack Management
 */
export interface ShaderPackDef {
  packId: string;
  name: string;
  version: string;
  shaders: string[];
  enabled: boolean;
}

export class ShaderPackFramework {
  private packs = new Map<string, ShaderPackDef>();

  registerPack(pack: ShaderPackDef): void {
    this.packs.set(pack.packId, pack);
    console.log(`[ShaderPack] Registered pack: ${pack.name} v${pack.version}`);
  }

  loadShaders(packId: string): string[] {
    const pack = this.packs.get(packId);
    if (!pack || !pack.enabled) return [];
    console.log(`[ShaderPack] Loading shaders for ${pack.name}: ${pack.shaders.length} shaders`);
    return pack.shaders;
  }

  enablePack(packId: string): boolean {
    const pack = this.packs.get(packId);
    if (!pack) return false;
    pack.enabled = true;
    console.log(`[ShaderPack] Enabled: ${pack.name}`);
    return true;
  }
}
