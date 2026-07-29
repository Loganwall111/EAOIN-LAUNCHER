/**
 * Regression tests for the three fixes in this pass:
 *
 *   1. The "stray white blocks floating in the sky" artifact — small emissive
 *      white cubes (planet moonlets, planet trail stars, comets + cube tails)
 *      that `CelestialBodies` created and only ever faded via material alpha,
 *      so they stayed on screen in daylight.
 *   2. The volumetric cloud deck becoming a soft, alpha-blended, flyable-
 *      through 64-block volume rather than hard white slabs.
 *   3. The boot intro naming the game exactly once instead of across three
 *      overlapping phases.
 *
 * These are source-level assertions rather than Babylon scene tests: the
 * celestial rig builds `DynamicTexture`s in its constructor, which needs a
 * real 2D canvas that neither NullEngine nor jsdom provides.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '../../', rel), 'utf8');

/**
 * Strip block comments and line comments.
 *
 * The fixes are documented in prose that necessarily *names* the things that
 * were removed ("moonlets", "comets", "ONBLOCKAWAY"). Asserting against raw
 * source would therefore match the explanation of the fix rather than any
 * surviving implementation, so every check below runs on code only.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

const CELESTIAL = codeOnly(read('src/sky/CelestialBodies.ts'));
const CLOUDS = codeOnly(read('src/sky/VolumetricClouds.ts'));
const BOOT = codeOnly(read('src/ui/CinematicBoot.tsx'));
const INDEX_HTML = read('index.html');
const HUD_LAYOUT = read('src/styles/hud-layout.css');

describe('sky artifacts: floating white cubes are gone', () => {
  it('no longer builds per-planet moonlet or trail-star cubes', () => {
    // These were `MeshBuilder.CreateBox` calls with a near-white emissive
    // material, ~5-22 units across at a 900-unit orbit.
    expect(CELESTIAL).not.toContain('_moon_${i}');
    expect(CELESTIAL).not.toContain('trailstar');
    expect(CELESTIAL).not.toMatch(/moonlets/);
    expect(CELESTIAL).not.toMatch(/trailStars/);
  });

  it('no longer builds comets or their cube tails', () => {
    expect(CELESTIAL).not.toContain('celestial_comet_head_');
    expect(CELESTIAL).not.toContain('celestial_comet_tail_');
    expect(CELESTIAL).not.toContain('createComets');
    expect(CELESTIAL).not.toContain('launchComet');
    expect(CELESTIAL).not.toContain('updateComets');
  });

  it('keeps the legible celestial bodies that were never the problem', () => {
    // The fix must not strip the sky bare — sun, moon, ringed planet and the
    // black hole are intentional, recognisable objects.
    for (const kept of [
      'celestial_sun_cube',
      'celestial_moon_cube',
      'celestial_saturn_body',
      'celestial_black_hole_core',
      'createDriftingPlanets',
    ]) {
      expect(CELESTIAL, kept).toContain(kept);
    }
  });
});

describe('volumetric clouds: soft flyable weather deck', () => {
  it('forces the alpha-blended path instead of drawing opaque slabs', () => {
    expect(CLOUDS).toContain('needAlphaBlending');
    expect(CLOUDS).toContain('MATERIAL_ALPHABLEND');
  });

  it('disables depth writes so stacked puffs read as one soft mass', () => {
    // With depth writes on, the first box drawn occludes the ones behind it
    // and the deck resolves into visible hard-edged cubes.
    expect(CLOUDS).toContain('disableDepthWrite = true');
  });

  it('renders both faces so the player can fly inside the deck', () => {
    expect(CLOUDS).toContain('backFaceCulling = false');
  });

  it('is a genuine 64-block tall volume, not a flat sheet', () => {
    expect(CLOUDS).toContain('CLOUD_DECK_THICKNESS = 64');
    // The cluster seating must actually consume the thickness constant.
    expect(CLOUDS).toMatch(/baseY[\s\S]{0,120}CLOUD_DECK_THICKNESS/);
  });

  it('never collides with the player — clouds are atmosphere, not terrain', () => {
    expect(CLOUDS).toContain('checkCollisions = false');
    expect(CLOUDS).toContain('isPickable = false');
  });

  it('keeps a single puff faint so density comes from accumulation', () => {
    const match = CLOUDS.match(/CLOUD_PUFF_ALPHA\s*=\s*([\d.]+)/);
    expect(match, 'CLOUD_PUFF_ALPHA must be defined').not.toBeNull();
    expect(Number(match![1])).toBeLessThanOrEqual(0.4);
  });
});

describe('cinematic intro: each name is introduced exactly once', () => {
  it('has no separate TITLE phase competing with the LOGO wordmark', () => {
    // LOGO and TITLE both rendered the game name back-to-back with their own
    // fade animations, which is what made the title appear to stack.
    expect(BOOT).not.toMatch(/\|\s*'TITLE'/);
    expect(BOOT).not.toContain("phase === 'TITLE'");
  });

  it('renders the game wordmark from a single phase', () => {
    // `.cb-game-title` used to appear in both the TITLE and READY phases.
    const titleUses = BOOT.match(/cb-game-title/g) ?? [];
    expect(titleUses.length).toBeLessThanOrEqual(1);
  });

  it('does not re-print the studio name during the logo phase', () => {
    // STUDIO already named the studio; the LOGO phase repeating it underneath
    // the wordmark was the second half of the overlap report.
    const studioMentions = BOOT.match(/ONBLOCKAWAY/g) ?? [];
    // Only the STUDIO phase card and the credits billing line may name it.
    expect(studioMentions.length).toBeLessThanOrEqual(2);
  });

  it('runs a strict ordered timeline through to the ready card', () => {
    const order = ['WARNING', 'ENGINE', 'STUDIO', 'CREDITS', 'INTRODUCING', 'LOGO', 'READY'];
    const seq = BOOT.slice(
      BOOT.indexOf('const PHASE_SEQUENCE'),
      BOOT.indexOf('const CREDIT_CARDS')
    );
    const found = order.filter((p) => seq.includes(`'${p}'`));
    expect(found).toEqual(order);
  });

  it('never falls back to a phase that does not exist', () => {
    // The clock used `?? 'LOADING'`, which is not a BootPhase.
    expect(BOOT).not.toContain("?? 'LOADING'");
  });
});

describe('HUD layout is actually delivered to the browser', () => {
  it('loads hud-layout.css last in index.html, matching main.tsx', () => {
    // index.html linked every other stylesheet but omitted the authoritative
    // layout file, so the served page used the pre-fix overlapping layout.
    const links = [...INDEX_HTML.matchAll(/href="\/src\/styles\/([\w-]+)\.css"/g)]
      .map((m) => m[1]);
    expect(links).toContain('hud-layout');
    expect(links[links.length - 1]).toBe('hud-layout');
  });

  it('stops tracker rows from smashing their label into their value', () => {
    // `min-width: 0` is the load-bearing declaration: without it a flex item
    // refuses to shrink below its content width and overflows its column.
    const rule = HUD_LAYOUT.slice(HUD_LAYOUT.indexOf('.objectives-panel .objective > span'));
    expect(rule).toContain('min-width: 0');
    expect(HUD_LAYOUT).toContain('overflow-wrap: anywhere');
  });
});
