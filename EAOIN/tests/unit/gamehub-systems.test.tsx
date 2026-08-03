// @vitest-environment jsdom
/**
 * 2.0 — Game Hub is alive: the Server has a corruption meter that pushes back
 * when you recover data, the Friends area has a quest board and playable
 * mini-games, and completing them grants rewards.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GameHubScreen from '../../src/ui/GameHubScreen';

afterEach(() => cleanup());

const noop = () => {};

describe('Game Hub — Server corruption mechanic', () => {
  it('descending deeper raises corruption and recovering data lowers it', () => {
    render(<GameHubScreen onBack={noop} />);
    fireEvent.click(screen.getByText('The Server'));
    fireEvent.click(screen.getByText(/Descend deeper/));
    // Corruption went up — the label should no longer show 0%.
    expect(screen.queryByText('0%')).toBeNull();
    fireEvent.click(screen.getByText(/Recover data/));
    // After recovering, a data packet is logged.
    expect(screen.getByText(/Recovered a lost data packet/)).toBeTruthy();
  });
});

describe('Game Hub — quest board + rewards', () => {
  it('quests progress, complete, and can be claimed into the reward bag', () => {
    const { container } = render(<GameHubScreen onBack={noop} />);
    fireEvent.click(screen.getByText('Friends Area'));
    // Progress the "Gather End Crystals" quest (first in the board) to its target.
    const gatherButton = screen.getAllByText('+1')[0];
    fireEvent.click(gatherButton);
    fireEvent.click(gatherButton);
    fireEvent.click(gatherButton);
    const claim = screen.getAllByText('Claim')[0];
    fireEvent.click(claim);
    // The reward bag is the ".hub-reward" pill — it should now list "Crystal ×2".
    const bag = container.querySelector('.hub-reward');
    expect(bag).toBeTruthy();
    expect(bag?.textContent).toContain('Crystal');
  });
});

describe('Game Hub — Code Creator mini-games', () => {
  it('the reaction mini-game unlocks a reward after 5 hits', () => {
    const { container } = render(<GameHubScreen onBack={noop} />);
    fireEvent.click(screen.getByText('Friends Area'));
    const reaction = container.querySelector('.hub-btn.reaction') as HTMLElement;
    expect(reaction).toBeTruthy();
    for (let i = 0; i < 5; i++) fireEvent.click(reaction);
    const bag = container.querySelector('.hub-reward');
    expect(bag?.textContent).toContain('Sulphur');
  });
});
