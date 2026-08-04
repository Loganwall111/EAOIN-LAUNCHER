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
  hexToRgb, BLACK_HOLE_PRESETS, STUDIO_TUNES,
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
});

describe('nextStageOf / prevStageOf — journey order', () => {
  it('travels black hole → void → neural → asteroids → planet → house → monitor', () => {
    expect(nextStageOf(0)).toBe(6);
    expect(nextStageOf(6)).toBe(1);
    expect(nextStageOf(1)).toBe(2);
    expect(nextStageOf(2)).toBe(3);
    expect(nextStageOf(3)).toBe(4);
    expect(nextStageOf(4)).toBe(5);
    expect(nextStageOf(5)).toBe(5); // deepest stays
  });
  it('reverses on retreat', () => {
    expect(prevStageOf(5)).toBe(4);
    expect(prevStageOf(4)).toBe(3);
    expect(prevStageOf(1)).toBe(6);
    expect(prevStageOf(6)).toBe(0);
    expect(prevStageOf(0)).toBe(0);
  });
});

describe('portalTransition — look-gated transitions', () => {
  it('advances only when near the centre AND looking into it', () => {
    // far away: never advances no matter how you look
    expect(portalTransition(5, 0.9)).toBe(0);
    // near centre, looking in → advance
    expect(portalTransition(0.5, 0.8)).toBe(1);
    // near centre, looking away → retreat
    expect(portalTransition(0.5, -0.8)).toBe(-1);
    // near centre but looking sideways → stay
    expect(portalTransition(0.5, 0)).toBe(0);
    // just outside advance radius → stay
    expect(portalTransition(1.2, 0.8)).toBe(0);
  });
  it('retreats only when very close and looking away', () => {
    // within back radius and looking away
    expect(portalTransition(0.4, -0.8)).toBe(-1);
    // close but looking sideways
    expect(portalTransition(0.4, 0)).toBe(0);
  });
});

describe('viewDistForStage — journey worlds are framed, not too zoomed', () => {
  it('frames the planet far back so it is visible', () => {
    expect(viewDistForStage(3)).toBeGreaterThanOrEqual(7);
  });
  it('gives each world a distinct comfortable distance', () => {
    const planet = viewDistForStage(3);
    const house = viewDistForStage(4);
    expect(planet).toBeGreaterThan(house);
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
  });
});
