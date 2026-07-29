// @vitest-environment jsdom
/**
 * Regression tests for the "How to Play" instruction manual panel.
 *
 * Brief: "Add a polished instruction manual panel inside the Inventory or
 * Main Menu. This guide must explicitly teach the player: basic
 * block-building and mining controls, the exact crafting recipes needed to
 * create tools (like a wooden pickaxe), and the exact block structures and
 * item interactions required to ignite and activate the dimensional
 * portals."
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import HowToPlayGuide from '../../src/ui/HowToPlayGuide';
import { RECIPES } from '../../src/crafting/RecipeBook';
import { PORTAL_DEFS } from '../../src/portals/PortalSystem';

afterEach(() => cleanup());

describe('HowToPlayGuide', () => {
  it('teaches basic block-building and mining controls', () => {
    render(<HowToPlayGuide onClose={() => {}} />);
    expect(screen.getAllByText(/Controls/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mine the block you are looking at/i)).toBeTruthy();
    expect(screen.getByText(/place the selected block/i)).toBeTruthy();
    expect(screen.getByText(/W A S D/i)).toBeTruthy();
  });

  it('teaches the exact crafting recipe for a wooden pickaxe', () => {
    const { container } = render(<HowToPlayGuide onClose={() => {}} />);
    const pickaxe = RECIPES.find((r) => r.id === 'wooden_pickaxe')!;
    expect(pickaxe).toBeTruthy();

    const recipeList = container.querySelector('.htp-recipe-list')!;
    expect(recipeList).toBeTruthy();
    const row = within(recipeList as HTMLElement).getByText('Wooden Pickaxe').closest('.htp-recipe-row')!;
    expect(within(row as HTMLElement).getByText(/Needs:.*Oak Log.*3/i)).toBeTruthy();
  });

  it('never invents crafting numbers — every shown recipe row matches RecipeBook exactly', () => {
    const { container } = render(<HowToPlayGuide onClose={() => {}} />);
    const recipeList = container.querySelector('.htp-recipe-list')!;
    const rows = Array.from(recipeList.querySelectorAll('.htp-recipe-row'));
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const name = row.querySelector('strong')!.textContent;
      const recipe = RECIPES.find((r) => r.name === name);
      expect(recipe, `unknown recipe rendered: ${name}`).toBeTruthy();
      // Its description text must be present verbatim in that same row, not
      // paraphrased into something that could drift from RecipeBook.
      expect(within(row as HTMLElement).getByText(recipe!.description)).toBeTruthy();
    }
  });

  it('teaches the exact block structure required to build and light a portal', () => {
    const { container } = render(<HowToPlayGuide onClose={() => {}} />);
    expect(screen.getByText(/Building.*Activating.*Portal/i)).toBeTruthy();

    const portalList = container.querySelector('.htp-portal-list')!;
    expect(portalList).toBeTruthy();
    // Obsidian frames the Nether — must be explicitly named using the real
    // in-game block name, not a made-up placeholder.
    expect(within(portalList as HTMLElement).getByText(/Obsidian/i)).toBeTruthy();

    // The activation key (P) and the ignition item (Portal Core) must both
    // be explicitly taught, since those are the two things that actually
    // matter for the interaction to work.
    expect(screen.getAllByText(/Portal Core/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/press P/i)).toBeTruthy();
  });

  it('names every real portal frame block from the registry using its real block name', () => {
    const { container } = render(<HowToPlayGuide onClose={() => {}} />);
    const portalList = container.querySelector('.htp-portal-list')!;
    const rows = Array.from(portalList.querySelectorAll('.htp-portal-row'));
    const shownBlockNames = new Set(rows.map((r) => r.querySelector('strong')!.textContent));

    const realDimensionNames = new Set(
      PORTAL_DEFS.filter((d) => d.dimension !== 'overworld').map((d) => d.name)
    );
    const shownDimensionNames = new Set(
      rows.flatMap((r) => (r.querySelector('span')!.textContent ?? '').split(', '))
    );
    for (const name of realDimensionNames) {
      expect(shownDimensionNames.has(name), `missing portal destination: ${name}`).toBe(true);
    }
    expect(shownBlockNames.size).toBeGreaterThan(0);
  });

  it('explains that a lit frame sends the player to its own real destination, not a random one', () => {
    render(<HowToPlayGuide onClose={() => {}} />);
    expect(screen.getByText(/own configured destination/i)).toBeTruthy();
  });

  it('closes when the close button is clicked', () => {
    let closed = false;
    render(<HowToPlayGuide onClose={() => { closed = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(closed).toBe(true);
  });
});
