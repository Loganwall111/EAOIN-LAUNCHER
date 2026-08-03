// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach } from 'vitest';
import TitleScreen from '../../src/ui/TitleScreen';
import CharacterCreator from '../../src/ui/CharacterCreator';
import HudFrame from '../../src/ui/HudFrame';
import { DEFAULT_APPEARANCE, NEWS_FEED } from '../../src/ui/theme';
import { createStarterInventory } from '../../src/player/InventoryState';
import { createStarterSurvivalStats } from '../../src/player/SurvivalState';
import { createDefaultRuntimeStatus } from '../../src/runtime/RuntimeStatus';

const noop = () => {};

// Each test mounts a full-screen shell, so tear the DOM down between cases to
// keep role queries unambiguous.
afterEach(() => cleanup());

function renderTitle(overrides: Partial<Parameters<typeof TitleScreen>[0]> = {}) {
  return render(
    <TitleScreen
      appearance={DEFAULT_APPEARANCE}
      signedInUser={null}
      onSignIn={noop}
      onSingleplayer={noop}
      onTutorial={noop}
      onMultiplayer={noop}
      onGameHub={noop}
      onPortalGallery={noop}
      onAlphaLauncher={noop}
      onSingularity={noop}
      onOpenCosmicRift={noop}
      onBackToStable={noop}
      onHorizonOS={noop}
      onMods={noop}
      onMarketplace={noop}
      onEditorMode={noop}
      coinBalance={500}
      onOpenCoinStore={noop}
      onOptions={noop}
      onQuit={noop}
      onEditCharacter={noop}
      onOpenNews={noop}
      onOpenGuide={noop}
      onOpenStats={noop}
      onOpenFriends={noop}
      {...overrides}
    />
  );
}

describe('TitleScreen', () => {
  it('renders the wordmark, tagline and all five menu entries', () => {
    const { container } = renderTitle();
    expect(container.querySelector('.title-logo')?.textContent).toBe('EAOIN');
    expect(container.textContent).toContain('Triple A Sandbox Experience');

    const menu = within(container.querySelector('.title-menu') as HTMLElement);
    for (const label of ['Singleplayer', 'Tutorial World', 'Multiplayer', 'Game Hub', 'Portal Gallery', 'Singularity', 'Back to Stable', 'Alpha Launcher', 'HorizonOS', 'Mods', 'Options', 'Quit Game']) {
      expect(menu.getByRole('button', { name: new RegExp(label, 'i') })).toBeTruthy();
    }
  });

  it('renders every news entry and the player card', () => {
    const { container } = renderTitle();
    for (const entry of NEWS_FEED) {
      expect(container.textContent).toContain(entry.title);
    }
    expect(container.textContent).toContain(`Welcome, ${DEFAULT_APPEARANCE.name}`);
    expect(container.querySelectorAll('.social-btn').length).toBeGreaterThanOrEqual(5);
  });

  it('routes each menu button to its handler', () => {
    const onSingleplayer = vi.fn();
    const onEditCharacter = vi.fn();
    const { container } = renderTitle({ onSingleplayer, onEditCharacter });

    const menu = within(container.querySelector('.title-menu') as HTMLElement);
    fireEvent.click(menu.getByRole('button', { name: /Singleplayer/i }));
    expect(onSingleplayer).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('.title-player-card') as HTMLElement);
    expect(onEditCharacter).toHaveBeenCalledTimes(1);
  });
});

describe('CharacterCreator', () => {
  it('renders all category tabs and the confirm action', () => {
    const { container } = render(
      <CharacterCreator appearance={DEFAULT_APPEARANCE} onChange={noop} onConfirm={noop} onCancel={noop} />
    );
    expect(container.textContent).toContain('Character Creator');
    expect(container.querySelectorAll('.creator-tab').length).toBe(8);
    expect(container.querySelector('.confirm-btn')).not.toBeNull();
    expect(container.querySelectorAll('.bg-cell').length).toBeGreaterThan(0);
  });

  it('emits appearance changes when a swatch is picked', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CharacterCreator appearance={DEFAULT_APPEARANCE} onChange={onChange} onConfirm={noop} onCancel={noop} />
    );
    // First option group on the Appearance tab is Skin Tone.
    const skinGroup = container.querySelectorAll('.option-group')[0];
    const swatches = skinGroup.querySelectorAll('.swatch');
    fireEvent.click(swatches[swatches.length - 1]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].skinTone).not.toBe(DEFAULT_APPEARANCE.skinTone);
  });

  it('switches option panels when a tab is selected', () => {
    const { container } = render(
      <CharacterCreator appearance={DEFAULT_APPEARANCE} onChange={noop} onConfirm={noop} onCancel={noop} />
    );
    const tabs = within(container.querySelector('.creator-tabs') as HTMLElement);
    fireEvent.click(tabs.getByRole('button', { name: /Presets/i }));
    expect(container.textContent).toContain('Explorer');
  });
});

