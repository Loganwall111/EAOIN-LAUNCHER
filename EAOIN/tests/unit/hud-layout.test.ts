/**
 * HUD layout regression tests.
 *
 * The report: "there are also buttons and stuff that are in my way and I can't
 * fully see… I would like to separate it in different parts of the screen".
 *
 * The HUD is styled by several stylesheets written at different times, and
 * panels from different files were pinned to the same screen corner at the
 * same offset. Rather than eyeballing it, these tests parse the CSS and assert
 * that panels assigned to the same corner have different offsets, and that the
 * final layout file actually claims every panel that used to collide.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LAYOUT = readFileSync(resolve(__dirname, '../../src/styles/hud-layout.css'), 'utf8');

/** Pull the declaration block for a selector out of a stylesheet. */
function ruleFor(css: string, selector: string): string | null {
  // Matches `.foo { ... }` including when grouped on its own line.
  const pattern = new RegExp(
    `(^|[},])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    'm'
  );
  const match = css.match(pattern);
  return match ? match[2] : null;
}

/** Read a numeric px value for a property from a declaration block. */
function pxValue(block: string, property: string): number | null {
  const match = block.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'm'));
  if (!match) return null;
  const raw = match[1];
  const px = raw.match(/(-?\d+(?:\.\d+)?)px/);
  if (px) return Number(px[1]);
  // `var(--hud-gutter)` resolves to 16px in the stylesheet's :root.
  if (raw.includes('--hud-gutter')) {
    const calc = raw.match(/calc\(var\(--hud-gutter\)\s*\+\s*(\d+)px\)/);
    return calc ? 16 + Number(calc[1]) : 16;
  }
  return null;
}

describe('HUD layout stylesheet', () => {
  it('is loaded last so it wins over the older HUD stylesheets', () => {
    const main = readFileSync(resolve(__dirname, '../../src/main.tsx'), 'utf8');
    const imports = [...main.matchAll(/import '\.\/styles\/([\w-]+)\.css'/g)].map((m) => m[1]);
    expect(imports).toContain('hud-layout');
    expect(imports[imports.length - 1]).toBe('hud-layout');
  });

  it('defines the shared layout variables the rules depend on', () => {
    for (const token of ['--hud-gutter', '--hud-bottom-reserve', '--hud-z-hotbar', '--hud-z-chat']) {
      expect(LAYOUT, token).toContain(token);
    }
  });

  it('separates the two panels that shared the top-left corner', () => {
    // .hud-player and .objectives-panel were both at ~14px top-left.
    const player = ruleFor(LAYOUT, '.eaoin-hud .hud-player');
    const objectives = ruleFor(LAYOUT, '.objectives-panel');
    expect(player).toBeTruthy();
    expect(objectives).toBeTruthy();
    const playerTop = pxValue(player!, 'top');
    const objectivesTop = pxValue(objectives!, 'top');
    expect(playerTop).not.toBeNull();
    expect(objectivesTop).not.toBeNull();
    // The objectives tracker must clear the player card, which is ~96px tall.
    expect(objectivesTop! - playerTop!).toBeGreaterThanOrEqual(90);
  });

  it('separates the two panels that shared the top-right corner', () => {
    // .hud-minimap and .systems-panel were both at ~14px top-right.
    const minimap = ruleFor(LAYOUT, '.eaoin-hud .hud-minimap');
    const systems = ruleFor(LAYOUT, '.systems-panel');
    const minimapRight = pxValue(minimap!, 'right');
    const systemsRight = pxValue(systems!, 'right');
    // The systems column is pushed a full panel width inboard.
    expect(systemsRight! - minimapRight!).toBeGreaterThanOrEqual(200);
  });

  it('stacks the quest tracker below the minimap instead of over it', () => {
    const minimap = ruleFor(LAYOUT, '.eaoin-hud .hud-minimap');
    const quests = ruleFor(LAYOUT, '.eaoin-hud .hud-quests');
    expect(pxValue(quests!, 'top')! - pxValue(minimap!, 'top')!).toBeGreaterThanOrEqual(180);
  });

  it('keeps chat and the command console clear of the hotbar', () => {
    // Both must sit above the reserved bottom strip.
    for (const selector of ['.game-hud .chat-panel', '.game-hud .command-console', '.eaoin-hud .hud-chat']) {
      const block = ruleFor(LAYOUT, selector);
      expect(block, selector).toBeTruthy();
      expect(block, selector).toMatch(/--hud-bottom-reserve/);
    }
  });

  it('hides the legacy duplicates of the hotbar row', () => {
    // .hotbar/.status-bar/.toolbelt/.survival-panel all drew a second copy of
    // information that `.hud-bottom` already shows, in the same place.
    const block = ruleFor(LAYOUT, '.game-hud .survival-panel');
    expect(block).toBeTruthy();
    expect(block).toMatch(/display:\s*none/);
  });

  it('moves the world action rail out of the abilities corner', () => {
    const rail = ruleFor(LAYOUT, '.game-hud .world-action-rail');
    const abilities = ruleFor(LAYOUT, '.eaoin-hud .hud-abilities');
    expect(rail).toBeTruthy();
    // The rail sits well above the abilities row rather than on top of it.
    expect(pxValue(rail!, 'bottom')! - pxValue(abilities!, 'bottom')!).toBeGreaterThanOrEqual(100);
  });

  it('moves the mining bar off the crosshair', () => {
    const mining = ruleFor(LAYOUT, '.game-hud .mining-progress');
    expect(mining).toBeTruthy();
    // Anchored to the bottom, not vertically centred over the reticle.
    expect(mining).toMatch(/top:\s*auto/);
    expect(mining).toMatch(/bottom:/);
  });

  it('orders the z-index scale so gameplay-critical UI is never buried', () => {
    const root = ruleFor(LAYOUT, ':root');
    const read = (name: string) => Number(root!.match(new RegExp(`${name}:\\s*(\\d+)`))![1]);
    expect(read('--hud-z-world')).toBeLessThan(read('--hud-z-panel'));
    expect(read('--hud-z-panel')).toBeLessThan(read('--hud-z-hotbar'));
    expect(read('--hud-z-hotbar')).toBeLessThan(read('--hud-z-rail'));
    expect(read('--hud-z-rail')).toBeLessThan(read('--hud-z-chat'));
    expect(read('--hud-z-chat')).toBeLessThan(read('--hud-z-modal'));
  });

  it('degrades on small screens rather than letting panels collide', () => {
    expect(LAYOUT).toMatch(/@media \(max-width: 1180px\)/);
    expect(LAYOUT).toMatch(/@media \(max-width: 900px\)/);
  });

  it('positions the top menu button bar below the compass and clock without overlapping', () => {
    const compass = ruleFor(LAYOUT, '.eaoin-hud .hud-compass');
    const clock = ruleFor(LAYOUT, '.eaoin-hud .hud-clock');
    const buttons = ruleFor(LAYOUT, '.game-hud .hud-buttons, .hud-buttons');
    expect(compass).toBeTruthy();
    expect(clock).toBeTruthy();
    expect(buttons).toBeTruthy();
    const compassTop = pxValue(compass!, 'top')!;
    const clockTop = pxValue(clock!, 'top')!;
    const buttonsTop = pxValue(buttons!, 'top')!;
    expect(clockTop - compassTop).toBeGreaterThanOrEqual(24);
    expect(buttonsTop - clockTop).toBeGreaterThanOrEqual(24);
    expect(buttons).toMatch(/flex-wrap:\s*nowrap/);
  });

  it('positions the boss bar below the top menu buttons so they never collide', () => {
    const buttons = ruleFor(LAYOUT, '.game-hud .hud-buttons, .hud-buttons');
    const boss = ruleFor(LAYOUT, '.game-hud .boss-bar');
    expect(buttons).toBeTruthy();
    expect(boss).toBeTruthy();
    const buttonsTop = pxValue(buttons!, 'top')!;
    const bossTop = pxValue(boss!, 'top')!;
    expect(bossTop - buttonsTop).toBeGreaterThanOrEqual(36);
  });
});
