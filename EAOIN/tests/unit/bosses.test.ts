/**
 * Boss registry and encounter tests.
 *
 * Context: `BossRegistry.ts` defined 38 bosses and the only thing importing it
 * was a HUD menu — no boss could be fought. These tests pin the data's
 * integrity and the encounter mechanics that now make them real.
 */
import { describe, it, expect } from 'vitest';
import { ALL_BOSSES, BOSS_TIERS, getBoss, getBossesByDimension } from '../../src/creatures/BossRegistry';
import { classifyAbility } from '../../src/creatures/BossEncounter';
import { SPECIES_BY_ID } from '../../src/creatures/WildlifeRegistry';

/** Mirrors SUMMON_BY_DIMENSION in BossEncounter. */
const SUMMON_BY_DIMENSION: Record<string, string> = {
  overworld: 'husk_wanderer', nether: 'ember_imp', end: 'shard_sentinel',
  volcanic_realm: 'ash_walker', frozen_wasteland: 'rime_lurker',
  crystal_realm: 'crystal_crawler', sky_kingdom: 'storm_harrier',
  ocean_world: 'tide_serpent', cosmic_void: 'void_drifter',
  machine_dimension: 'scrap_drone', prehistoric_world: 'raptor',
  toxic_wasteland: 'toxin_hound', undead_realm: 'bone_archer',
  spirit_realm: 'soul_wisp', ancient_civilization: 'rune_golem',
};

describe('boss roster', () => {
  it('has dozens of bosses', () => {
    expect(ALL_BOSSES.length).toBeGreaterThanOrEqual(45);
  });

  it('gives every boss fightable stats', () => {
    for (const boss of ALL_BOSSES) {
      expect(boss.health, `${boss.id} health`).toBeGreaterThan(0);
      expect(boss.damage, `${boss.id} damage`).toBeGreaterThan(0);
      expect(boss.phases, `${boss.id} phases`).toBeGreaterThanOrEqual(1);
      expect(boss.abilities.length, `${boss.id} abilities`).toBeGreaterThan(0);
      expect(boss.drops.length, `${boss.id} drops`).toBeGreaterThan(0);
      // Size drives the generated body; zero would produce an invisible boss.
      expect(boss.size.width, `${boss.id} width`).toBeGreaterThan(0);
      expect(boss.size.height, `${boss.id} height`).toBeGreaterThan(0);
      expect(boss.color, `${boss.id} color`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('has unique ids and a valid tier on each', () => {
    expect(new Set(ALL_BOSSES.map((b) => b.id)).size).toBe(ALL_BOSSES.length);
    for (const boss of ALL_BOSSES) {
      expect(BOSS_TIERS, `${boss.id} tier`).toContain(boss.tier);
    }
  });

  it('scales difficulty with tier', () => {
    const avg = (tier: string) => {
      const group = ALL_BOSSES.filter((b) => b.tier === tier);
      return group.reduce((sum, b) => sum + b.health, 0) / Math.max(1, group.length);
    };
    // A tutorial boss must not out-stat a final boss.
    expect(avg('tutorial')).toBeLessThan(avg('final'));
    expect(avg('standard')).toBeLessThan(avg('world'));
  });

  it('spans many dimensions', () => {
    const dimensions = new Set(ALL_BOSSES.map((b) => b.dimension));
    expect(dimensions.size).toBeGreaterThanOrEqual(15);
  });

  it('looks bosses up by id', () => {
    expect(getBoss('wood_warden')?.name).toBe('Wood Warden');
    expect(getBoss('does_not_exist')).toBeUndefined();
    expect(getBossesByDimension('nether').length).toBeGreaterThan(0);
  });
});

describe('ability classification', () => {
  it('maps every listed ability onto an implemented mechanic', () => {
    const valid = new Set(['melee', 'projectile', 'pulse', 'summon']);
    for (const boss of ALL_BOSSES) {
      for (const ability of boss.abilities) {
        expect(valid.has(classifyAbility(ability)), `${boss.id}: ${ability}`).toBe(true);
      }
    }
  });

  it('recognises the obvious cases', () => {
    expect(classifyAbility('Summon Vex')).toBe('summon');
    expect(classifyAbility('Drone Swarm')).toBe('summon');
    expect(classifyAbility('Wither Skull')).toBe('projectile');
    expect(classifyAbility('Plasma Cannon')).toBe('projectile');
    expect(classifyAbility('Blizzard')).toBe('pulse');
    expect(classifyAbility('Regen Aura')).toBe('pulse');
    expect(classifyAbility('Tail Whip')).toBe('melee');
    expect(classifyAbility('Ram')).toBe('melee');
  });

  it('gives the roster a real mix of mechanics, not all melee', () => {
    const counts: Record<string, number> = {};
    for (const boss of ALL_BOSSES) {
      for (const ability of boss.abilities) {
        const kind = classifyAbility(ability);
        counts[kind] = (counts[kind] ?? 0) + 1;
      }
    }
    for (const kind of ['melee', 'projectile', 'pulse', 'summon']) {
      expect(counts[kind] ?? 0, `${kind} should be represented`).toBeGreaterThan(5);
    }
  });
});

describe('boss summons', () => {
  it('only summons species that actually exist', () => {
    // A typo here would make a summon ability silently do nothing.
    for (const [dimension, speciesId] of Object.entries(SUMMON_BY_DIMENSION)) {
      expect(SPECIES_BY_ID[speciesId], `${dimension} -> ${speciesId}`).toBeDefined();
    }
  });

  it('summons a hostile or neutral minion, never a passive one', () => {
    for (const speciesId of Object.values(SUMMON_BY_DIMENSION)) {
      const species = SPECIES_BY_ID[speciesId];
      expect(['hostile', 'neutral'], `${speciesId}`).toContain(species.temperament);
    }
  });
});

describe('phase thresholds', () => {
  /** Mirrors the phase maths in BossEncounter.damage. */
  function phaseFor(healthFraction: number, phases: number): number {
    return Math.min(phases, Math.max(1, Math.ceil((1 - healthFraction) * phases) || 1));
  }

  it('starts at phase 1 and ends at the final phase', () => {
    expect(phaseFor(1.0, 3)).toBe(1);
    expect(phaseFor(0.01, 3)).toBe(3);
    expect(phaseFor(0.0, 5)).toBe(5);
  });

  it('advances monotonically as health drops', () => {
    let previous = 0;
    for (let hp = 100; hp >= 0; hp -= 5) {
      const phase = phaseFor(hp / 100, 4);
      expect(phase).toBeGreaterThanOrEqual(previous);
      previous = phase;
    }
  });

  it('never exceeds the declared phase count', () => {
    for (const boss of ALL_BOSSES) {
      for (let hp = 0; hp <= 100; hp += 10) {
        expect(phaseFor(hp / 100, boss.phases)).toBeLessThanOrEqual(boss.phases);
      }
    }
  });
});
