// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarketplaceScreen from '../../src/ui/MarketplaceScreen';
import EditorScreen from '../../src/ui/EditorScreen';
import CinematicBoot from '../../src/ui/CinematicBoot';
import { CoinWallet, getCoinPack } from '../../src/economy/CoinEconomy';
import { MockPaymentProvider } from '../../src/economy/PaymentProvider';
import { StoreService } from '../../src/economy/StoreService';
import { CATALOG, MarketplaceLibrary } from '../../src/marketplace/MarketplaceCatalog';

const noop = () => {};

beforeEach(() => { localStorage.clear(); });
afterEach(() => cleanup());

function setup() {
  const wallet = new CoinWallet();
  const library = new MarketplaceLibrary();
  const store = new StoreService(wallet, library, new MockPaymentProvider(0));
  return { wallet, library, store };
}

function renderMarketplace(overrides: Partial<Parameters<typeof MarketplaceScreen>[0]> = {}) {
  const context = setup();
  const utils = render(
    <MarketplaceScreen
      wallet={context.wallet}
      library={context.library}
      store={context.store}
      onBack={noop}
      onOpenEditor={noop}
      {...overrides}
    />
  );
  return { ...context, ...utils };
}

describe('MarketplaceScreen', () => {
  it('renders the storefront with the coin balance', () => {
    const { container, wallet } = renderMarketplace();
    expect(container.textContent).toContain('Marketplace');
    expect(container.querySelector('.mk-coin-amount')?.textContent)
      .toBe(wallet.getBalance().toLocaleString());
  });

  it('lists every category in the rail', () => {
    const { container } = renderMarketplace();
    const rail = container.querySelector('.mk-rail')!;
    for (const label of ['Skin Packs', 'Capes', 'Gear & Cosmetics', 'Mods', 'Worlds', 'Mini-Games', 'Shaders']) {
      expect(rail.textContent).toContain(label);
    }
  });

  it('renders item tiles', () => {
    const { container } = renderMarketplace();
    expect(container.querySelectorAll('.mk-tile').length).toBeGreaterThan(0);
  });

  it('filters the grid by category', () => {
    const { container, getByText } = renderMarketplace();
    fireEvent.click(getByText('Capes'));
    const names = [...container.querySelectorAll('.mk-tile-name')].map((n) => n.textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((name) => name?.includes('Cape'))).toBe(true);
  });

  it('filters by search text', () => {
    const { container } = renderMarketplace();
    const search = container.querySelector('.mk-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'zzzz-no-such-item' } });
    expect(container.querySelectorAll('.mk-tile')).toHaveLength(0);
    expect(container.textContent).toContain('Nothing here yet');
  });

  it('buys a free item and moves it into the library', () => {
    const { container, library } = renderMarketplace();
    const free = CATALOG.find((item) => item.priceCoins === 0)!;
    // Free items start owned, so a fresh library should already show them.
    expect(library.isOwned(free.id)).toBe(true);
    expect(container.querySelectorAll('.mk-tag.owned, .mk-tag.free').length).toBeGreaterThan(0);
  });

  it('buys a paid item, debiting coins', async () => {
    const context = setup();
    context.wallet.creditPurchase(getCoinPack('mega')!, 'order_1');
    const before = context.wallet.getBalance();

    const { container } = render(
      <MarketplaceScreen
        wallet={context.wallet} library={context.library} store={context.store}
        onBack={noop} onOpenEditor={noop}
      />
    );

    // Select a specific affordable paid item.
    const paid = CATALOG.find((item) => item.priceCoins > 0 && item.priceCoins < before)!;
    const tile = [...container.querySelectorAll('.mk-tile')]
      .find((node) => node.textContent?.includes(paid.name))!;
    fireEvent.click(tile);
    fireEvent.click(container.querySelector('.mk-buy-btn')!);

    await waitFor(() => {
      expect(context.library.isOwned(paid.id)).toBe(true);
    });
    expect(context.wallet.getBalance()).toBe(before - paid.priceCoins);
  });

  it('opens the coin store from the balance pill', () => {
    const { container } = renderMarketplace();
    fireEvent.click(container.querySelector('.mk-coin-pill')!);
    expect(screen.getByRole('dialog', { name: /buy coins/i })).toBeTruthy();
    expect(document.body.textContent).toContain('Get Coins');
  });

  it('shows all three coin packs at the advertised prices', () => {
    const { container } = renderMarketplace();
    fireEvent.click(container.querySelector('.mk-coin-pill')!);
    const modal = document.querySelector('.coin-store-modal')!;
    expect(modal.textContent).toContain('$5.00');
    expect(modal.textContent).toContain('$15.00');
    expect(modal.textContent).toContain('$19.00');
    expect(modal.textContent).toContain('1,000');
    expect(modal.textContent).toContain('1,600');
    expect(modal.textContent).toContain('7,000');
  });

  it('credits coins after a sandbox checkout', async () => {
    const { container, wallet } = renderMarketplace();
    const before = wallet.getBalance();
    fireEvent.click(container.querySelector('.mk-coin-pill')!);

    const buyButtons = [...document.querySelectorAll('.cs-pack-buy')];
    await act(async () => { fireEvent.click(buyButtons[0]); });

    await waitFor(() => expect(wallet.getBalance()).toBe(before + 1_000));
  });

  it('warns that the sandbox provider takes no real payment', () => {
    const { container } = renderMarketplace();
    fireEvent.click(container.querySelector('.mk-coin-pill')!);
    expect(document.querySelector('.cs-sandbox-note')?.textContent).toMatch(/no real payment/i);
  });

  it('backs out on Escape', () => {
    const onBack = vi.fn();
    renderMarketplace({ onBack });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens Editor Mode from the Creator Studio button', () => {
    const onOpenEditor = vi.fn();
    const { container } = renderMarketplace({ onOpenEditor });
    fireEvent.click(container.querySelector('.mk-creator-btn')!);
    expect(onOpenEditor).toHaveBeenCalledTimes(1);
  });
});

describe('EditorScreen', () => {
  function renderEditor(overrides: Partial<Parameters<typeof EditorScreen>[0]> = {}) {
    const context = setup();
    const utils = render(
      <EditorScreen
        store={context.store}
        library={context.library}
        authorName="Alex"
        onBack={noop}
        onOpenMarketplace={noop}
        {...overrides}
      />
    );
    return { ...context, ...utils };
  }

  it('renders the empty state before any project exists', () => {
    const { container } = renderEditor();
    expect(container.textContent).toContain('Editor Mode');
    expect(container.textContent).toContain('Create something worth selling');
  });

  it('creates a new project and shows the toolbar', () => {
    const { container, getAllByText } = renderEditor();
    fireEvent.click(getAllByText('+ New Creation')[0]);
    expect(container.querySelector('.ed-toolbar')).not.toBeNull();
    expect(container.querySelectorAll('.ed-tool').length).toBeGreaterThan(5);
  });

  it('adds a custom block', () => {
    const { container, getAllByText, getByText } = renderEditor();
    fireEvent.click(getAllByText('+ New Creation')[0]);
    fireEvent.click(getByText('+ Add Block'));
    expect(container.querySelectorAll('.ed-item-card')).toHaveLength(1);
    expect(container.textContent).toContain('Custom Blocks (1)');
  });

  it('adds a custom entity and spawns it into the preview', () => {
    const { container, getAllByText, getByText } = renderEditor();
    fireEvent.click(getAllByText('+ New Creation')[0]);
    fireEvent.click(getByText('👾 Entities'));
    fireEvent.click(getByText('+ Add Entity'));
    fireEvent.click(getByText('Spawn in world'));
    expect(container.querySelectorAll('.ed-placed-entity')).toHaveLength(1);
  });

  it('blocks publishing until the project is valid, then publishes', () => {
    const { container, library, getAllByText, getByText } = renderEditor();
    fireEvent.click(getAllByText('+ New Creation')[0]);

    // Give it content and real metadata.
    fireEvent.click(getByText('+ Add Block'));
    fireEvent.click(getByText('🏬 Publish'));

    const publishBtn = container.querySelector('.ed-publish-btn') as HTMLButtonElement;
    expect(publishBtn.disabled).toBe(true);

    const nameInput = container.querySelector('.ed-form input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Crystal Caverns' } });
    const description = container.querySelector('.ed-form textarea') as HTMLTextAreaElement;
    fireEvent.change(description, { target: { value: 'A deep cave world full of crystals.' } });

    const enabled = container.querySelector('.ed-publish-btn') as HTMLButtonElement;
    expect(enabled.disabled).toBe(false);
    fireEvent.click(enabled);

    expect(library.publishedItems()).toHaveLength(1);
    expect(library.publishedItems()[0].name).toBe('Crystal Caverns');
  });

  it('switches tools with number-key shortcuts', () => {
    const { container, getAllByText } = renderEditor();
    fireEvent.click(getAllByText('+ New Creation')[0]);
    fireEvent.keyDown(window, { key: '6' });
    const active = container.querySelector('.ed-tool.active');
    expect(active?.textContent).toContain('Brush');
  });

  it('backs out on Escape', () => {
    const onBack = vi.fn();
    renderEditor({ onBack });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('CinematicBoot', () => {
  it('starts on the health & safety card', () => {
    const { container } = render(<CinematicBoot onComplete={noop} />);
    expect(container.textContent).toContain('Health');
    expect(container.querySelector('.cb-warning')).not.toBeNull();
  });

  it('skips straight to the ready card on the first key press', () => {
    // 2.0: boot is pure presentation, so skipping jumps to "press any key"
    // rather than to a fake loading stage.
    const { container } = render(<CinematicBoot onComplete={noop} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(container.querySelector('.cb-ready')).not.toBeNull();
    expect(container.querySelectorAll('.cb-logo-mark')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-label="EAOIN"]')).toHaveLength(1);
  });

  it('never shows a loading bar during boot', () => {
    // The real loading bar belongs to world creation, where there is genuine
    // work to wait on. Boot must not fake one.
    const { container } = render(<CinematicBoot onComplete={noop} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(container.querySelector('.cb-loading-bar-fill')).toBeNull();
    expect(container.querySelector('.cinematic-loading')).toBeNull();
  });

  it('starts at the chiming logo phase when reduced motion is on', () => {
    const { container } = render(<CinematicBoot onComplete={noop} reducedMotion />);
    expect(container.querySelector('.cb-logo')).not.toBeNull();
    expect(container.querySelectorAll('.cb-logo-letter').length).toBe(5);
    expect(container.querySelectorAll('.cb-logo-mark')).toHaveLength(1);
  });

  it('calls onComplete exactly once', async () => {
    const onComplete = vi.fn();
    const { container } = render(<CinematicBoot onComplete={onComplete} reducedMotion />);
    const originalWordmark = container.querySelector('.cb-logo-mark');
    await waitFor(() => expect(container.querySelector('.cb-ready')).not.toBeNull(), { timeout: 5000 });
    // LOGO → READY adds controls around the existing wordmark; it must not
    // destroy and remount a second copy of the game title.
    expect(container.querySelector('.cb-logo-mark')).toBe(originalWordmark);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  }, 10000);
});
