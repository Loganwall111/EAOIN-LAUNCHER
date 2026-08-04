// @vitest-environment jsdom
/**
 * Singularity — the ray-marched black-hole simulator tab.
 *
 * It renders a full-screen canvas, camera/disk/gravity sliders, and drives the
 * ARG journey by free 3D flight through a central portal. WebGL itself is
 * browser-only, so the effect's render loop can't run in jsdom; these tests pin
 * the button-free UI structure and the portal-transition helpers.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Singularity, {
  nextStageOf, prevStageOf, portalTransition, viewDistForStage,
  hexToRgb, BLACK_HOLE_PRESETS, BLACK_HOLE_BACKGROUNDS, STUDIO_TUNES, STUDIO_WACKY,
  JOURNEY_WORLDS, MONITOR_STAGE, WORLD_START,
} from '../../src/ui/Singularity';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const noop = () => {};

describe('Singularity', () => {
  it('renders the black hole canvas and control sliders (no navigation buttons)', () => {
    render(<Singularity onBack={noop} />);
    expect(screen.getByText('🕳 The Black Hole')).toBeTruthy();
    expect(screen.getByText(/Disk thickness/)).toBeTruthy();
    expect(screen.getByText(/Gravity strength/)).toBeTruthy();
    expect(document.querySelector('.singularity-canvas')).toBeTruthy();
    // No navigation buttons — the journey is free flight.
    expect(screen.queryByRole('button', { name: /Fall Through/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Deeper/ })).toBeNull();
  });

  it('fires onBack when Back is clicked', () => {
    const onBack = vi.fn();
    render(<Singularity onBack={onBack} />);
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('toggles the Grab/Throw items mode', () => {
    render(<Singularity onBack={noop} />);
    fireEvent.click(screen.getByText('🎯 Grab / Throw'));
    expect(screen.getByText(/Drag on empty space to throw a random item/)).toBeTruthy();
    fireEvent.click(screen.getByText('🎯 Grab / Throw'));
    expect(screen.getByText(/Turn on to grab & throw items/)).toBeTruthy();
  });
});

describe('nextStageOf / prevStageOf — journey order', () => {
  it('travels black hole → void → then 70+ journey worlds → the monitor', () => {
    expect(nextStageOf(0)).toBe(6);
    expect(nextStageOf(6)).toBe(WORLD_START);
    expect(nextStageOf(WORLD_START)).toBe(WORLD_START + 1);
    expect(nextStageOf(MONITOR_STAGE)).toBe(MONITOR_STAGE); // deepest stays
  });
  it('reverses on retreat', () => {
    expect(prevStageOf(MONITOR_STAGE)).toBe(MONITOR_STAGE - 1);
    expect(prevStageOf(WORLD_START + 1)).toBe(WORLD_START);
    expect(prevStageOf(WORLD_START)).toBe(6);
    expect(prevStageOf(6)).toBe(0);
    expect(prevStageOf(0)).toBe(0);
  });
  it('has 50+ distinct journey worlds with the monitor at the end', () => {
    expect(JOURNEY_WORLDS.length).toBeGreaterThanOrEqual(50);
    expect(JOURNEY_WORLDS[JOURNEY_WORLDS.length - 1].id).toBe('monitor');
    expect(JOURNEY_WORLDS[JOURNEY_WORLDS.length - 2].id).toBe('house');
  });
});

describe('portalTransition — look-gated transitions', () => {
  it('advances only when VERY deep inside AND looking straight into the centre', () => {
    // far away: never advances no matter how you look
    expect(portalTransition(5, 0.9)).toBe(0);
    // very deep + looking straight into the centre → advance
    expect(portalTransition(0.25, 0.95)).toBe(1);
    // deep but only looking partly in (not straight) → stay
    expect(portalTransition(0.25, 0.6)).toBe(0);
    // near centre, looking away → retreat
    expect(portalTransition(0.25, -0.8)).toBe(-1);
    // near centre but looking sideways → stay
    expect(portalTransition(0.25, 0)).toBe(0);
    // deep-ish but NOT deep enough (outside the tight advance radius) → stay
    expect(portalTransition(0.45, 0.95)).toBe(0);
  });
  it('retreats only when very close and looking away', () => {
    // within back radius and looking away
    expect(portalTransition(0.4, -0.8)).toBe(-1);
    // close but looking sideways
    expect(portalTransition(0.4, 0)).toBe(0);
  });
});

describe('viewDistForStage — journey worlds are framed, not too zoomed', () => {
  it('frames the far asteroid world back so it is visible', () => {
    const asteroidIdx = JOURNEY_WORLDS.findIndex((w) => w.kind === 1);
    expect(viewDistForStage(WORLD_START + Math.max(0, asteroidIdx))).toBeGreaterThanOrEqual(12);
  });
  it('gives each world a distinct comfortable distance', () => {
    const worldA = viewDistForStage(WORLD_START);
    const worldB = viewDistForStage(WORLD_START + 1);
    expect(worldA).toBeGreaterThan(0);
    expect(worldB).toBeGreaterThan(0);
  });
});

describe('hexToRgb — studio colour helper', () => {
  it('parses a hex colour into 0..1 rgb', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
    expect(hexToRgb('#00ff00')).toEqual([0, 1, 0]);
    expect(hexToRgb('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
  });
  it('handles shorthand and mixed hex', () => {
    expect(hexToRgb('#369')).toEqual([0.2, 0.4, 0.6]);
  });
});

describe('BLACK_HOLE_PRESETS — the Black Hole Studio', () => {
  it('offers 100+ preset looks, each with a disk colour', () => {
    expect(BLACK_HOLE_PRESETS.length).toBeGreaterThan(100);
    for (const p of BLACK_HOLE_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.opts.diskCol).toMatch(/^#/);
    }
  });
  it('gives every preset a unique id', () => {
    const ids = new Set(BLACK_HOLE_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(BLACK_HOLE_PRESETS.length);
  });
});

describe('STUDIO_TUNES — the left-side tuning bars', () => {
  it('exposes many tunable numeric sliders', () => {
    expect(STUDIO_TUNES.length).toBeGreaterThanOrEqual(8);
    expect(STUDIO_TUNES.every((c) => c.kind === 'slider')).toBe(true);
    expect(STUDIO_TUNES.some((c) => c.label === 'Disk thickness')).toBe(true);
    expect(STUDIO_TUNES.some((c) => c.label === 'Gravity strength')).toBe(true);
    // massive-hole tuning bars exist
    expect(STUDIO_TUNES.some((c) => c.key === 'holeSize')).toBe(true);
  });
});

describe('STUDIO_WACKY — wacky/fluid toggles & sliders', () => {
  it('includes colour-cycling, fluid, breathing, invert, mono and more', () => {
    const keys = new Set(STUDIO_WACKY.map((c) => c.key));
    expect(keys.has('cycleSpeed')).toBe(true);
    expect(keys.has('fluid')).toBe(true);
    expect(keys.has('breath')).toBe(true);
    expect(keys.has('bright')).toBe(true);
    expect(keys.has('invert')).toBe(true);
    expect(keys.has('mono')).toBe(true);
    expect(STUDIO_WACKY.some((c) => c.kind === 'toggle')).toBe(true);
    // invert look/zoom toggles + new VFX controls
    expect(keys.has('zoomInvert')).toBe(true);
    expect(keys.has('lookInvert')).toBe(true);
    expect(keys.has('spiral')).toBe(true);
    expect(keys.has('flare')).toBe(true);
    expect(keys.has('particles')).toBe(true);
    expect(keys.has('warp')).toBe(true);
    expect(keys.has('ringBands')).toBe(true);
  });
});

describe('BLACK_HOLE_BACKGROUNDS — the 50+ backgrounds gallery', () => {
  it('offers 50+ backgrounds across many generators', () => {
    expect(BLACK_HOLE_BACKGROUNDS.length).toBeGreaterThanOrEqual(50);
    expect(BLACK_HOLE_BACKGROUNDS.every((b) => b.label && b.emoji)).toBe(true);
    const gens = new Set(BLACK_HOLE_BACKGROUNDS.map((b) => b.index));
    expect(gens.size).toBeGreaterThanOrEqual(10);
  });
});
