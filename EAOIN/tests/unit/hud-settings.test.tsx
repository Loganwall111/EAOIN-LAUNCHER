// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HUD from '../../src/ui/HUD';
import { createDefaultSettings } from '../../src/settings/GameSettings';
import { createDefaultRuntimeStatus } from '../../src/runtime/RuntimeStatus';
import type { ObjectiveStatus } from '../../src/objectives/ObjectiveTracker';

const noop = () => {};
afterEach(() => cleanup());

function renderHud(partialSettings: Partial<ReturnType<typeof createDefaultSettings>> = {}, partial: Partial<ComponentProps<typeof HUD>> = {}) {
  const settings = { ...createDefaultSettings(), ...partialSettings };
  const objectives: ObjectiveStatus[] = [
    { id: 'open_inventory', label: 'Open inventory', complete: false, progress: '0/1' },
  ];
  return render(
    <HUD
      gameMode="survival"
      selectedBlock={1}
      selectedTool="hand"
      toolInventory={{ hand: true } as never}
      inventory={{ 1: 32 } as never}
      survivalStats={{ health: 100, food: 100, stamina: 100 } as never}
      inventoryOpen={false}
      settingsOpen={false}
      settings={settings}
      runtimeStatus={createDefaultRuntimeStatus()}
      objectives={objectives}
      objectivesVisible={true}
      systemsVisible={false}
      onToggleObjectives={noop}
      onToggleSystems={noop}
      craftingMessage="ready"
      onCraftRecipe={noop}
      onCloseInventory={noop}
      onCloseSettings={noop}
      onSettingsChange={noop}
      onSelectBlock={noop}
      {...partial}
    />
  );
}

describe('HUD settings-driven panels', () => {
  it('shows objectives when the setting and visibility flag are both on', () => {
    renderHud({ showObjectives: true });
    expect(screen.getByText(/Objectives \[O\]/i)).toBeTruthy();
    expect(screen.getByText(/Open inventory/i)).toBeTruthy();
  });

  it('hides objectives when the setting is off', () => {
    renderHud({ showObjectives: false });
    expect(screen.queryByText(/Objectives \[O\]/i)).toBeNull();
  });

  it('disables the server browser button when multiplayer servers are turned off', () => {
    renderHud({ multiplayerServersEnabled: false });
    const button = screen.getByRole('button', { name: /Servers/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(screen.queryByText(/Multiplayer Server Browser/i)).toBeNull();
  });
});
