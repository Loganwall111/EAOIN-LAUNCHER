import { describe, it, expect } from 'vitest';
import { deriveStatusEffects, EffectContext } from '../../src/player/StatusEffects';

const base: EffectContext = {
  survivalStats: { health: 100, food: 100, stamina: 100 },
  dimensionId: 'overworld',
  timeOfDay: 12,
  flightEnabled: false,
  nearPortal: false,
  depthBelowSurface: 0,
};

const ids = (ctx: Partial<EffectContext>) => deriveStatusEffects({ ...base, ...ctx }).map((e) => e.id);

describe('deriveStatusEffects', () => {
  it('reports buffs when the player is in perfect condition', () => {
    const result = ids({});
    expect(result).toContain('regen');
    expect(result).toContain('vigour');
    expect(result).not.toContain('healthy'); // buffs present, so not the empty fallback
  });

  it('never returns an empty list', () => {
    // Mid-range stats produce no buffs and no hazards.
    const result = deriveStatusEffects({ ...base, survivalStats: { health: 60, food: 60, stamina: 60 } });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe('healthy');
  });

  it('flags each survival hazard', () => {
    expect(ids({ survivalStats: { health: 10, food: 100, stamina: 100 } })).toContain('wounded');
    expect(ids({ survivalStats: { health: 100, food: 10, stamina: 100 } })).toContain('hungry');
    expect(ids({ survivalStats: { health: 100, food: 100, stamina: 5 } })).toContain('exhausted');
    expect(ids({ survivalStats: { health: 100, food: 0, stamina: 100 } })).toContain('starving');
    expect(ids({ survivalStats: { health: 0, food: 100, stamina: 100 } })).toContain('downed');
  });

  it('orders hazards before buffs and ambient info', () => {
    const result = deriveStatusEffects({
      ...base,
      survivalStats: { health: 10, food: 100, stamina: 100 },
      flightEnabled: true,
      timeOfDay: 23,
    });
    const tones = result.map((e) => e.tone);
    expect(tones[0]).toBe('bad');
    // Once a 'good' appears there must be no further 'bad'.
    const firstGood = tones.indexOf('good');
    expect(tones.slice(firstGood)).not.toContain('bad');
  });

  it('applies dimension traits', () => {
    expect(ids({ dimensionId: 'nether' })).toContain('heat');
    expect(ids({ dimensionId: 'moon' })).toContain('lowgrav');
    expect(ids({ dimensionId: 'crystal_realm' })).toContain('resonance');
    expect(ids({ dimensionId: 'overworld' })).not.toContain('heat');
  });

  it('surfaces situational cues', () => {
    expect(ids({ flightEnabled: true })).toContain('flight');
    expect(ids({ nearPortal: true })).toContain('portal');
    expect(ids({ timeOfDay: 22 })).toContain('night');
    expect(ids({ timeOfDay: 3 })).toContain('night');
    expect(ids({ timeOfDay: 12 })).not.toContain('night');
    expect(ids({ depthBelowSurface: 40 })).toContain('deep');
    expect(ids({ depthBelowSurface: 5 })).not.toContain('deep');
  });

  it('clamps out-of-range stats in its readout', () => {
    const result = deriveStatusEffects({ ...base, survivalStats: { health: -20, food: 999, stamina: 50 } });
    expect(result.map((e) => e.id)).toContain('downed');
    for (const effect of result) {
      expect(effect.detail).not.toContain('-');
      expect(effect.detail).not.toContain('999');
    }
  });
});
