/**
 * NPC Personality — Traits, Goals, Behavior Bias
 */
export interface PersonalityTraits {
  extroversion: number; // 0-1
  agreeableness: number; // 0-1
  conscientiousness: number; // 0-1
  openness: number; // 0-1
  stability: number; // 0-1
}

export interface NPCGoals {
  primary: string;
  secondary: string[];
  progress: number; // 0-1
}

export class NPCPersonality {
  private traits: PersonalityTraits;
  private goals: NPCGoals;

  constructor() {
    this.traits = {
      extroversion: 0.5 + Math.random() * 0.5,
      agreeableness: 0.5 + Math.random() * 0.5,
      conscientiousness: 0.3 + Math.random() * 0.7,
      openness: 0.4 + Math.random() * 0.6,
      stability: 0.5 + Math.random() * 0.5,
    };
    this.goals = {
      primary: 'survive',
      secondary: ['socialize', 'work'],
      progress: 0,
    };
  }

  adjustTrait(name: keyof PersonalityTraits, delta: number): void {
    this.traits[name] = Math.max(0, Math.min(1, this.traits[name] + delta));
  }

  getTraits(): PersonalityTraits {
    return { ...this.traits };
  }

  setPrimaryGoal(goal: string): void {
    this.goals.primary = goal;
  }

  advanceProgress(delta: number): number {
    this.goals.progress = Math.min(1, Math.max(0, this.goals.progress + delta));
    return this.goals.progress;
  }
}
