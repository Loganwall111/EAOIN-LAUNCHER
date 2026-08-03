// @vitest-environment jsdom
/**
 * CosmicRift — the hidden cosmic rift behind the "?" button.
 *
 * It renders a full-screen canvas, approaches (intensity rises), then plays the
 * Cosmic Girl vision and jumpscare before calling onExit (back to the menu).
 * WebGL itself is browser-only; these tests pin the UI sequence via timers.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import CosmicRift from '../../src/ui/CosmicRift';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
beforeEach(() => vi.useFakeTimers());

const noop = () => {};

/** Fast-forward through the approach + vision + scare, flushing between steps. */
function runTo(ms: number) {
  const step = 250;
  let elapsed = 0;
  while (elapsed < ms) {
    act(() => { vi.advanceTimersByTime(step); });
    elapsed += step;
  }
}

describe('CosmicRift', () => {
  it('renders the rift canvas', () => {
    render(<CosmicRift onExit={noop} />);
    expect(document.querySelector('.cosmic-rift-canvas')).toBeTruthy();
  });

  it('shows the approaching-rift hint at first', () => {
    render(<CosmicRift onExit={noop} />);
    expect(screen.getByText(/colossal rift/)).toBeTruthy();
  });

  it('reaches the vision phase and types the Cosmic Girl lines', () => {
    render(<CosmicRift onExit={noop} />);
    // approach ~ 5.5s to reach full intensity (0.25 -> 1 at +0.05/220ms)
    runTo(6000);
    expect(screen.getByText(/not meant to be here/)).toBeTruthy();
  });

  it('jumpscares then exits back to the menu', () => {
    const onExit = vi.fn();
    render(<CosmicRift onExit={onExit} />);
    runTo(6000);   // reach vision
    runTo(9000);   // run through the lines + scare
    runTo(3000);   // scare duration -> exit
    expect(onExit).toHaveBeenCalled();
  });
});
