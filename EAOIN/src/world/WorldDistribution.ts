/**
 * WorldDistribution — central coordinate offset system for major assets.
 * De-clutters spawn zone by spreading objectives across grid.
 * Dynamically jittered by seed so every seed feels open but not overlapping.
 */

import { SpawnPoint } from './TerrainGenerator';

export interface DistributedPoint {
  x: number;
  z: number;
  y?: number;
  radius: number;
  label: string;
}

export interface WorldLayout {
  spawn: SpawnPoint;
  settlement: DistributedPoint;
  rocket: DistributedPoint;
  portalCore: DistributedPoint;
  woodenDoor: DistributedPoint;
  dimensionalDoor: DistributedPoint;
  palette: DistributedPoint;
  megacity: DistributedPoint;
  pirate: DistributedPoint;
  ender: DistributedPoint;
  marketplace: DistributedPoint;
  rare: DistributedPoint;
  crystalOverlay: DistributedPoint;
}

function hashToUnit(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function polarToXZ(distance: number, angleDeg: number, jitterDeg = 0, jitterDist = 0): { x: number; z: number } {
  const angle = (angleDeg + jitterDeg) * Math.PI / 180;
  const d = distance + jitterDist;
  return { x: Math.cos(angle) * d, z: Math.sin(angle) * d };
}

export function getWorldLayout(seed: string, spawn: SpawnPoint): WorldLayout {
  const j = (key: string, rangeDeg: number) => (hashToUnit(`${seed}:jitter:${key}`) - 0.5) * rangeDeg;
  const jd = (key: string, range: number) => (hashToUnit(`${seed}:jdist:${key}`) - 0.5) * range;

  const sA = j('settlement', 18);
  const settlementPos = polarToXZ(58, -38 + sA, 0, jd('settlement', 12));
  const rocketPos = polarToXZ(110, 135 + j('rocket', 22), 0, jd('rocket', 18));
  const portalPos = polarToXZ(72, 48 + j('portal', 20), 0, jd('portal', 10));
  const woodDoorPos = polarToXZ(46, -125 + j('doorWood', 16), 0, jd('doorWood', 8));
  const dimDoorPos = polarToXZ(66, 122 + j('doorDim', 18), 0, jd('doorDim', 10));
  const palettePos = polarToXZ(34, 2 + j('palette', 10), 0, jd('palette', 6));
  const megaPos = polarToXZ(185, 32 + j('mega', 16), 0, jd('mega', 30));
  const piratePos = polarToXZ(98, -28 + j('pirate', 20), 0, jd('pirate', 14));
  const enderPos = polarToXZ(155, 205 + j('ender', 22), 0, jd('ender', 24));
  const marketPos = polarToXZ(42, 88 + j('market', 18), 0, jd('market', 8));
  const rarePos = polarToXZ(128, -148 + j('rare', 24), 0, jd('rare', 20));
  const crystalPos = polarToXZ(78, 8 + j('crystal', 14), 0, jd('crystal', 10));

  return {
    spawn,
    settlement: { x: settlementPos.x, z: settlementPos.z, radius: 14, label: 'settlement' },
    rocket: { x: rocketPos.x, z: rocketPos.z, radius: 16, label: 'rocket' },
    portalCore: { x: portalPos.x, z: portalPos.z, radius: 8, label: 'portalCore' },
    woodenDoor: { x: woodDoorPos.x, z: woodDoorPos.z, radius: 5, label: 'woodenDoor' },
    dimensionalDoor: { x: dimDoorPos.x, z: dimDoorPos.z, radius: 6, label: 'dimensionalDoor' },
    palette: { x: palettePos.x, z: palettePos.z, radius: 7, label: 'palette' },
    megacity: { x: megaPos.x, z: megaPos.z, radius: 28, label: 'megacity' },
    pirate: { x: piratePos.x, z: piratePos.z, radius: 12, label: 'pirate' },
    ender: { x: enderPos.x, z: enderPos.z, radius: 18, label: 'ender' },
    marketplace: { x: marketPos.x, z: marketPos.z, radius: 9, label: 'marketplace' },
    rare: { x: rarePos.x, z: rarePos.z, radius: 10, label: 'rare' },
    crystalOverlay: { x: crystalPos.x, z: crystalPos.z, radius: 12, label: 'crystal' },
  };
}

export const SPAWN_PROTECTED_RADIUS = 26;
export const SPAWN_CLEAR_HEIGHT = 12;
