// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MainMenu from '../../src/ui/MainMenu';

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
});
