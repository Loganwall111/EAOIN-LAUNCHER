// @vitest-environment jsdom
/**
 * Singularity — the shader-based black hole tab on the main menu.
 *
 * It renders a full-screen canvas, a "Fall Through" button, and camera
 * / disk / gravity sliders. WebGL itself is browser-only.
 * structure and the journey reveal flow (WebGL itself is browser-only).
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import Singularity from '../../src/ui/Singularity';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const noop = () => {};

describe('Singularity', () => {
  it('renders the black hole canvas, Fall Through button, and sliders', () => {
    render(<Singularity onBack={noop} />);
    expect(screen.getByText('🕳 The Black Hole')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Fall Through/ })).toBeTruthy();
    expect(screen.getByText(/Disk thickness/)).toBeTruthy();
    expect(screen.getByText(/Gravity strength/)).toBeTruthy();
    expect(document.querySelector('.singularity-canvas')).toBeTruthy();
  });

  it('fires onBack when Back is clicked', () => {
    const onBack = vi.fn();
    render(<Singularity onBack={onBack} />);
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('falls through and advances through the journey stages', () => {
    vi.useFakeTimers();
    render(<Singularity onBack={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Fall Through/ }));
    expect(screen.getByText('Neural Network')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Deeper/ }));
    expect(screen.getByText('Asteroid Field')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Deeper/ }));
    expect(screen.getByText('The Square Planet')).toBeTruthy();
  });

  it('unlocks the secret ending with the correct password', () => {
    vi.useFakeTimers();
    render(<Singularity onBack={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Fall Through/ }));
    // advance to the monitor stage
    fireEvent.click(screen.getByRole('button', { name: /Deeper/ }));
    fireEvent.click(screen.getByRole('button', { name: /Deeper/ }));
    fireEvent.click(screen.getByRole('button', { name: /Deeper/ }));
    fireEvent.click(screen.getByRole('button', { name: /Deeper/ }));
    expect(screen.getByText(/ENTER PASSWORD/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('password'), { target: { value: 'eaoin' } });
    fireEvent.click(screen.getByRole('button', { name: /Enter/ }));
    expect(screen.getByText(/THE COSMIC GIRL RETURNS/)).toBeTruthy();
    expect(screen.getByText(/GOD MODE UNLOCKED/)).toBeTruthy();
  });
});
