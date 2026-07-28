import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Mesh, NullEngine, Scene, UniversalCamera, Vector3, VertexBuffer } from '@babylonjs/core';
import { FirstPersonViewModel } from '../../src/rendering/FirstPersonViewModel';

function dimensions(mesh: Mesh): { width: number; height: number; depth: number } {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (let index = 0; index < positions.length; index += 3) {
    xs.push(positions[index]);
    ys.push(positions[index + 1]);
    zs.push(positions[index + 2]);
  }
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    depth: Math.max(...zs) - Math.min(...zs),
  };
}

describe('FirstPersonViewModel Minecraft arm proportions', () => {
  let engine: NullEngine;
  let scene: Scene;
  let viewModel: FirstPersonViewModel;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    const camera = new UniversalCamera('camera', Vector3.Zero(), scene);
    viewModel = new FirstPersonViewModel(scene, camera);
  });

  afterEach(() => {
    viewModel.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('forms one contiguous 4x12x4 rectangular silhouette, not a square', () => {
    const sleeve = scene.getMeshByName('fp_arm_upper') as Mesh;
    const hand = scene.getMeshByName('fp_arm_hand') as Mesh;
    const sleeveSize = dimensions(sleeve);
    const handSize = dimensions(hand);

    expect(sleeveSize.width).toBeCloseTo(0.2);
    expect(sleeveSize.depth).toBeCloseTo(0.2);
    expect(handSize.width).toBeCloseTo(0.2);
    expect(handSize.depth).toBeCloseTo(0.2);

    const top = Math.max(
      sleeve.position.y + sleeveSize.height / 2,
      hand.position.y + handSize.height / 2
    );
    const bottom = Math.min(
      sleeve.position.y - sleeveSize.height / 2,
      hand.position.y - handSize.height / 2
    );
    const completeArmHeight = top - bottom;

    expect(completeArmHeight).toBeCloseTo(0.6);
    expect(completeArmHeight / sleeveSize.width).toBeCloseTo(3);
    expect(sleeve.position.y - sleeveSize.height / 2)
      .toBeCloseTo(hand.position.y + handSize.height / 2);
  });
});
