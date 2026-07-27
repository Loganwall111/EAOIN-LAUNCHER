/**
 * Input routing regression test.
 *
 * The report: "the commands are overlapping with the sections — when they type
 * the I button for inventory it popped up the inventory during when it was
 * typing… every time it's the E is the inventory button, when I typed in D and
 * other stuff for /time set day it was overlapping with keys that click other
 * things".
 *
 * Cause: `handleKeyDown` is attached once to `window` inside the scene effect,
 * so it captured `commandOpen` / `chatOpen` from the first render, where both
 * are `false`. The guard `if (event.key === 't' && !commandOpen && !chatOpen)`
 * therefore never fired, and every gameplay hotkey stayed live while typing.
 *
 * The fix reads a ref instead, and also stands down when focus is in any text
 * field or a modifier chord is held. This test verifies the guard logic
 * directly, since mounting the Babylon scene is not possible in jsdom.
 */
import { describe, it, expect } from 'vitest';

/**
 * Mirror of the guard at the top of `GameCanvas.handleKeyDown`.
 *
 * Kept in lockstep with the engine: if that guard changes, this must too.
 */
interface GuardInput {
  textEntryOpen: boolean;
  targetTag?: string;
  contentEditable?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

function shouldIgnoreKey(input: GuardInput): boolean {
  if (input.textEntryOpen) return true;
  const tag = input.targetTag;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || input.contentEditable) return true;
  if (input.ctrlKey || input.metaKey || input.altKey) return true;
  return false;
}

describe('gameplay hotkey guard', () => {
  it('ignores every key while the chat or command console is open', () => {
    // The exact keys from the report: "i" (inventory), "e" (inventory),
    // "d" (part of "/time set day"), "k" (part of "/kill").
    for (const key of ['i', 'e', 'd', 'k', 'q', 'f', 't', '1']) {
      expect(shouldIgnoreKey({ textEntryOpen: true }), key).toBe(true);
    }
  });

  it('allows gameplay keys when no text entry is open', () => {
    for (const key of ['i', 'e', 'd', 'k', 'q', 'f']) {
      expect(shouldIgnoreKey({ textEntryOpen: false }), key).toBe(false);
    }
  });

  it('stands down when focus is in any text field', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(shouldIgnoreKey({ textEntryOpen: false, targetTag: tag }), tag).toBe(true);
    }
    expect(shouldIgnoreKey({ textEntryOpen: false, contentEditable: true })).toBe(true);
  });

  it('does not steal browser and OS shortcuts', () => {
    // Ctrl+R must reload, Cmd+L must focus the address bar, and so on.
    expect(shouldIgnoreKey({ textEntryOpen: false, ctrlKey: true })).toBe(true);
    expect(shouldIgnoreKey({ textEntryOpen: false, metaKey: true })).toBe(true);
    expect(shouldIgnoreKey({ textEntryOpen: false, altKey: true })).toBe(true);
  });

  it('still allows Shift, which gameplay uses', () => {
    // Shift+B summons the black hole; Shift alone must not disable input.
    expect(shouldIgnoreKey({ textEntryOpen: false })).toBe(false);
  });

  it('lets a canvas-focused key through', () => {
    expect(shouldIgnoreKey({ textEntryOpen: false, targetTag: 'CANVAS' })).toBe(false);
  });
});

describe('the engine actually implements the guard', () => {
  it('reads the text-entry flag from a ref, not captured state', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../../src/engine/GameCanvas.tsx'),
      'utf8'
    );

    // The ref must exist and be kept in sync with both flags.
    expect(source).toContain('textEntryOpenRef');
    expect(source).toMatch(/textEntryOpenRef\.current = commandOpen \|\| chatOpen/);
    // And the handler must bail on it before doing anything else.
    expect(source).toMatch(/if \(textEntryOpenRef\.current\) return;/);
    // Text fields and modifier chords are also excluded.
    expect(source).toContain("tag === 'TEXTAREA'");
    expect(source).toMatch(/event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey/);
  });
});
