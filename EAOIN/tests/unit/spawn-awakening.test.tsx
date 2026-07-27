// @vitest-environment jsdom
/**
 * Regression test for the "black canvas wall on load" bug.
 *
 * Root cause: SpawnAwakening's beat timer lived in a useEffect that depended on
 * `finish`, which in turn depended on the `onComplete` prop. App passes a fresh
 * inline `onComplete` on every render, and once the world is running App
 * re-renders several times a second (every HUD telemetry tick). Each re-render
 * tore the 900 ms BLACK beat timer down and restarted it, so the eyes-shut
 * `BLACK` beat never elapsed and two full-screen black eyelid shutters stayed
 * closed over the live game forever — "completely black, can't see my blocks".
 *
 * The fix reads `onComplete` through a ref so the timer is stable across
 * re-renders. This test reproduces the production condition (parent re-rendering
 * faster than a single beat) and asserts the cutscene still opens its eyes and
 * completes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { act } from 'react';
import SpawnAwakening from '../../src/ui/SpawnAwakening';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SpawnAwakening', () => {
  it('completes even when the parent re-renders faster than a beat', () => {
    vi.useFakeTimers();

    const onComplete = vi.fn();
    const { rerender } = render(<SpawnAwakening onComplete={() => onComplete()} reducedMotion />);

    // Mirror App: hand down a brand-new inline callback on every telemetry
    // tick, and tick the clock by less than a single (reduced-motion) beat so
    // that a re-render-dependent timer could never accumulate enough time.
    // Reduced motion collapses every beat to <= 170 ms, so 120 ms steps are
    // always shorter than a beat — exactly the condition that trapped BLACK.
    for (let i = 0; i < 60; i += 1) {
      rerender(<SpawnAwakening onComplete={() => onComplete()} reducedMotion />);
      act(() => {
        vi.advanceTimersByTime(120);
      });
    }

    expect(onComplete).toHaveBeenCalled();
  });

  it('starts with the eyes fully shut (the BLACK beat)', () => {
    const { container } = render(<SpawnAwakening onComplete={() => {}} reducedMotion />);
    // beat-black keeps both eyelids at 50% height — i.e. the screen-covering
    // black wall the player reported. This is the state the bug got stuck in.
    expect((container.firstChild as HTMLElement).className).toContain('beat-black');
  });
});
