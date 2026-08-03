// @vitest-environment jsdom
/**
 * EndBlackHole — physical black-hole portal.
 *
 * It pulls the player in with growing strength (spaghettification), and
 * `entered()` returns true once the player crosses the event horizon. These
 * tests pin the pull strength curve and the enter detection.
 */
import { describe, it, expect } from 'vitest';
import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { EndBlackHole } from '../../src/effects/EndBlackHole';

function makeHole(): { hole: EndBlackHole; scene: Scene; engine: NullEngine } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const hole = new EndBlackHole(scene);
  hole.ensure(new Vector3(0, 120, 0));
  hole.setActive(true);
  return { hole, scene, engine };
}

describe('EndBlackHole portal', () => {
  it('pulls the player inward when close', () => {
    const { hole, scene, engine } = makeHole();
    const out = new Vector3();
    // Player ~40 blocks from the axis, within pull radius.
    hole.pull(new Vector3(40, 120, 0), out);
    expect(out.x).toBeLessThan(0); // pulled toward origin
    expect(Math.abs(out.z)).toBeLessThan(1e-9);
    expect(out.length()).toBeGreaterThan(0);
    scene.dispose(); engine.dispose();
  });

  it('does not pull outside the pull radius', () => {
    const { hole, scene, engine } = makeHole();
    const out = new Vector3(9, 9, 9);
    hole.pull(new Vector3(500, 120, 0), out);
    expect(out.length()).toBe(0);
    scene.dispose(); engine.dispose();
  });

  it('detects entering the event horizon', () => {
    const { hole, scene, engine } = makeHole();
    expect(hole.entered(new Vector3(40, 120, 0))).toBe(false);
    expect(hole.entered(new Vector3(5, 120, 0))).toBe(true); // inside horizon
    scene.dispose(); engine.dispose();
  });

  it('reports its centre for the void teleport', () => {
    const { hole, scene, engine } = makeHole();
    const c = hole.centre();
    expect(c.y).toBeCloseTo(120);
    scene.dispose(); engine.dispose();
  });
});
