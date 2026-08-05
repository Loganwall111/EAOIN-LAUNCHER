// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TitleScreen from '../../src/ui/TitleScreen';
import { DEFAULT_APPEARANCE } from '../../src/ui/theme';

const noop = () => {};

function renderTitle() {
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
      onBossRush={noop}
      onCustomDim={noop}
      onQuestJournal={noop}
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
    />
  );
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { eaoinDesktop?: unknown }).eaoinDesktop;
});

// Branding unification: the "Desktop Edition" label was removed so the menu is
// identical across the web build and the packaged desktop app.
describe('Unified menu branding', () => {
  it('does NOT show a "Desktop Edition" badge even when running under Electron', () => {
    (window as unknown as { eaoinDesktop?: unknown }).eaoinDesktop = {
      isDesktop: true,
      platform: 'win32',
      versions: { electron: '31.0.0', chrome: '124.0.0', node: '20.0.0' },
    };
    renderTitle();
    expect(screen.queryByText('🖥️ Desktop Edition')).toBeNull();
    expect(screen.queryByText(/Desktop Edition/i)).toBeNull();
    expect(screen.queryByText(/Desktop Version/i)).toBeNull();
  }, 20000);

  it('does not show the badge in a normal browser (no eaoinDesktop)', () => {
    renderTitle();
    expect(screen.queryByText('🖥️ Desktop Edition')).toBeNull();
  }, 20000);

  it('renders the unified top bar + centre row + footer layout', () => {
    const { container } = renderTitle();
    expect(container.querySelector('.tm-topbar')).not.toBeNull();
    expect(container.querySelector('.tm-center')).not.toBeNull();
    expect(container.querySelector('.tm-secondary')).not.toBeNull();
    expect(container.querySelector('.tm-footer')).not.toBeNull();
    expect(container.textContent).toContain('STORE & CREATION');
  }, 20000);
});
