// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import MultiplayerScreen from '../../src/ui/MultiplayerScreen';
import ModsScreen from '../../src/ui/ModsScreen';
import OptionsScreen from '../../src/ui/OptionsScreen';
import { ModPackRegistry } from '../../src/modding/ModPackRegistry';
import { ALL_SERVERS } from '../../src/networking/ServerBrowser';
import { createDefaultSettings } from '../../src/settings/GameSettings';

const noop = () => {};
afterEach(() => cleanup());

describe('MultiplayerScreen', () => {
  it('lists real servers from the registry', () => {
    const { container } = render(<MultiplayerScreen onBack={noop} onJoin={noop} />);
    expect(container.textContent).toContain('Multiplayer');
    expect(container.querySelectorAll('.row-card').length).toBe(ALL_SERVERS.length);
    expect(container.textContent).toContain(ALL_SERVERS[0].name);
  });

  it('filters servers by search text', () => {
    const { container } = render(<MultiplayerScreen onBack={noop} onJoin={noop} />);
    const input = container.querySelector('.ui-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'zzzz-no-such-server' } });
    expect(container.querySelectorAll('.row-card').length).toBe(0);
    expect(container.textContent).toContain('No servers match');
  });

  it('joins the selected server', () => {
    const onJoin = vi.fn();
    const { container } = render(<MultiplayerScreen onBack={noop} onJoin={onJoin} />);
    fireEvent.click(container.querySelector('.confirm-btn') as HTMLElement);
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onJoin.mock.calls[0][0].id).toBe(ALL_SERVERS[0].id);
  });

  it('switches to the friends tab', () => {
    const { container } = render(<MultiplayerScreen onBack={noop} onJoin={noop} />);
    const tabs = within(container.querySelector('.seg-group') as HTMLElement);
    fireEvent.click(tabs.getByRole('button', { name: 'Friends' }));
    expect(container.textContent).toContain('CraftMaster42');
  });

  it('backs out on Escape', () => {
    const onBack = vi.fn();
    render(<MultiplayerScreen onBack={onBack} onJoin={noop} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('ModsScreen', () => {
  it('renders installed mods and reflects the enabled count', () => {
    const registry = new ModPackRegistry();
    const { container } = render(
      <ModsScreen registry={registry} revision={0} onToggle={noop} onBack={noop} />
    );
    expect(container.querySelectorAll('.row-card').length).toBe(registry.list().length);
    expect(container.textContent).toContain(`${registry.getTotalEnabled()} enabled`);
  });

  it('toggling a mod calls back with that mod id', () => {
    const registry = new ModPackRegistry();
    const onToggle = vi.fn();
    const { container } = render(
      <ModsScreen registry={registry} revision={0} onToggle={onToggle} onBack={noop} />
    );
    const firstToggle = container.querySelector('.row-card .toggle') as HTMLElement;
    fireEvent.click(firstToggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle.mock.calls[0][0]).toBe(registry.list()[0].id);
  });

  it('re-reads the registry when the revision changes', () => {
    const registry = new ModPackRegistry();
    const before = registry.getTotalEnabled();
    const { container, rerender } = render(
      <ModsScreen registry={registry} revision={0} onToggle={noop} onBack={noop} />
    );
    registry.toggle(registry.list()[0].id);
    rerender(<ModsScreen registry={registry} revision={1} onToggle={noop} onBack={noop} />);
    expect(container.textContent).toContain(`${registry.getTotalEnabled()} enabled`);
    expect(registry.getTotalEnabled()).not.toBe(before);
  });
});

describe('OptionsScreen', () => {
  it('renders the four sections', () => {
    const { container } = render(
      <OptionsScreen settings={createDefaultSettings()} onChange={noop} onBack={noop} />
    );
    const nav = within(container.querySelector('.side-nav') as HTMLElement);
    for (const label of ['Video', 'Audio', 'Gameplay', 'Accessibility']) {
      expect(nav.getByRole('button', { name: new RegExp(label, 'i') })).toBeTruthy();
    }
  });

  it('writes changes through clampSettings', () => {
    const onChange = vi.fn();
    const { container } = render(
      <OptionsScreen settings={createDefaultSettings()} onChange={onChange} onBack={noop} />
    );
    fireEvent.click(container.querySelector('.toggle') as HTMLElement);
    expect(onChange).toHaveBeenCalledTimes(1);
    // Result must still be a fully-formed settings object.
    expect(onChange.mock.calls[0][0]).toHaveProperty('qualityPreset');
    expect(onChange.mock.calls[0][0]).toHaveProperty('volume');
  });

  it('clamps an out-of-range render scale', () => {
    const onChange = vi.fn();
    const { container } = render(
      <OptionsScreen settings={createDefaultSettings()} onChange={onChange} onBack={noop} />
    );
    const range = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(range, { target: { value: '99' } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].renderScale).toBeLessThanOrEqual(1.5);
  });

  it('switches to the accessibility section', () => {
    const { container } = render(
      <OptionsScreen settings={createDefaultSettings()} onChange={noop} onBack={noop} />
    );
    const nav = within(container.querySelector('.side-nav') as HTMLElement);
    fireEvent.click(nav.getByRole('button', { name: /Accessibility/i }));
    expect(container.textContent).toContain('Reduced motion');
  });
});
