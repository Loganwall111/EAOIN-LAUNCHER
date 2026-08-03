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

  it('reveals the ARG note after diving in', () => {
    vi.useFakeTimers();
    render(<Singularity onBack={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Dive In/ }));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText('📜 A Note')).toBeTruthy();
    expect(screen.getByText(/The key is EAOIN/)).toBeTruthy();
  });
});
