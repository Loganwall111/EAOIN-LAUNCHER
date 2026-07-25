/**
 * AncientStructureGenerator — Dimension Structures Framework
 */
export interface AncientStructureDef {
  id: string;
  dimensionId: string;
  structureType: 'temple' | 'machine' | 'gateway' | 'ruin';
  position: { x: number; y: number; z: number };
  discoveryStatus: 'undiscovered' | 'discovered' | 'explored';
  technologyLevel: number; // 0-1
  loreEntries: string[];
}

export class AncientStructureGenerator {
  private structures = new Map<string, AncientStructureDef>();

  generateStructure(dimensionId: string, seed: string, type: AncientStructureDef['structureType']): AncientStructureDef {
    const structure: AncientStructureDef = {
      id: `ancient_${type}_${seed.slice(0, 6)}`,
      dimensionId,
      structureType: type,
      position: {
        x: Math.floor(Math.random() * 500) - 250,
        y: 64,
        z: Math.floor(Math.random() * 500) - 250,
      },
      discoveryStatus: 'undiscovered',
      technologyLevel: 0.3 + Math.random() * 0.7,
      loreEntries: [
        'Ancient civilization once thrived here.',
        'Strange energy signatures detected.',
      ],
    };
    this.structures.set(structure.id, structure);
    console.log(`[AncientStructure] Generated ${type}: ${structure.id} in ${dimensionId}`);
    return structure;
  }

  discoverStructure(id: string): AncientStructureDef | null {
    const s = this.structures.get(id);
    if (!s) return null;
    s.discoveryStatus = 'discovered';
    console.log(`[AncientStructure] Discovered: ${id}`);
    return s;
  }

  exploreStructure(id: string): AncientStructureDef | null {
    const s = this.structures.get(id);
    if (!s || s.discoveryStatus === 'undiscovered') return null;
    s.discoveryStatus = 'explored';
    console.log(`[AncientStructure] Explored: ${id}`);
    return s;
  }

  getStructuresByDimension(dimensionId: string): AncientStructureDef[] {
    return Array.from(this.structures.values()).filter(s => s.dimensionId === dimensionId);
  }
}
