// @vitest-environment jsdom
/**
 * AlphaLauncher — an in-game launcher that opens the EAOIN 2.0 alpha build in a
 * new tab. Clicking Play calls window.open with the configured ALPHA_URL.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AlphaLauncher from '../../src/ui/AlphaLauncher';
import { ALPHA_URL } from '../../src/version';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const noop = () => {};

describe('AlphaLauncher', () => {
  it('shows the alpha highlights and the configured alpha URL', () => {
    render(<AlphaLauncher onBack={noop} />);
    expect(screen.getByText('EAOIN 2.0 Alpha')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Play Alpha/ })).toBeTruthy();
    expect(screen.getAllByText(ALPHA_URL).length).toBeGreaterThanOrEqual(1);
    // Instructions live inside the game itself.
    expect(screen.getByText(/How to play the alpha/)).toBeTruthy();
  });

  it('opens the alpha URL in a new tab when Play is clicked', () => {
    const open = vi.fn();
    vi.spyOn(window, 'open').mockImplementation(open as never);
    render(<AlphaLauncher onBack={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Play Alpha/ }));
    expect(open).toHaveBeenCalledWith(ALPHA_URL, '_blank', expect.anything());
  });

  it('fires onBack when Back is clicked', () => {
    const onBack = vi.fn();
    render(<AlphaLauncher onBack={onBack} />);
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });
});