describe('HudFrame', () => {
  const baseProps = {
    appearance: DEFAULT_APPEARANCE,
    survivalStats: createStarterSurvivalStats(),
    inventory: createStarterInventory(),
    selectedBlock: 1 as const,
    selectedTool: 'hand' as const,
    onSelectBlock: noop,
    position: { x: 1256, y: 72, z: -342 },
    yaw: 0,
    timeOfDay: 18.7,
    day: 1287,
    biome: 'Meadows',
    runtimeStatus: createDefaultRuntimeStatus(),
    objectives: [
      { id: 'q1', label: 'Into the Nether', complete: false, progress: '0 / 1' },
      { id: 'q2', label: 'Ancient Technology', complete: false, progress: '0 / 1' },
    ],
    onOpenInventory: noop,
    onOpenGuide: noop,
    onOpenFriends: noop,
    onOpenSettings: noop,
    onOpenQuests: noop,
  };

  it('renders every concept-art region', () => {
    const { container } = render(<HudFrame {...baseProps} />);
    for (const selector of [
      '.hud-player', '.hud-compass', '.hud-clock', '.hud-effects',
      '.hud-minimap', '.hud-quests', '.hud-chat', '.hud-bottom',
      '.hud-nav', '.hud-abilities', '.hud-crosshair', '.hud-equipped',
    ]) {
      expect(container.querySelector(selector), `missing ${selector}`).not.toBeNull();
    }
  });

  it('shows live coordinates, day, clock and biome', () => {
    const { container } = render(<HudFrame {...baseProps} />);
    expect(container.textContent).toContain('X: 1256');
    expect(container.textContent).toContain('Y: 72');
    expect(container.textContent).toContain('Z: -342');
    expect(container.textContent).toContain('DAY 1287');
    expect(container.textContent).toContain('18:42');
    expect(container.textContent).toContain('Meadows');
  });

  it('renders the quest tracker and a full hotbar', () => {
    const { container } = render(<HudFrame {...baseProps} />);
    expect(container.textContent).toContain('Into the Nether');
    // 9 hotbar blocks plus the overflow button
    expect(container.querySelectorAll('.hot-slot').length).toBe(10);
    expect(container.querySelectorAll('.ability-btn').length).toBe(6);
  });

  it('selects a hotbar slot on click', () => {
    const onSelectBlock = vi.fn();
    const { container } = render(<HudFrame {...baseProps} onSelectBlock={onSelectBlock} />);
    const slots = container.querySelectorAll('.hot-slot');
    fireEvent.click(slots[2]);
    expect(onSelectBlock).toHaveBeenCalledTimes(1);
  });

  it('derives status effects from live state instead of a fixed list', () => {
    // Fully-topped-up player in the overworld at midday: buffs, no hazards.
    // (Starter food is 92, just under the buff threshold, so set it explicitly.)
    const { container, rerender } = render(
      <HudFrame {...baseProps} survivalStats={{ health: 100, food: 100, stamina: 100 }} />
    );
    expect(container.textContent).toContain('Regeneration');
    expect(container.textContent).not.toContain('Wounded');

    // Drop health and enter the nether: hazards must appear.
    rerender(<HudFrame
      {...baseProps}
      survivalStats={{ health: 12, food: 90, stamina: 90 }}
      runtimeStatus={{ ...baseProps.runtimeStatus, dimensionId: 'nether' }}
    />);
    expect(container.textContent).toContain('Wounded');
    expect(container.textContent).toContain('Scorching Heat');
    expect(container.textContent).not.toContain('Regeneration');
  });

  it('fires the real key handler when an ability is clicked', () => {
    const onAbility = vi.fn();
    const { container } = render(<HudFrame {...baseProps} onAbility={onAbility} />);
    const abilities = container.querySelectorAll('.ability-btn');
    fireEvent.click(abilities[0]);
    expect(onAbility).toHaveBeenCalledWith('F');
    fireEvent.click(abilities[1]);
    expect(onAbility).toHaveBeenCalledWith('P');
  });

  it('highlights the flight ability while flying', () => {
    const { container, rerender } = render(<HudFrame {...baseProps} flightEnabled={false} />);
    expect(container.querySelector('.ability-btn.active')).toBeNull();
    rerender(<HudFrame {...baseProps} flightEnabled />);
    expect(container.querySelector('.ability-btn.active')).not.toBeNull();
    expect(container.textContent).toContain('Creative Flight');
  });

  it('appends a chat message and switches channel tabs', () => {
    const { container } = render(<HudFrame {...baseProps} />);
    const input = container.querySelector('.chat-entry input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello world' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(container.textContent).toContain('hello world');

    const tabs = within(container.querySelector('.chat-tabs') as HTMLElement);
    fireEvent.click(tabs.getByRole('button', { name: 'SYSTEM' }));
    expect(container.querySelector('.chat-tab.active')?.textContent).toBe('SYSTEM');
  });
});
