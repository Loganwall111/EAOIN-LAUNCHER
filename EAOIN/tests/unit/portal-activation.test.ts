// @vitest-environment jsdom
/**
 * Regression tests for portal activation loop repair.
 *
 * Brief: "Audit the 40+ dimensional worlds. Repair the trigger math so that
 * building and lighting a portal frame successfully resolves coordinates
 * and transfers the player to the true target dimension."
 *
 * The bug: pressing the activation key used to call an unconditional
 * `dimensionRuntime.cycle()`, which advances through the whole dimension
 * list by one regardless of which portal (if any) the player is standing
 * at. `resolvePortalDestination` is the fix — it resolves the *specific*
 * nearby portal and returns its own configured destination.
 */
import { describe, it, expect } from 'vitest';
import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
import {
  PORTAL_ACTIVATION_RADIUS,
  PortalCoordinate,
  PortalSystem,
  resolvePortalDestination,
} from '../../src/portals/PortalSystem';

const PORTALS: PortalCoordinate[] = [
  { dimension: 'nether', x: 100, y: 64, z: 0 },
  { dimension: 'crystal_realm', x: -50, y: 70, z: 20 },
  { dimension: 'end', x: 0, y: 64, z: 200 },
];

describe('resolvePortalDestination — pure coordinate resolution', () => {
  it('resolves the exact portal the player is standing at, not an arbitrary neighbour', () => {
    const result = resolvePortalDestination(PORTALS, 100, 64, 0.5);
    expect(result?.dimension).toBe('nether');
  });

  it('resolves a different specific portal when standing at a different frame', () => {
    const result = resolvePortalDestination(PORTALS, -50, 70, 20.2);
    expect(result?.dimension).toBe('crystal_realm');
  });

  it('returns null when no portal is within activation range', () => {
    const result = resolvePortalDestination(PORTALS, 5000, 64, 5000);
    expect(result).toBeNull();
  });

  it('returns null just outside the activation radius, and a hit just inside it', () => {
    const justOutside = resolvePortalDestination(PORTALS, 100 + PORTAL_ACTIVATION_RADIUS + 0.5, 64, 0);
    expect(justOutside).toBeNull();

    const justInside = resolvePortalDestination(PORTALS, 100 + PORTAL_ACTIVATION_RADIUS - 0.5, 64, 0);
    expect(justInside?.dimension).toBe('nether');
  });

  it('picks the nearest portal when two are (implausibly) both in range', () => {
    const overlapping: PortalCoordinate[] = [
      { dimension: 'nether', x: 0, y: 0, z: 0 },
      { dimension: 'end', x: 1, y: 0, z: 0 },
    ];
    const result = resolvePortalDestination(overlapping, 0.2, 0, 0, 5);
    expect(result?.dimension).toBe('nether');
  });

  it('never returns a portal whose destination the player did not actually approach', () => {
    // Regression for the literal bug: standing at the Nether portal must
    // never resolve to the End or Crystal Realm destinations.
    const result = resolvePortalDestination(PORTALS, 100, 64, 0);
    expect(result?.dimension).not.toBe('end');
    expect(result?.dimension).not.toBe('crystal_realm');
  });
});

describe('PortalSystem.findActivePortal — live scene integration', () => {
  it('resolves the real destination of the portal spawned nearest the player', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const system = new PortalSystem(scene);

    system.spawnForDimension('nether', new Vector3(20, 64, 0));
    system.spawnForDimension('crystal_realm', new Vector3(-30, 64, 40));

    const hit = system.findActivePortal(20, 64, 0.1);
    expect(hit?.dimension).toBe('nether');

    const hit2 = system.findActivePortal(-30, 64, 40.1);
    expect(hit2?.dimension).toBe('crystal_realm');

    const miss = system.findActivePortal(9999, 64, 9999);
    expect(miss).toBeNull();

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('ignores disposed/dead portals', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const system = new PortalSystem(scene);
    const instance = system.spawnForDimension('nether', new Vector3(0, 64, 0));
    instance.dispose();

    const hit = system.findActivePortal(0, 64, 0);
    expect(hit).toBeNull();

    system.dispose();
    scene.dispose();
    engine.dispose();
  });
});
