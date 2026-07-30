// EAOIN Next-Gen Dynamic Seasons System
export enum Season { SPRING = 'spring', SUMMER = 'summer', AUTUMN = 'autumn', WINTER = 'winter' }

export class DynamicSeasons {
  private currentSeason: Season = Season.SPRING;
  private dayOfYear: number = 0;
  private seasonLength: number = 90; // days

  update(deltaTime: number, dayProgress: number) {
    this.dayOfYear = (this.dayOfYear + dayProgress) % 365;
    const seasonIndex = Math.floor(this.dayOfYear / this.seasonLength) % 4;
    const newSeason = [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER][seasonIndex];

    if (newSeason !== this.currentSeason) {
      this.currentSeason = newSeason;
      this.onSeasonChange(this.currentSeason);
    }
  }

  private onSeasonChange(season: Season) {
    console.log(`[EAOIN] Season changed to: ${season}`);
    // Emit global event for foliage, particles, snow, etc.
    window.dispatchEvent(new CustomEvent('eaoin:season-change', { detail: { season } }));
  }

  getCurrentSeason(): Season { return this.currentSeason; }
  getSeasonIntensity(): number {
    // Returns 0-1 value for how "deep" into the season we are
    const progress = (this.dayOfYear % this.seasonLength) / this.seasonLength;
    return Math.sin(progress * Math.PI);
  }
}
