// @vitest-environment jsdom
/**
 * Regression test: the title screen's Guide (📖) button used to silently
 * redirect to the world-selection screen instead of opening any actual
 * instructions. It must now open the real How to Play panel.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, act, fireEvent, screen } from '@testing-library/react';
import App from '../../src/App';

afterEach(cleanup);

describe('Guide button wiring', () => {
  it('opens the real How to Play panel from the title screen, not the world list', async () => {
    vi.useFakeTimers();
    const { container } = render(<App />);

    // Fast-forward past the launcher boot and click Play to reach the boot.
    await act(async () => { vi.advanceTimersByTime(3000); });
    await act(async () => {
      const play = document.querySelector('.launcher-play') as HTMLButtonElement | null;
      play?.click();
    });

    // Fast-forward through the whole cinematic boot sequence to the title.
    for (let step = 0; step < 80; step += 1) {
      await act(async () => { vi.advanceTimersByTime(500); });
      if (screen.queryByRole('button', { name: /guide/i })) break;
      const pressAny = screen.queryByRole('button', { name: /press any key/i });
      if (pressAny) fireEvent.click(pressAny);
    }

    const guideButton = screen.getByRole('button', { name: /guide/i });
    fireEvent.click(guideButton);

    // The real guide content must be on screen…
    expect(screen.getByText(/How to Play/i)).toBeTruthy();
    expect(screen.getByText(/Mine the block you are looking at/i)).toBeTruthy();
    // …and the world-selection screen must NOT be what opened instead.
    expect(container.querySelector('.singleplayer-screen')).toBeNull();

    vi.useRealTimers();
  });
});
