export interface CityEconomyStats {
  name: string;
  lengthKm: number;
  districts: number;
  population: number;
  activeJobs: number;
  transitLines: number;
  powerDemandMw: number;
  powerGeneratedMw: number;
  waterDemandMl: number;
  sewerLoadPercent: number;
  marketVolume: number;
  happiness: number;
  loreEvents: number;
}

export class CityEconomyRuntime {
  private elapsed = 0;
  private loreEvents = 0;
  private marketVolume = 120000;
  private happiness = 71;

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    this.marketVolume = Math.round(120000 + Math.sin(this.elapsed * 0.18) * 18000 + Math.cos(this.elapsed * 0.071) * 9000);
    this.happiness = Math.round(72 + Math.sin(this.elapsed * 0.08) * 9);
    if (Math.floor(this.elapsed) > 0 && Math.floor(this.elapsed) % 45 === 0) this.loreEvents = Math.min(99, this.loreEvents + 1);
  }

  getStats(): CityEconomyStats {
    return {
      name: 'Auralis Megacity Biome',
      lengthKm: 400,
      districts: 28,
      population: 1260000,
      activeJobs: 182000,
      transitLines: 14,
      powerDemandMw: 980,
      powerGeneratedMw: 1120,
      waterDemandMl: 740,
      sewerLoadPercent: 63,
      marketVolume: this.marketVolume,
      happiness: this.happiness,
      loreEvents: this.loreEvents,
    };
  }
}
