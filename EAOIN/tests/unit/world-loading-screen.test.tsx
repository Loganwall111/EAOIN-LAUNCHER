// @vitest-environment jsdom
import { act } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WorldLoadingScreen from '../../src/ui/WorldLoadingScreen';

const baseProps = {
  worldName: 'Regression World',
  worldType: 'default' as const,
  seed: 'black-screen-regression',
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WorldLoadingScreen startup failures', () => {
  it('never reveals the HUD over a failed black canvas', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const onRetry = vi.fn();
    const { getByRole, getByText } = render(
      <WorldLoadingScreen
        {...baseProps}
        loadingProgress={{
          percent: 42,
          label: 'World failed to start',
          ready: false,
          error: 'Cannot access generator before initialization',
        }}
        onComplete={onComplete}
        onRetry={onRetry}
      />
    );

    act(() => vi.advanceTimersByTime(20_100));

    expect(onComplete).not.toHaveBeenCalled();
    expect(getByRole('alert').textContent).toContain('WORLD STARTUP FAILED');
    expect(getByText('Cannot access generator before initialization')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: /retry renderer/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('only uses the safety cap after gameplay systems are wired', () => {
    vi.useFakeTimers();
    const earlyComplete = vi.fn();
    const early = render(
      <WorldLoadingScreen
        {...baseProps}
        loadingProgress={{ percent: 55, label: 'Meshing spawn', ready: false }}
        onComplete={earlyComplete}
      />
    );
    act(() => vi.advanceTimersByTime(20_100));
    expect(earlyComplete).not.toHaveBeenCalled();
    early.unmount();

    const playableComplete = vi.fn();
    render(
      <WorldLoadingScreen
        {...baseProps}
        loadingProgress={{ percent: 76, label: 'Controls wired', ready: false }}
        onComplete={playableComplete}
      />
    );
    act(() => vi.advanceTimersByTime(20_100));
    expect(playableComplete).toHaveBeenCalledTimes(1);
  });
});
