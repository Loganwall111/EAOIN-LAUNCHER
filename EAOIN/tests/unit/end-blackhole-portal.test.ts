// @vitest-environment jsdom
/**
 * EndBlackHole — physical black-hole portal.
 *
 * It pulls the player in with growing strength (spaghettification), and
 * `entered()` returns true once the player crosses the event horizon. These
 * tests pin the pull strength curve and the enter detection.
 */
import { describe, it, expect } from 'vitest';
import { NullEngine, Scene, UniversalCamera, Vector3, PostProcess } from '@babylonjs/core';
import { EndBlackHole } from '../../src/effects/EndBlackHole';

function makeHole(): { hole: EndBlackHole; scene: Scene; engine: NullEngine } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const hole = new EndBlackHole(scene);
  hole.ensure(new Vector3(0, 120, 0));
  hole.setActive(true);
  return { hole, scene, engine };
}

function makeHoleWithCamera(): { hole: EndBlackHole; scene: Scene; engine: NullEngine; camera: UniversalCamera } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new UniversalCamera('cam', new Vector3(0, 0, -10), scene);
  camera.setTarget(Vector3.Zero());
  scene.activeCamera = camera;
  const hole = new EndBlackHole(scene, camera);
  hole.ensure(new Vector3(0, 120, 40));
  hole.setActive(true);
  return { hole, scene, engine, camera };
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

describe('EndBlackHole lensing post-process', () => {
  it('creates a lensing post-process when a camera is available', () => {
    const { engine, scene, hole, camera } = makeHoleWithCamera();
    const postProcesses = (scene.activeCamera?._postProcesses ?? []).filter(Boolean) as PostProcess[];
    expect(postProcesses.some((p) => p.name.includes('eaoinEndBlackHoleLens'))).toBe(true);
    hole.tick(0.016, performance.now(), new Vector3(0, 120, 30));
    hole.dispose();
    scene.dispose();
    engine.dispose();
  });
});

describe('EndBlackHole time distortion', () => {
  it('slows time and red-shifts light as the player approaches', () => {
    const { engine, scene, hole } = makeHole();
    // Far away: no distortion.
    const far = hole.timeDistortion(new Vector3(500, 120, 0));
    expect(far.timeScale).toBe(1);
    expect(far.redshift).toBe(0);
    // Near the axis: strong distortion.
    const near = hole.timeDistortion(new Vector3(5, 120, 0));
    expect(near.timeScale).toBeLessThan(1);
    expect(near.redshift).toBeGreaterThan(0);
    hole.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('is strongest at the event horizon and zero far away', () => {
    const { engine, scene, hole } = makeHole();
    const horizon = hole.timeDistortion(new Vector3(1, 120, 0));
    const far = hole.timeDistortion(new Vector3(500, 120, 0));
    expect(horizon.redshift).toBeGreaterThan(far.redshift);
    expect(horizon.timeScale).toBeLessThan(far.timeScale);
    hole.dispose();
    scene.dispose();
    engine.dispose();
  });
});

describe('EndBlackHole gravity slingshot', () => {
  it('returns a launch-power bonus near the hole and null far away', () => {
    const { engine, scene, hole } = makeHole();
    const near = hole.gravitySlingshot(new Vector3(10, 120, 0));
    const far = hole.gravitySlingshot(new Vector3(500, 120, 0));
    expect(near).not.toBeNull();
    expect(far).toBeNull();
    if (near) expect(near).toBeGreaterThan(1);
    hole.dispose();
    scene.dispose();
    engine.dispose();
  });
});

describe('EndBlackHole growth', () => {
  it('starts small and doubles every 20 minutes', () => {
    const { hole, scene, engine } = makeHole();
    expect(hole.radius).toBe(13);
    // Under one interval (1200s): no growth yet.
    hole.grow(1199);
    expect(hole.radius).toBe(13);
    // Crossing the 20-minute mark doubles it.
    hole.grow(1);
    expect(hole.radius).toBe(26);
    scene.dispose(); engine.dispose();
  });

  it('keeps doubling over many intervals', () => {
    const { hole, scene, engine } = makeHole();
    hole.grow(1200 * 3);
    expect(hole.radius).toBeCloseTo(13 * 8, 5);
    scene.dispose(); engine.dispose();
  });

  it('eventually engulfs the End island', () => {
    const { hole, scene, engine } = makeHole();
    hole.grow(1200 * 6); // 2 hours
    expect(hole.hasEngulfed).toBe(true);
    expect(hole.radius).toBeGreaterThan(300);
    scene.dispose(); engine.dispose();
  });

  it('grows the pull edge so entities far away get pulled', () => {
    const { hole, scene, engine } = makeHole();
    hole.grow(1200); // double once
    const out = new Vector3(0, 0, 0);
    hole.pull(new Vector3(100, 120, 0), out); // was outside 90 radius before
    expect(out.length()).toBeGreaterThan(0);
    scene.dispose(); engine.dispose();
  });

  it('pulls and swallows non-player entities', () => {
    const { hole, scene, engine } = makeHole();
    const ents = [{ x: 60, z: 0 }, { x: 200, z: 0 }];
    const pulled = hole.pullEntities(ents, 1);
    expect(pulled).toBeGreaterThan(0);
    // Only the close one got pulled within one step; far stays.
    scene.dispose(); engine.dispose();
  });
});
