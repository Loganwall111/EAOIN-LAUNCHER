/**
 * Regression tests for the Black Hole's gravitational lensing post-process.
 *
 * Brief: "Implement a post-process radial warp shader around the sky's Black
 * Hole entity to visually bend and distort incoming light."
 */
import { describe, it, expect } from 'vitest';
import { NullEngine, Scene, UniversalCamera, Vector3, PostProcess } from '@babylonjs/core';
import { BlackHoleEncounter, INFLUENCE_RADIUS, EVENT_HORIZON_RADIUS } from '../../src/space/BlackHoleEncounter';

function makeEncounter(): { engine: NullEngine; scene: Scene; camera: UniversalCamera; hole: BlackHoleEncounter } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new UniversalCamera('cam', new Vector3(0, 0, -10), scene);
  camera.setTarget(Vector3.Zero());
  scene.activeCamera = camera;
  const hole = new BlackHoleEncounter(scene, camera);
  hole.attach();
  return { engine, scene, camera, hole };
}

describe('Black Hole gravitational lensing', () => {
  it('creates a real post-process shader once the hole is spawned', () => {
    const { engine, scene, hole } = makeEncounter();
    expect(hole.isActive()).toBe(false);

    hole.spawn(new Vector3(0, 0, 40));
    expect(hole.isActive()).toBe(true);

    const postProcesses = (scene.activeCamera?._postProcesses ?? []).filter(Boolean) as PostProcess[];
    expect(postProcesses.some((p) => p.name === 'bh_lens')).toBe(true);

    hole.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('removes the post-process on despawn so it never lingers on an empty sky', () => {
    const { engine, scene, hole } = makeEncounter();
    hole.spawn(new Vector3(0, 0, 40));
    hole.despawn();
    expect(hole.isActive()).toBe(false);

    const postProcesses = (scene.activeCamera?._postProcesses ?? []).filter(Boolean) as PostProcess[];
    expect(postProcesses.some((p) => p.name === 'bh_lens')).toBe(false);

    hole.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('exerts real gravitational pull that grows as the player approaches', () => {
    const { engine, scene, hole } = makeEncounter();
    hole.spawn(new Vector3(0, 0, 0));

    const farAway = new Vector3(0, 0, INFLUENCE_RADIUS * 3);
    const farState = hole.update(0.016, farAway);
    expect(farState.pull).toBe(0);

    const close = new Vector3(0, 0, INFLUENCE_RADIUS * 0.3);
    const closeState = hole.update(0.016, close);
    expect(closeState.pull).toBeGreaterThan(0);

    hole.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('fires onConsumed exactly once when the player crosses the event horizon', () => {
    const { engine, scene, hole } = makeEncounter();
    let consumedCount = 0;
    hole.onConsumed = () => { consumedCount += 1; };
    hole.spawn(new Vector3(0, 0, 0));

    const atHorizon = new Vector3(0, 0, EVENT_HORIZON_RADIUS * 0.5);
    hole.update(0.016, atHorizon);
    hole.update(0.016, atHorizon);
    hole.update(0.016, atHorizon);

    expect(consumedCount).toBe(1);

    hole.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('never throws even if the shader effect is exercised across many frames', () => {
    const { engine, scene, hole } = makeEncounter();
    hole.spawn(new Vector3(20, 5, 60));
    expect(() => {
      for (let i = 0; i < 30; i += 1) {
        hole.update(0.016, new Vector3(0, 0, i));
      }
    }).not.toThrow();

    hole.dispose();
    scene.dispose();
    engine.dispose();
  });
});

describe('BlackHoleEncounter Interstellar styles', () => {
  it('defaults to classic and spawns cleanly', () => {
    const { engine, scene, hole } = makeEncounter();
    expect(hole.style).toBe('classic');
    hole.spawn(new Vector3(0, 0, 40));
    expect(hole.isActive()).toBe(true);
    hole.dispose(); scene.dispose(); engine.dispose();
  });

  it('supports the gargantua and wormhole styles without throwing', () => {
    for (const style of ['classic', 'gargantua', 'wormhole'] as const) {
      const { engine, scene, hole } = makeEncounter();
      hole.style = style;
      hole.attach();
      hole.spawn(new Vector3(0, 0, 40));
      expect(() => hole.update(0.016, new Vector3(0, 0, 20))).not.toThrow();
      hole.dispose(); scene.dispose(); engine.dispose();
    }
  });
});
