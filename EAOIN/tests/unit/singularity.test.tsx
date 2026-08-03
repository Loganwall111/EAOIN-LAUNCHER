// @vitest-environment jsdom
/**
 * Singularity — the ray-marched black-hole simulator tab.
 *
 * It renders a full-screen canvas, camera/disk/gravity sliders, and drives the
 * ARG journey purely by camera zoom (no buttons). WebGL itself is browser-only,
 * so the effect's render loop can't run in jsdom; these tests pin the
 * button-free UI structure and the stage-mapping helper.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Singularity, { stageFromDist, viewDistForStage } from '../../src/ui/Singularity';

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
    // No "Fall Through" / "Deeper" buttons — the journey is physical zoom.
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

describe('stageFromDist — physical zoom mapping', () => {
  it('keeps the black hole visible across a wide approach range (does not vanish early)', () => {
    expect(stageFromDist(40)).toBe(0);
    expect(stageFromDist(11)).toBe(0);
    expect(stageFromDist(1.5)).toBe(0);
  });
  it('enters the void interior only when deep inside, then the next worlds open', () => {
    expect(stageFromDist(1.1)).toBe(6);  // void interior (inside the hole)
    expect(stageFromDist(0.8)).toBe(1);  // neural (hole opened)
    expect(stageFromDist(0.65)).toBe(2); // asteroids
    expect(stageFromDist(0.5)).toBe(3);  // planet
    expect(stageFromDist(0.4)).toBe(4);  // house
    expect(stageFromDist(0.2)).toBe(5);  // monitor (deepest)
  });
});

describe('viewDistForStage — journey worlds are framed, not too zoomed', () => {
  it('frames the planet far back so it is visible', () => {
    expect(viewDistForStage(3)).toBeGreaterThanOrEqual(7);
  });
  it('uses a tiny radius for the void interior (inside the horizon)', () => {
    expect(viewDistForStage(6)).toBeLessThan(1);
  });
  it('gives each world a distinct comfortable distance', () => {
    const planet = viewDistForStage(3);
    const house = viewDistForStage(4);
    expect(planet).toBeGreaterThan(house);
  });
});
