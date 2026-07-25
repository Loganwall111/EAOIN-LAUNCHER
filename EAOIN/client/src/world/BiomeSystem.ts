/**
 * Biome System — Data-driven biome definitions
 */
export interface BiomeDef {
  id: string;
  name: string;
  temperature: number;
  humidity: number;
  color: [number, number, number];
}

export const BIOMES: Record<string, BiomeDef> = {
  plains: { id: 'plains', name: 'Plains', temperature: 0.5, humidity: 0.5, color: [0.3, 0.6, 0.2] },
  forest: { id: 'forest', name: 'Forest', temperature: 0.4, humidity: 0.7, color: [0.15, 0.45, 0.15] },
  mountain: { id: 'mountain', name: 'Mountain', temperature: 0.2, humidity: 0.3, color: [0.5, 0.5, 0.55] },
  ocean: { id: 'ocean', name: 'Ocean', temperature: 0.6, humidity: 1.0, color: [0.1, 0.2, 0.4] },
  desert: { id: 'desert', name: 'Desert', temperature: 0.9, humidity: 0.1, color: [0.9, 0.75, 0.3] },
  jungle: { id: 'jungle', name: 'Jungle', temperature: 0.8, humidity: 0.9, color: [0.1, 0.35, 0.15] },
  snow: { id: 'snow', name: 'Snowy Plains', temperature: 0.0, humidity: 0.4, color: [0.9, 0.95, 1.0] },
};

export function getBiome(id: string): BiomeDef {
  return BIOMES[id] ?? BIOMES['plains'];
}
