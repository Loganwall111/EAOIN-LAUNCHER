// @vitest-environment jsdom
/**
 * 2.0 — Customizable per-dimension portal build techniques.
 *
 * Each dimension is built differently in-world and lights when you place the
 * "completing" block:
 *   - Nether  → a standing 4×5 ring of Obsidian  (trigger: Obsidian)
 *   - End     → a flat 5×5 ground ring of Obsidian + Crystal Shard on top (trigger: Crystal Shard)
 *   - Aether  → a hollow Glass globe             (trigger: Glass)
 *   - Rift    → twin vertical rings of Rift Stone (trigger: Rift Stone)
 */
import { describe, it, expect } from 'vitest';
import { PortalSystem } from '../../src/portals/PortalSystem';

/** A tiny in-memory voxel world that returns air (0) for unset cells. */
function makeWorld() {
  const store = new Map<string, number>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const set = (x: number, y: number, z: number, b: number) => store.set(key(x, y, z), b);
  const getBlock = (x: number, y: number, z: number) => store.get(key(x, y, z)) ?? 0;
  return { set, getBlock };
}

const OBS = 12, CRYSTAL = 16, GLASS = 64, RIFT = 313;

describe('Nether — standing obsidian ring', () => {
  it('lights a nether portal when the final Obsidian completes a 4×5 ring', () => {
    const w = makeWorld();
    // Base at (0,40,0), ring spans X (0..4), height 40..44, interior 2×3 air.
    for (let dx = 0; dx <= 4; dx++) {
      w.set(0 + dx, 40, 0, OBS);
      w.set(0 + dx, 44, 0, OBS);
    }
    for (let dy = 0; dy <= 4; dy++) {
      w.set(0, 40 + dy, 0, OBS);
      w.set(4, 40 + dy, 0, OBS);
    }
    // Interior must be air (it already is by default).
    // Place the "last" obsidian on the right edge.
    w.set(4, 42, 0, OBS);
    const system = new PortalSystem(undefined as never);
    const frame = system.findBuildablePortalFrame(4, 42, 0, w.getBlock);
    expect(frame?.dimension).toBe('nether');
    expect(frame?.x).toBe(2);
    expect(frame?.y).toBe(42);
    expect(frame?.z).toBe(0);
  });

  it('returns null when the obsidian does not complete a frame', () => {
    const w = makeWorld();
    w.set(0, 40, 0, OBS); // lone obsidian
    const system = new PortalSystem(undefined as never);
    const frame = system.findBuildablePortalFrame(0, 40, 0, w.getBlock);
    expect(frame).toBeNull();
  });
});

describe('End — ground obsidian ring + end crystal', () => {
  it('lights an end portal when a Crystal Shard is placed on a complete ground ring', () => {
    const w = makeWorld();
    const ringY = 30;
    // 5×5 flat obsidian ring at y=30 with 3×3 air interior.
    for (let bx = 0; bx <= 4; bx++) {
      for (let bz = 0; bz <= 4; bz++) {
        const border = bx === 0 || bx === 4 || bz === 0 || bz === 4;
        w.set(bx, ringY, bz, border ? OBS : 0);
      }
    }
    // Place an end crystal on top of a border cell.
    w.set(0, ringY + 1, 2, CRYSTAL);
    const system = new PortalSystem(undefined as never);
    const frame = system.findBuildablePortalFrame(0, ringY + 1, 2, w.getBlock);
    expect(frame?.dimension).toBe('end');
    expect(frame?.x).toBe(2);
    expect(frame?.y).toBe(ringY + 1);
    expect(frame?.z).toBe(2);
  });

  it('returns null when a crystal sits over the interior (not on the ring border)', () => {
    const w = makeWorld();
    const ringY = 30;
    for (let bx = 0; bx <= 4; bx++) {
      for (let bz = 0; bz <= 4; bz++) {
        const border = bx === 0 || bx === 4 || bz === 0 || bz === 4;
        w.set(bx, ringY, bz, border ? OBS : 0);
      }
    }
    // Crystal over the interior floor (not on the border).
    w.set(2, ringY + 1, 2, CRYSTAL);
    const system = new PortalSystem(undefined as never);
    expect(system.findBuildablePortalFrame(2, ringY + 1, 2, w.getBlock)).toBeNull();
  });
});

describe('Aether — hollow glass globe', () => {
  it('lights an aether portal when the final Glass completes a globe shell', () => {
    const w = makeWorld();
    const cx = 10, cy = 60, cz = 20;
    // Shell cells: dist² in 4..8; interior dist² in 0..3.
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > 8) continue;
          w.set(cx + dx, cy + dy, cz + dz, d2 >= 4 ? GLASS : 0);
        }
      }
    }
    // Place the final glass shell block.
    w.set(cx + 2, cy, cz, GLASS);
    const system = new PortalSystem(undefined as never);
    const frame = system.findBuildablePortalFrame(cx + 2, cy, cz, w.getBlock);
    expect(frame?.dimension).toBe('aether');
    expect(frame?.x).toBe(cx);
    expect(frame?.y).toBe(cy);
    expect(frame?.z).toBe(cz);
  });

  it('returns null for a lone glass block', () => {
    const w = makeWorld();
    w.set(5, 5, 5, GLASS);
    const system = new PortalSystem(undefined as never);
    expect(system.findBuildablePortalFrame(5, 5, 5, w.getBlock)).toBeNull();
  });
});

describe('Rift — twin vertical rings of Rift Stone', () => {
  it('lights a rift portal when the final Rift Stone completes both rings', () => {
    const w = makeWorld();
    const cx = 30, cy = 50, az = 10;
    // Ring A at z=az, ring B at z=az+3. Ring cells: d2 in 4..7; interior d2 in 0..2.
    for (let ringZ of [az, az + 3]) {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          const d2 = dx * dx + dy * dy;
          if (d2 >= 4 && d2 <= 7) w.set(cx + dx, cy + dy, ringZ, RIFT);
          else if (d2 <= 2) w.set(cx + dx, cy + dy, ringZ, 0);
        }
      }
    }
    // Place the final ring stone on ring A.
    w.set(cx, cy + 2, az, RIFT);
    const system = new PortalSystem(undefined as never);
    const frame = system.findBuildablePortalFrame(cx, cy + 2, az, w.getBlock);
    expect(frame?.dimension).toBe('rift_dimension');
    expect(frame?.x).toBe(cx);
    expect(frame?.y).toBe(cy);
    expect(frame?.z).toBe(az + 1.5);
  });

  it('returns null when only one ring is built', () => {
    const w = makeWorld();
    const cx = 30, cy = 50, az = 10;
    // Only ring A present; ring B at az+3 is missing.
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const d2 = dx * dx + dy * dy;
        if (d2 >= 4 && d2 <= 7) w.set(cx + dx, cy + dy, az, RIFT);
        else if (d2 <= 2) w.set(cx + dx, cy + dy, az, 0);
      }
    }
    w.set(cx, cy + 2, az, RIFT);
    const system = new PortalSystem(undefined as never);
    expect(system.findBuildablePortalFrame(cx, cy + 2, az, w.getBlock)).toBeNull();
  });
});

describe('Build technique metadata', () => {
  it('exposes a build technique on each of the four customizable portals', () => {
    const system = new PortalSystem(undefined as never);
    expect(system.portalName('nether')).toBe('Nether Portal');
    expect(system.portalName('end')).toBe('End Gateway');
    expect(system.portalName('aether')).toBe('Aether Globe');
    expect(system.portalName('rift_dimension')).toBe('Rift Portal');
    expect(system.portalName('overworld')).toBe('Wooden Doorway');
  });
});
