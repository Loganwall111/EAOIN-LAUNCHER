// @vitest-environment jsdom
/**
 * God Mode panel — the Super Settings tab for the ARG-unlocked God Mode.
 *
 * When locked it explains how to unlock it (collect fragments, enter EAOIN);
 * when unlocked it exposes the God Mode master toggle and its powers.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SuperSettingsPanel from '../../src/ui/SuperSettingsPanel';
import { getGodMode } from '../../src/arg/GodMode';
import { SuperSettings } from '../../src/settings/SuperSettings';

const noop = () => {};
const SETTINGS = {} as SuperSettings;

function renderGodTab() {
  const view = render(
    <SuperSettingsPanel settings={SETTINGS} onChange={noop} onClose={noop} />
  );
  fireEvent.click(screen.getByRole('button', { name: /God Mode/i }));
  return view;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('God Mode panel', () => {
  it('shows the locked state when God Mode is not unlocked', () => {
    renderGodTab();
    expect(screen.getByText(/God Mode is LOCKED/)).toBeTruthy();
    expect(screen.getByText(/The key:/)).toBeTruthy();
    expect(screen.getByText('EAOIN')).toBeTruthy();
  });

  it('shows the master toggle and powers once unlocked', () => {
    getGodMode().unlock();
    renderGodTab();
    expect(screen.getByLabelText('God Mode')).toBeTruthy();
    // Toggle God Mode active to reveal the power rows.
    fireEvent.click(screen.getByLabelText('God Mode'));
    expect(screen.getByLabelText('Super edit')).toBeTruthy();
    expect(screen.getByLabelText('God flight')).toBeTruthy();
    expect(screen.getByLabelText('No damage')).toBeTruthy();
    expect(screen.getByLabelText('Unlimited inventory')).toBeTruthy();
  });
});
