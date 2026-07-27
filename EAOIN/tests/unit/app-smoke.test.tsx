// @vitest-environment jsdom
/**
 * App smoke test.
 *
 * Unit tests exercise modules in isolation, which means a crash in the wiring
 * between them — a temporal-dead-zone reference, a bad import, a component
 * that throws on first paint — can pass every suite and still leave a black
 * screen. This mounts the real `App` and drives the whole boot sequence.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, act } from '@testing-library/react';
import App from '../../src/App';

afterEach(cleanup);

/** Console noise that is expected in jsdom and not a real failure. */
function isEnvironmentNoise(entry: unknown): boolean {
  const text = String(entry);
  return text.includes('act(')
    || text.includes('getContext')
    || text.includes('not implemented')
    || text.includes('Not implemented');
}

describe('App smoke', () => {
  it('mounts and runs the full boot sequence without a React error', async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args); });
    vi.useFakeTimers();

    render(<App />);
    // The boot sequence (warning → engine → studio → credits → presents →
    // logo → title → ready) runs on timers totalling ~30s.
    await act(async () => { vi.advanceTimersByTime(45_000); });

    vi.useRealTimers();
    spy.mockRestore();

    const real = errors.filter((entry) => !isEnvironmentNoise(entry));
    expect(real, JSON.stringify(real).slice(0, 900)).toHaveLength(0);
  });

  it('renders the boot sequence and then hands off to the menu', async () => {
    vi.useFakeTimers();
    const { container } = render(<App />);

    // The very first card is the health & safety warning.
    expect(container.querySelector('.cinematic-boot')).toBeTruthy();

    // The credits phase must actually appear — it is the piece that makes the
    // intro read as a title sequence rather than a loading screen.
    let sawCredits = false;
    for (let step = 0; step < 60; step += 1) {
      await act(async () => { vi.advanceTimersByTime(500); });
      if (container.querySelector('.cb-credits')) { sawCredits = true; break; }
    }
    expect(sawCredits).toBe(true);

    // And the sequence eventually reaches something interactive.
    await act(async () => { vi.advanceTimersByTime(45_000); });
    vi.useRealTimers();
    expect(container.textContent).toBeTruthy();
  });
});
