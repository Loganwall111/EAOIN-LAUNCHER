/**
 * ResourcePackFramework — Resource Pack Loading & Management
 */
export interface ResourcePackDef {
  packId: string;
  name: string;
  version: string;
  formatVersion: number;
  assets: string[]; // file paths
  enabled: boolean;
}

export class ResourcePackFramework {
  private packs = new Map<string, ResourcePackDef>();

  registerPack(pack: ResourcePackDef): void {
    this.packs.set(pack.packId, pack);
    console.log(`[ResourcePack] Registered pack: ${pack.name} v${pack.version}`);
  }

  loadAssets(packId: string): string[] {
    const pack = this.packs.get(packId);
    if (!pack || !pack.enabled) return [];
    console.log(`[ResourcePack] Loading assets for ${pack.name}: ${pack.assets.length} files`);
    return pack.assets;
  }

  enablePack(packId: string): boolean {
    const pack = this.packs.get(packId);
    if (!pack) return false;
    pack.enabled = true;
    console.log(`[ResourcePack] Enabled: ${pack.name}`);
    return true;
  }

  disablePack(packId: string): boolean {
    const pack = this.packs.get(packId);
    if (!pack) return false;
    pack.enabled = false;
    console.log(`[ResourcePack] Disabled: ${pack.name}`);
    return true;
  }

  getPacks(): ResourcePackDef[] {
    return Array.from(this.packs.values());
  }
}
