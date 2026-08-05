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

describe('Desktop Edition badge', () => {
  it('shows the Desktop Edition badge when running under Electron', () => {
    (window as unknown as { eaoinDesktop?: unknown }).eaoinDesktop = {
      isDesktop: true,
      platform: 'win32',
      versions: { electron: '31.0.0', chrome: '124.0.0', node: '20.0.0' },
    };
    renderTitle();
    expect(screen.getByText('🖥️ Desktop Edition')).not.toBeNull();
  }, 20000);

  it('does not show the badge in a normal browser (no eaoinDesktop)', () => {
    renderTitle();
    expect(screen.queryByText('🖥️ Desktop Edition')).toBeNull();
  }, 20000);
});
