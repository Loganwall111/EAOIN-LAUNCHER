// @vitest-environment jsdom
/**
 * RealityRiftSystem — stepping through a rift teleports the player onto safe
 * ground (the End island), not the black hole.
 */
import { describe, it, expect } from 'vitest';
import { Color3, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { RealityRift, RealityRiftSystem, RiftDef } from '../../src/world/RealityRifts';

function makeSystem(): { system: RealityRiftSystem; scene: Scene; engine: NullEngine } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  return { system: new RealityRiftSystem(scene), scene, engine };
}

describe('RealityRiftSystem.stepThrough', () => {
  it('returns null when the player is not inside a rift', () => {
    const { system, scene, engine } = makeSystem();
    const landing = new Vector3(0, 44, 0);
    expect(system.stepThrough(new Vector3(0, 120, 0), landing)).toBeNull();
    scene.dispose(); engine.dispose();
  });

  it('teleports the player to the landing island when stepping through', () => {
    const { system, scene, engine } = makeSystem();
    const def: RiftDef = {
      position: new Vector3(0, 120, 0),
      size: 8,
      content: 'dimension',
      color1: new Color3(0.6, 0.2, 1),
      color2: new Color3(0.2, 0.05, 0.6),
      rotationSpeed: 0.2,
      lifetime: 30,
      maxLifetime: 30,
      intensity: 1,
    };
    const rift = new RealityRift(scene, def);
    system.rifts.push(rift);
    const landing = new Vector3(0, 44, 0);
    // Player is inside the rift heart -> teleport to the island.
    const target = system.stepThrough(new Vector3(1, 120, 0), landing);
    expect(target).not.toBeNull();
    if (target) expect(target.y).toBeGreaterThan(40);
    // Far away -> no teleport.
    expect(system.stepThrough(new Vector3(1000, 120, 1000), landing)).toBeNull();
    scene.dispose(); engine.dispose();
  });
});
