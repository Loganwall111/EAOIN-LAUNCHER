// @vitest-environment jsdom
/**
 * AlphaLauncher — the overhauled 2.0 alpha launcher. It runs a short boot
 * sequence, then shows the Alpha Launcher with a version picker + patch notes,
 * and Play opens the alpha build at ALPHA_URL.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import AlphaLauncher from '../../src/ui/AlphaLauncher';
import { ALPHA_URL } from '../../src/version';
import { latestAlphaBuild } from '../../src/launcher/AlphaVersions';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
beforeEach(() => vi.useFakeTimers());

const noop = () => {};

/** Fast-forward through the boot sequence so the launcher is visible. */
function bootThrough() {
  // Step through the boot interval one tick at a time, flushing React after
  // each, so the interval can advance bootLine and finally set stage 'ready'.
  for (let i = 0; i < 8; i++) {
    act(() => { vi.advanceTimersByTime(260); });
  }
}

describe('AlphaLauncher boot sequence', () => {
  it('shows a boot sequence before the launcher is ready', () => {
    render(<AlphaLauncher onBack={noop} />);
    expect(screen.getByText(/ALPHA LAUNCHER/)).toBeTruthy();
    // Not yet on the main launcher UI.
    expect(screen.queryByText(/Play/)).toBeNull();
  });

  it('lands on the launcher after the boot sequence', () => {
    render(<AlphaLauncher onBack={noop} />);
    bootThrough();
    expect(screen.getByText('🚀 EAOIN 2.0 Alpha')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Play/ })).toBeTruthy();
    expect(screen.getAllByText(ALPHA_URL).length).toBeGreaterThanOrEqual(1);
  });
});

describe('AlphaLauncher version picker + patch notes', () => {
  it('shows the alpha version list and the latest build patch notes', () => {
    render(<AlphaLauncher onBack={noop} />);
    bootThrough();
    const latest = latestAlphaBuild();
    expect(screen.getByText('📦 Alpha Versions')).toBeTruthy();
    expect(screen.getByText('📜 Patch Notes — ' + latest.version)).toBeTruthy();
    expect(screen.getByText('LATEST')).toBeTruthy();
  });

  it('opens the alpha URL in a new tab when Play is clicked', () => {
    const open = vi.fn();
    vi.spyOn(window, 'open').mockImplementation(open as never);
    render(<AlphaLauncher onBack={noop} />);
    bootThrough();
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    expect(open).toHaveBeenCalledWith(ALPHA_URL, '_blank', expect.anything());
  });

  it('toggles the settings panel', () => {
    render(<AlphaLauncher onBack={noop} />);
    bootThrough();
    fireEvent.click(screen.getByLabelText('Alpha settings'));
    expect(screen.getByText('⚙ Alpha Launcher Settings')).toBeTruthy();
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('⚙ Alpha Launcher Settings')).toBeNull();
  });
});

describe('AlphaLauncher navigation', () => {
  it('fires onBack when Back is clicked', () => {
    const onBack = vi.fn();
    render(<AlphaLauncher onBack={onBack} />);
    bootThrough();
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });
});
