/**
 * Survival System — Health, Hunger, Survival Modes
 */
export interface SurvivalState {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  saturation: number;
  mode: 'survival' | 'creative' | 'adventure' | 'spectator' | 'hardcore';
  invulnerable: boolean;
}

export class SurvivalSystem {
  private state: SurvivalState;

  constructor(mode: SurvivalState['mode'] = 'survival') {
    this.state = {
      health: 100,
      maxHealth: 100,
      hunger: 100,
      maxHunger: 100,
      saturation: 0,
      mode,
      invulnerable: mode === 'creative' || mode === 'spectator',
    };
  }

  takeDamage(amount: number): number {
    if (this.state.invulnerable || this.state.mode === 'hardcore' && this.state.health <= amount) {
      this.state.health = Math.max(0, this.state.health - amount);
      return this.state.health;
    }
    this.state.health = Math.max(0, this.state.health - amount);
    return this.state.health;
  }

  heal(amount: number): number {
    this.state.health = Math.min(this.state.maxHealth, this.state.health + amount);
    return this.state.health;
  }

  consumeFood(hungerRestore: number, saturationRestore: number): void {
    this.state.hunger = Math.min(this.state.maxHunger, this.state.hunger + hungerRestore);
    this.state.saturation = Math.min(this.state.maxHunger, this.state.saturation + saturationRestore);
  }

  tick(deltaTime: number): void {
    if (this.state.mode === 'hardcore' && this.state.health <= 0) {
      console.log('[Survival] Hardcore death — world locked');
    }
    // Hunger decay
    this.state.hunger = Math.max(0, this.state.hunger - deltaTime * 0.1);
  }

  getState(): SurvivalState {
    return { ...this.state };
  }
}
