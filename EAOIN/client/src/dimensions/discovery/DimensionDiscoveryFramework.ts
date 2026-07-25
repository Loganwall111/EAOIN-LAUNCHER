/**
 * DimensionDiscoveryFramework — Player Proximity Detection & Exploration Status
 */
import { AncientStructureGenerator, AncientStructureDef } from '../structures/AncientStructureGenerator';

export class DimensionDiscoveryFramework {
  constructor(private structureGenerator: AncientStructureGenerator) {}

  checkPlayerProximity(playerPos: { x: number; y: number; z: number }, dimensionId: string): AncientStructureDef[] {
    const structures = this.structureGenerator.getStructuresByDimension(dimensionId).filter(s => s.discoveryStatus === 'undiscovered');
    const discovered: AncientStructureDef[] = [];
    for (const s of structures) {
      const dx = Math.abs(s.position.x - playerPos.x);
      const dz = Math.abs(s.position.z - playerPos.z);
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance < 10) {
        this.structureGenerator.discoverStructure(s.id);
        discovered.push(s);
        console.log(`[Discovery] Player near structure: ${s.id}`);
      }
    }
    return discovered;
  }

  exploreStructureFromPlayer(structureId: string): boolean {
    return !!this.structureGenerator.exploreStructure(structureId);
  }
}
