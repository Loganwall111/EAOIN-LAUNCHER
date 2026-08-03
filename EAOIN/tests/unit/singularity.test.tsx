// @vitest-environment jsdom
/**
 * Singularity — the shader-based black hole tab on the main menu.
 *
 * It renders a full-screen canvas and a "Dive In" button that starts the
 * zoom-through journey, revealing the hidden ARG note. This pins the UI
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
  it('renders the black hole canvas and a Dive In button', () => {
    render(<Singularity onBack={noop} />);
    expect(screen.getByText('🕳 The Black Hole')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dive In/ })).toBeTruthy();
    expect(document.querySelector('.singularity-canvas')).toBeTruthy();
  });

  it('fires onBack when Back is clicked', () => {
    const onBack = vi.fn();
    render(<Singularity onBack={onBack} />);
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('dives in and advances through the journey stages', () => {
    vi.useFakeTimers();
    render(<Singularity onBack={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Dive In/ }));
    expect(screen.getByText('Neural Network')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Deeper/ }));
    expect(screen.getByText('Asteroid Field')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Deeper/ }));
    expect(screen.getByText('The Square Planet')).toBeTruthy();
  });

  it('unlocks the secret ending with the correct password', () => {
    vi.useFakeTimers();
    render(<Singularity onBack={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Dive In/ }));
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
