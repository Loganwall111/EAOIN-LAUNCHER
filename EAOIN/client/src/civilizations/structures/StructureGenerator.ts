/**
 * StructureGenerator — Building Generation for Villages/Civilizations
 */
export interface StructureDef {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  size: { width: number; height: number; depth: number };
  materials: Record<string, number>;
  completed: boolean;
}

export class StructureGenerator {
  private structures = new Map<string, StructureDef>();

  generateStructure(type: string, position: { x: number; y: number; z: number }): StructureDef {
    const structure: StructureDef = {
      id: `structure_${type}_${position.x}_${position.z}`,
      type,
      position,
      size: { width: 6, height: 4, depth: 6 },
      materials: { wood: 15, stone: 20, leaves: 8 },
      completed: false,
    };
    this.structures.set(structure.id, structure);
    console.log(`[StructureGen] Generated ${type} at ${position.x},${position.z}`);
    return structure;
  }

  completeStructure(id: string): boolean {
    const s = this.structures.get(id);
    if (!s || s.completed) return false;
    s.completed = true;
    console.log(`[StructureGen] Completed: ${id}`);
    return true;
  }

  getStructures(): StructureDef[] {
    return Array.from(this.structures.values());
  }
}
