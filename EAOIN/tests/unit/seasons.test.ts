import { describe, it, expect } from 'vitest';
import {
  SEASONS, seasonForElapsed, SEASON_DURATION_SECONDS, SEASON_LABELS, SEASON_EMOJI,
} from '../../src/rendering/SeasonalTint';

describe('Seasons — seasonal cycle', () => {
  it('cycles spring → summer → autumn → winter over time', () => {
    expect(SEASONS).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect(seasonForElapsed(0)).toBe('spring');
    expect(seasonForElapsed(SEASON_DURATION_SECONDS - 1)).toBe('spring');
    expect(seasonForElapsed(SEASON_DURATION_SECONDS)).toBe('summer');
    expect(seasonForElapsed(SEASON_DURATION_SECONDS * 2)).toBe('autumn');
    expect(seasonForElapsed(SEASON_DURATION_SECONDS * 3)).toBe('winter');
  });

  it('wraps around after a full year', () => {
    expect(seasonForElapsed(SEASON_DURATION_SECONDS * 4)).toBe('spring');
    expect(seasonForElapsed(SEASON_DURATION_SECONDS * 4 + 1)).toBe('spring');
    expect(seasonForElapsed(SEASON_DURATION_SECONDS * 7 + 1)).toBe('winter');
  });

  it('handles negative elapsed safely', () => {
    expect(seasonForElapsed(-1)).toBe('winter');
  });

  it('provides a label and emoji for every season', () => {
    for (const s of SEASONS) {
      expect(SEASON_LABELS[s]).toBeTruthy();
      expect(SEASON_EMOJI[s]).toBeTruthy();
    }
  });
});
