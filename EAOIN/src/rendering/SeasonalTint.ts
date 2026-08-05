/**
 * Seasons (2.0) — seasons actually shift the world's colours.
 *
 * A lightweight, purely visual seasonal cycle: every SEASON_DURATION_SECONDS
 * of real play time the world advances to the next season, and the grass and
 * leaf block materials are re-tinted so the terrain visibly changes —
 * spring is fresh green, summer is full green, autumn turns the leaves orange
 * and the grass tan, winter goes pale/snowy.
 *
 * The tint works by multiplying each grass/leaf StandardMaterial's diffuse
 * color (white = identity, so nothing changes until a season is applied).
 */
import { Color3 } from '@babylonjs/core';
import { BlockMaterialMap } from './BlockMaterials';
import { decodeSurfaceKey } from './GreedyMesher';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

export const SEASON_EMOJI: Record<Season, string> = {
  spring: '🌱',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
};

/** Real-time length of each season, in seconds. */
export const SEASON_DURATION_SECONDS = 300;

export function seasonForElapsed(elapsedSeconds: number): Season {
  const idx = ((Math.floor(elapsedSeconds / SEASON_DURATION_SECONDS) % 4) + 4) % 4;
  return SEASONS[idx];
}

type RGB = [number, number, number];

/** Multipliers applied to grass-block material diffuse colour per season. */
const GRASS_TINT: Record<Season, RGB> = {
  spring: [0.72, 1.0, 0.55],
  summer: [1.0, 1.0, 1.0],
  autumn: [0.92, 0.84, 0.5],
  winter: [0.88, 0.93, 1.0],
};

/** Multipliers applied to leaf-block material diffuse colour per season. */
const LEAF_TINT: Record<Season, RGB> = {
  spring: [0.7, 1.0, 0.62],
  summer: [1.0, 1.0, 1.0],
  autumn: [1.0, 0.5, 0.15],
  winter: [0.95, 0.97, 1.0],
};

/**
 * Re-tint grass (id 1) and leaf (id 7) block materials for the given season.
 * `leafColorEnabled` gates the leaf recolouring (the "seasonal leaf colour"
 * super-setting); when off, leaves stay their default colour.
 */
export function applySeasonToMaterials(
  materials: BlockMaterialMap,
  season: Season,
  leafColorEnabled: boolean
): void {
  const g = GRASS_TINT[season];
  const l = LEAF_TINT[season];
  for (const [key, mat] of materials) {
    const { blockId } = decodeSurfaceKey(key);
    if (blockId === 1) {
      mat.diffuseColor = new Color3(g[0], g[1], g[2]);
    } else if (blockId === 7) {
      mat.diffuseColor = leafColorEnabled ? new Color3(l[0], l[1], l[2]) : new Color3(1, 1, 1);
    }
  }
}
