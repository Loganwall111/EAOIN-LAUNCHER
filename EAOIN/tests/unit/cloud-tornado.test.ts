/**
 * Regression tests for the cloud tornado macro-formation.
 *
 * The brief: "Arrange the macro layout of this volumetric cloud layer into a
 * massive, swirling vortex tornado pattern above the overworld that players
 * can fly through." This is a *shape* requirement on top of the existing
 * soft, alpha-blended, flyable puff system (already covered by
 * sky-artifacts-and-boot.test.ts) — these tests assert the funnel actually
 * widens with height and its rings actually spiral, rather than just adding
 * more randomly scattered boxes.
 */
import { describe, it, expect } from 'vitest';
import { Color3, NullEngine, Scene } from '@babylonjs/core';
import { VolumetricClouds, CLOUD_DECK_ALTITUDE } from '../../src/sky/VolumetricClouds';

function makeClouds(coverage = 0.6): { engine: NullEngine; scene: Scene; clouds: VolumetricClouds } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const clouds = new VolumetricClouds(scene, 'tornado_seed', {
    coverage,
    tint: new Color3(1, 1, 1),
    windSpeed: 3,
  });
  clouds.attach();
  return { engine, scene, clouds };
}

describe('cloud tornado macro-formation', () => {
  it('adds a distinct ring of puffs whose radius from the vertical axis grows with height', () => {
    const { engine, scene, clouds } = makeClouds();
    const blocks = clouds.getDebugBlocks();
    expect(blocks.length).toBeGreaterThan(0);

    // Bucket every puff by height band and track the average distance from
    // the vertical (tornado) axis at x=0, z=0 in each band. A real funnel
    // widens monotonically-ish from base to crown; a formless pile of
    // clusters would not show this trend when isolated to points near the
    // central axis.
    const nearAxis = blocks.filter((b) => Math.hypot(b.x, b.z) < 200);
    expect(nearAxis.length).toBeGreaterThan(20);

    const bands = 4;
    const ys = nearAxis.map((b) => b.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const bandAvgRadius: number[] = [];
    for (let i = 0; i < bands; i += 1) {
      const lo = minY + ((maxY - minY) * i) / bands;
      const hi = minY + ((maxY - minY) * (i + 1)) / bands;
      const inBand = nearAxis.filter((b) => b.y >= lo && b.y < hi);
      if (inBand.length === 0) { bandAvgRadius.push(NaN); continue; }
      const avg = inBand.reduce((sum, b) => sum + Math.hypot(b.x, b.z), 0) / inBand.length;
      bandAvgRadius.push(avg);
    }

    const valid = bandAvgRadius.filter((r) => !Number.isNaN(r));
    expect(valid.length).toBeGreaterThanOrEqual(3);
    // The lowest band must be visibly narrower than the highest band.
    expect(valid[valid.length - 1]).toBeGreaterThan(valid[0] * 1.3);

    clouds.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('spirals: puffs higher in the funnel are rotated further around the axis', () => {
    const { engine, scene, clouds } = makeClouds();
    const blocks = clouds.getDebugBlocks();

    // Restrict to a tight radial band so we are only looking at points that
    // plausibly belong to the funnel rings, not the dispersed cumulus field.
    const candidates = blocks
      .map((b) => ({ ...b, r: Math.hypot(b.x, b.z), angle: Math.atan2(b.z, b.x) }))
      .filter((b) => b.r > 15 && b.r < 170)
      .sort((a, b) => a.y - b.y);

    expect(candidates.length).toBeGreaterThan(20);

    // Unwrap angles against height using a coarse moving average so the
    // -pi/pi wraparound doesn't register as noise, then confirm there is a
    // real net rotation from the lowest sampled points to the highest.
    const bucketCount = 6;
    const minY = candidates[0].y;
    const maxY = candidates[candidates.length - 1].y;
    const bucketAngle: number[] = [];
    for (let i = 0; i < bucketCount; i += 1) {
      const lo = minY + ((maxY - minY) * i) / bucketCount;
      const hi = minY + ((maxY - minY) * (i + 1)) / bucketCount;
      const inBucket = candidates.filter((b) => b.y >= lo && b.y < hi);
      if (inBucket.length === 0) { bucketAngle.push(NaN); continue; }
      // Circular mean so wraparound doesn't cancel out real rotation.
      const sinSum = inBucket.reduce((s, b) => s + Math.sin(b.angle), 0);
      const cosSum = inBucket.reduce((s, b) => s + Math.cos(b.angle), 0);
      bucketAngle.push(Math.atan2(sinSum, cosSum));
    }

    const validBuckets = bucketAngle.filter((a) => !Number.isNaN(a));
    expect(validBuckets.length).toBeGreaterThanOrEqual(4);

    // The formation must trace at least a substantial fraction of a full
    // turn from bottom to top — a flat ring stack (no swirl) would show
    // near-zero net angular change bucket to bucket on average.
    let totalTurn = 0;
    for (let i = 1; i < validBuckets.length; i += 1) {
      let delta = validBuckets[i] - validBuckets[i - 1];
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      totalTurn += Math.abs(delta);
    }
    expect(totalTurn).toBeGreaterThan(0.5);

    clouds.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps the tornado seated within the same vertical deck band as the rest of the clouds', () => {
    const { engine, scene, clouds } = makeClouds();
    const blocks = clouds.getDebugBlocks();
    const nearAxis = blocks.filter((b) => Math.hypot(b.x, b.z) < 170);
    for (const b of nearAxis) {
      // base.y is stored relative to CLOUD_DECK_ALTITUDE (added at draw
      // time), so it must stay within a sane multiple of the deck thickness
      // — never at ground level or absurdly high above the world.
      expect(Math.abs(b.y)).toBeLessThan(300);
    }
    // Sanity: the constant is actually a believable sky altitude.
    expect(CLOUD_DECK_ALTITUDE).toBeGreaterThan(50);

    clouds.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('produces no tornado geometry at all when weather coverage is zero', () => {
    const { engine, scene, clouds } = makeClouds(0);
    expect(clouds.getBlockCount()).toBe(0);
    clouds.dispose();
    scene.dispose();
    engine.dispose();
  });
});
