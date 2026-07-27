/**
 * Command runtime tests.
 *
 * The reports: "killing does not exist in survival, I tried going around and I
 * just like flew and nothing happened", and typing commands collided with
 * gameplay hotkeys. `/kill` genuinely was not a command — it fell through to
 * "Unknown command" — and several others only returned a chat string without
 * ever touching the world.
 */
import { describe, it, expect } from 'vitest';
import { runCommand, CommandRuntimeState } from '../../src/commands/CommandRuntime';
import { createDefaultSettings } from '../../src/settings/GameSettings';

function state(): CommandRuntimeState {
  return {
    settings: createDefaultSettings(),
    time: { timeOfDay: 12, frozen: false },
    lastMessage: '',
    gameMode: 'survival',
  };
}

describe('commands that change the world', () => {
  it('implements /kill', () => {
    const result = runCommand('/kill', state());
    expect(result.ok).toBe(true);
    expect(result.effect?.kind).toBe('kill');
  });

  it('treats /kill @e as clearing creatures, not killing the player', () => {
    expect(runCommand('/kill @e', state()).effect?.kind).toBe('clear');
    expect(runCommand('/kill @s', state()).effect?.kind).toBe('kill');
  });

  it('implements /heal', () => {
    expect(runCommand('/heal', state()).effect?.kind).toBe('heal');
  });

  it('implements /tp with coordinates', () => {
    const result = runCommand('/tp 100 70 -250', state());
    expect(result.ok).toBe(true);
    expect(result.effect).toMatchObject({ kind: 'teleport', x: 100, y: 70, z: -250 });
  });

  it('rejects /tp without three coordinates', () => {
    expect(runCommand('/tp 10 20', state()).ok).toBe(false);
    expect(runCommand('/tp here', state()).ok).toBe(false);
  });

  it('implements /give with an optional amount', () => {
    expect(runCommand('/give 3', state()).effect).toMatchObject({ kind: 'give', blockId: 3, amount: 1 });
    expect(runCommand('/give 3 64', state()).effect).toMatchObject({ kind: 'give', blockId: 3, amount: 64 });
  });

  it('clamps and validates /give arguments', () => {
    expect(runCommand('/give 0', state()).ok).toBe(false);
    expect(runCommand('/give abc', state()).ok).toBe(false);
    expect(runCommand('/give 3 -5', state()).ok).toBe(false);
    // Absurd amounts are capped rather than accepted.
    expect(runCommand('/give 3 99999', state()).effect?.amount).toBeLessThanOrEqual(999);
  });

  it('implements /summon with a real spawn effect', () => {
    // This used to return "Summon preview accepted … through the modding API"
    // and do nothing at all.
    const result = runCommand('/summon sheep', state());
    expect(result.effect).toMatchObject({ kind: 'spawn', entity: 'sheep' });
  });

  it('implements /weather and validates the type', () => {
    expect(runCommand('/weather rain', state()).effect).toMatchObject({ kind: 'weather', weather: 'rain' });
    expect(runCommand('/weather banana', state()).ok).toBe(false);
  });

  it('lists the new commands in /help', () => {
    const help = runCommand('/help', state()).lastMessage;
    for (const name of ['/kill', '/heal', '/tp', '/give', '/weather']) {
      expect(help, name).toContain(name);
    }
  });
});

describe('existing commands still work', () => {
  it('sets the time', () => {
    expect(runCommand('/day', state()).time.timeOfDay).toBe(12);
    expect(runCommand('/night', state()).time.timeOfDay).toBe(0);
    expect(runCommand('/time 18', state()).time.timeOfDay).toBe(18);
    expect(runCommand('/time infinite', state()).time.frozen).toBe(true);
  });

  it('switches game mode', () => {
    expect(runCommand('/gamemode creative', state()).gameModeChange).toBe('creative');
    expect(runCommand('/gmc', state()).gameModeChange).toBe('creative');
  });

  it('reports unknown commands rather than silently succeeding', () => {
    const result = runCommand('/definitelynotacommand', state());
    expect(result.ok).toBe(false);
    expect(result.lastMessage).toContain('Unknown command');
  });

  it('never returns an effect for a failed command', () => {
    for (const input of ['/tp 1 2', '/give 0', '/weather nope', '/nonsense']) {
      const result = runCommand(input, state());
      expect(result.ok, input).toBe(false);
      expect(result.effect, input).toBeUndefined();
    }
  });
});
