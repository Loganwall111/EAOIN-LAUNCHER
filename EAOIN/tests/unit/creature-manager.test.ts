import { describe, expect, it } from 'vitest';
import { CreatureManager } from '../../src/creatures/CreatureManager';

describe('CreatureManager population cap', () => {
  it('reports the live cap and trims excess creatures when it is lowered', () => {
    const manager = new CreatureManager({} as never, {} as never, 'cap-test');
    const disposed: string[] = [];
    const creatures = new Map<string, any>([
      ['a', { root: { dispose: () => disposed.push('a') }, species: { id: 'wolf' } }],
      ['b', { root: { dispose: () => disposed.push('b') }, species: { id: 'bear' } }],
      ['c', { root: { dispose: () => disposed.push('c') }, species: { id: 'fox' } }],
    ]);
    (manager as unknown as { creatures: Map<string, any> }).creatures = creatures;

    manager.setPopulationCap(2);

    expect(manager.getStats().cap).toBe(2);
    expect((manager as unknown as { creatures: Map<string, any> }).creatures.size).toBe(2);
    expect(disposed).toEqual(['a']);
  });
});
