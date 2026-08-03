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
import Singularity, { stageFromDist } from '../../src/ui/Singularity';

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
  it('maps far distance to the black hole (0)', () => {
    expect(stageFromDist(11)).toBe(0);
    expect(stageFromDist(8)).toBe(0);
  });
  it('maps progressively closer zoom to deeper journey worlds', () => {
    expect(stageFromDist(7)).toBe(1);  // neural
    expect(stageFromDist(5)).toBe(2);  // asteroids
    expect(stageFromDist(4)).toBe(3);  // planet
    expect(stageFromDist(3)).toBe(4);  // house
    expect(stageFromDist(2.2)).toBe(5); // monitor
  });
});
