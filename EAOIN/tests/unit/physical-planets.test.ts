// @vitest-environment jsdom
/**
 * Regression tests for physical, enterable planets.
 *
 * Brief: "Replace the untextured, placeholder black boxes in the sky with
 * real, procedurally textured 3D sphere meshes... Make these planets
 * physical objects in the upper sky layer that scale dynamically based on
 * the player's approach vector, rather than flat images stuck to a skybox...
 * Entering a planet's atmospheric boundary must automatically trigger the
 * voxel world swap for that planet's specific ground dimension."
 */
import { describe, it, expect } from 'vitest';
import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
import {
  approachScale,
  buildPlanetRegistry,
  isInsideAtmosphere,
  PhysicalPlanets,
  PlanetApproachTracker,
} from '../../src/space/PhysicalPlanets';

describe('planet registry', () => {
  it('gives every planet a distinct ground dimension to swap into', () => {
    const planets = buildPlanetRegistry(Vector3.Zero());
    expect(planets.length).toBeGreaterThanOrEqual(4);
    const dimensions = new Set(planets.map((p) => p.dimension));
    // Not every planet needs a unique dimension, but they must not all be
    // the same one — that would defeat "specific ground dimension".
    expect(dimensions.size).toBeGreaterThan(1);
  });

  it('places every planet far from spawn so it can never be confused with ordinary terrain', () => {
    const spawn = new Vector3(10, 64, 10);
    const planets = buildPlanetRegistry(spawn);
    for (const planet of planets) {
      expect(Vector3.Distance(planet.position, spawn)).toBeGreaterThan(500);
    }
  });
});

describe('approachScale — physical object behaviour, not a skybox sprite', () => {
  it('renders at its resting scale at the reference distance', () => {
    expect(approachScale(1000, 1000)).toBeCloseTo(1, 5);
  });

  it('grows larger as the player gets closer', () => {
    const far = approachScale(2000, 1000);
    const near = approachScale(200, 1000);
    expect(near).toBeGreaterThan(far);
  });

  it('shrinks as the player moves away', () => {
    const s1 = approachScale(500, 1000);
    const s2 = approachScale(5000, 1000);
    expect(s2).toBeLessThan(s1);
  });

  it('clamps so it can never vanish or blow up to fill the screen', () => {
    expect(approachScale(1_000_000, 1000)).toBeGreaterThanOrEqual(0.35);
    expect(approachScale(0.001, 1000)).toBeLessThanOrEqual(5);
  });
});

describe('isInsideAtmosphere', () => {
  it('is true at and inside the boundary, false outside it', () => {
    expect(isInsideAtmosphere(100, 100)).toBe(true);
    expect(isInsideAtmosphere(99, 100)).toBe(true);
    expect(isInsideAtmosphere(101, 100)).toBe(false);
  });
});

describe('PlanetApproachTracker — edge-triggered dimension swap', () => {
  const planets = buildPlanetRegistry(new Vector3(0, 64, 0));
  const target = planets[0];

  it('fires exactly once when entering a planet atmosphere, not every frame', () => {
    const tracker = new PlanetApproachTracker();
    const farAway = target.position.add(new Vector3(target.atmosphereRadius * 10, 0, 0));
    const inside = target.position.clone();

    expect(tracker.update(planets, farAway)).toEqual([]);
    const firstEntry = tracker.update(planets, inside);
    expect(firstEntry.map((e) => e.planet.id)).toEqual([target.id]);

    // Staying inside must not re-fire the event every frame.
    expect(tracker.update(planets, inside)).toEqual([]);
    expect(tracker.update(planets, inside)).toEqual([]);
  });

  it('fires again after leaving and re-entering the same atmosphere', () => {
    const tracker = new PlanetApproachTracker();
    const farAway = target.position.add(new Vector3(target.atmosphereRadius * 10, 0, 0));
    const inside = target.position.clone();

    tracker.update(planets, inside);
    tracker.update(planets, farAway);
    const secondEntry = tracker.update(planets, inside);
    expect(secondEntry.map((e) => e.planet.id)).toEqual([target.id]);
  });

  it('never confuses two different planets for each other', () => {
    const tracker = new PlanetApproachTracker();
    const other = planets[1];
    const insideFirst = target.position.clone();
    const insideSecond = other.position.clone();

    const firstEvents = tracker.update(planets, insideFirst);
    expect(firstEvents.map((e) => e.planet.id)).toEqual([target.id]);

    const secondEvents = tracker.update(planets, insideSecond);
    // Left the first planet's atmosphere and entered the second's in one hop.
    expect(secondEvents.map((e) => e.planet.id)).toEqual([other.id]);
  });
});

describe('PhysicalPlanets — Babylon-facing behaviour', () => {
  it('builds a real textured sphere mesh per planet, not an untextured box', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const planets = new PhysicalPlanets(scene, new Vector3(0, 64, 0));
    planets.attach();

    const meshes = scene.meshes.filter((m) => m.metadata?.physicalPlanet);
    expect(meshes.length).toBe(planets.getPlanets().length);
    for (const mesh of meshes) {
      expect(mesh.getClassName()).toBe('Mesh');
      expect(mesh.material).toBeTruthy();
      // A textured material, not a flat colour swatch.
      expect((mesh.material as any).diffuseTexture).toBeTruthy();
    }

    planets.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('scales meshes based on live camera distance every update, not a fixed size', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const planets = new PhysicalPlanets(scene, new Vector3(0, 64, 0));
    planets.attach();

    const def = planets.getPlanets()[0];
    const mesh = scene.meshes.find((m) => m.metadata?.physicalPlanet === def.id)!;

    planets.update(0.016, def.position.add(new Vector3(def.atmosphereRadius * 20, 0, 0)));
    const farScale = mesh.scaling.x;

    planets.update(0.016, def.position.clone());
    const nearScale = mesh.scaling.x;

    expect(nearScale).toBeGreaterThan(farScale);

    planets.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('reports an atmosphere-entry event carrying the correct target dimension', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const planets = new PhysicalPlanets(scene, new Vector3(0, 64, 0));
    planets.attach();

    const def = planets.getPlanets()[0];
    const events = planets.update(0.016, def.position.clone());
    expect(events.length).toBe(1);
    expect(events[0].planet.dimension).toBe(def.dimension);

    planets.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('disposes every mesh and material cleanly', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const planets = new PhysicalPlanets(scene, new Vector3(0, 64, 0));
    planets.attach();
    const before = scene.meshes.length;
    planets.dispose();
    expect(scene.meshes.length).toBeLessThan(before);
    scene.dispose();
    engine.dispose();
  });
});
