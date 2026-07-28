// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MainMenu from '../../src/ui/MainMenu';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// Regression: MainMenu should render the singleplayer world selection screen
// without throwing and display the correct content.
describe('MainMenu render', () => {
  it('mounts and renders the world selection screen without throwing', () => {
    const { container } = render(
      <MainMenu onStart={() => {}} currentSeed="regression_seed" onBack={() => {}} />
    );

    expect(container.textContent).toContain('Select World');
    expect(container.querySelector('.singleplayer-screen')).not.toBeNull();
  }, 20000);

  it('edits a world type and re-tags the seed when you save', () => {
    window.localStorage.setItem('eaoin_worlds', JSON.stringify([
      {
        id: 'world_1',
        name: 'Edit Me',
        seed: 'plain_seed',
        mode: 'survival',
        lastPlayed: 'Now',
        size: '1 MB',
        growth: '0 chunks',
        icon: '🌍',
        cheats: false,
        mods: false,
        worldType: 'default',
      },
    ]));

    const onStart = vi.fn();
    const { container } = render(
      <MainMenu onStart={onStart} currentSeed="regression_seed" onBack={() => {}} />
    );

    fireEvent.click(container.querySelector('.sp-action-btn.edit') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /Large Biomes/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    fireEvent.click(screen.getByRole('button', { name: /LOAD WORLD/i }));

    expect(onStart).toHaveBeenCalledWith('large_biomes__plain_seed', 'survival');
  });
});
