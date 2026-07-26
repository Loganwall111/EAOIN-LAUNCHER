// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import MainMenu from '../../src/ui/MainMenu';

// Regression: MainMenu referenced an undefined `marketplace` identifier, which threw a
// ReferenceError on first render. React then unmounted the whole tree and the game
// showed a completely black screen instead of the main menu.
describe('MainMenu render', () => {
  it('mounts and advances through boot to the main phase without throwing', async () => {
    const { container } = render(<MainMenu onStart={() => {}} currentSeed="regression_seed" />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    });

    expect(container.textContent).toContain('EAOIN');
    expect(container.querySelector('.main-menu')).not.toBeNull();
  }, 20000);
});
