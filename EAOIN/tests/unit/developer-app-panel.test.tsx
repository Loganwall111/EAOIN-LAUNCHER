/**
 * Developer App Panel regression tests.
 *
 * The Alpha Access requirement, end to end:
 *  - general players see nothing: no button, no menu, no way in;
 *  - the developer trigger opens the panel instantly on a granted machine;
 *  - the unlock code is the only path through the gate on a fresh machine;
 *  - every control writes live into the developer tuning store.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DeveloperAppPanel from '../../src/ui/DeveloperAppPanel';
import { developerAccess, DEVELOPER_UNLOCK_CODE } from '../../src/dev/DeveloperAccess';
import { developerTuningStore, DEFAULT_DEVELOPER_TUNING } from '../../src/dev/DeveloperTuning';

beforeEach(() => {
  developerAccess.lock();
  developerTuningStore.reset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  developerAccess.lock();
  developerTuningStore.reset();
  window.localStorage.clear();
});

function triggerDeveloperHotkey() {
  fireEvent.keyDown(window, { key: '`' });
}

describe('DeveloperAppPanel — Alpha Access lockdown', () => {
  it('renders absolutely nothing for a general player', () => {
    const { container } = render(<DeveloperAppPanel />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByLabelText('Developer app panel')).toBeNull();
    expect(screen.queryByLabelText('Developer access lock')).toBeNull();
  });

  it('the developer trigger raises the lock gate, not the controls', () => {
    render(<DeveloperAppPanel />);
    triggerDeveloperHotkey();
    expect(screen.getByLabelText('Developer access lock')).toBeTruthy();
    expect(screen.queryByLabelText('Developer app panel')).toBeNull();
  });

  it('triggering a second time hides the gate again', () => {
    render(<DeveloperAppPanel />);
    triggerDeveloperHotkey();
    triggerDeveloperHotkey();
    expect(screen.queryByLabelText('Developer access lock')).toBeNull();
  });

  it('rejects a wrong unlock code with visible feedback and stays locked', () => {
    render(<DeveloperAppPanel />);
    triggerDeveloperHotkey();
    fireEvent.change(screen.getByLabelText('Unlock code'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByText('Unlock'));
    expect(screen.getByRole('alert').textContent).toContain('Access denied');
    expect(developerAccess.isGranted()).toBe(false);
    expect(screen.queryByLabelText('Developer app panel')).toBeNull();
  });

  it('typing backquote into the code field never toggles the gate by accident', () => {
    render(<DeveloperAppPanel />);
    triggerDeveloperHotkey();
    const input = screen.getByLabelText('Unlock code');
    fireEvent.keyDown(input, { key: '`' });
    expect(screen.getByLabelText('Developer access lock')).toBeTruthy();
  });

  it('the correct code opens the panel instantly', () => {
    render(<DeveloperAppPanel />);
    triggerDeveloperHotkey();
    fireEvent.change(screen.getByLabelText('Unlock code'), { target: { value: DEVELOPER_UNLOCK_CODE } });
    fireEvent.click(screen.getByText('Unlock'));
    expect(developerAccess.isGranted()).toBe(true);
    expect(screen.getByLabelText('Developer app panel')).toBeTruthy();
    expect(screen.getByText(/ALPHA ACCESS — DEV BUILD ONLY/)).toBeTruthy();
  });

  it('a granted developer opens the panel with one keypress — no gate', () => {
    developerAccess.submitCode(DEVELOPER_UNLOCK_CODE);
    developerAccess.dismiss();
    const { container } = render(<DeveloperAppPanel />);
    expect(container.innerHTML).toBe(''); // closed until triggered
    triggerDeveloperHotkey();
    expect(screen.getByLabelText('Developer app panel')).toBeTruthy();
    expect(screen.queryByLabelText('Developer access lock')).toBeNull();
  });

  it('Escape closes the panel but keeps the grant', () => {
    developerAccess.submitCode(DEVELOPER_UNLOCK_CODE);
    render(<DeveloperAppPanel />);
    expect(screen.getByLabelText('Developer app panel')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByLabelText('Developer app panel')).toBeNull();
    expect(developerAccess.isGranted()).toBe(true);
  });
});

describe('DeveloperAppPanel — live controls', () => {
  beforeEach(() => {
    developerAccess.submitCode(DEVELOPER_UNLOCK_CODE);
  });

  it('the terrain amplification slider drives the 1.18 noise multiplier live', () => {
    render(<DeveloperAppPanel />);
    const slider = screen.getByLabelText('Terrain Amplification');
    fireEvent.change(slider, { target: { value: '2' } });
    expect(developerTuningStore.get().terrainAmplification).toBe(2);
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(developerTuningStore.get().terrainAmplification).toBe(0.5);
  });

  it('the day/night speed slider and clock freeze drive the world clock tuning', () => {
    render(<DeveloperAppPanel />);
    fireEvent.change(screen.getByLabelText('Day / Night Speed'), { target: { value: '4' } });
    expect(developerTuningStore.get().dayNightSpeed).toBe(4);
    fireEvent.click(screen.getByLabelText('Freeze world clock'));
    expect(developerTuningStore.get().timeFrozen).toBe(true);
  });

  it('lighting preset buttons switch the applied preset', () => {
    render(<DeveloperAppPanel />);
    fireEvent.click(screen.getByText('Midnight'));
    expect(developerTuningStore.get().lightingPreset).toBe('midnight');
    fireEvent.click(screen.getByText('Vanilla'));
    expect(developerTuningStore.get().lightingPreset).toBe('vanilla');
  });

  it('biome modification toggles flip their flags cleanly', () => {
    render(<DeveloperAppPanel />);
    expect(developerTuningStore.get().biomeMods.caves).toBe(true);
    fireEvent.click(screen.getByLabelText('Caves & Caverns'));
    expect(developerTuningStore.get().biomeMods.caves).toBe(false);
    // Only that flag changed.
    expect(developerTuningStore.get().biomeMods.lakes).toBe(true);
    expect(developerTuningStore.get().biomeMods.vegetation).toBe(true);
    fireEvent.click(screen.getByLabelText('Caves & Caverns'));
    expect(developerTuningStore.get().biomeMods.caves).toBe(true);
  });

  it('reset restores every default', () => {
    render(<DeveloperAppPanel />);
    fireEvent.change(screen.getByLabelText('Terrain Amplification'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByLabelText('Structures'));
    fireEvent.click(screen.getByText('↺ Reset to defaults'));
    expect(developerTuningStore.get()).toEqual({
      ...DEFAULT_DEVELOPER_TUNING,
      biomeMods: { ...DEFAULT_DEVELOPER_TUNING.biomeMods },
    });
  });
});
