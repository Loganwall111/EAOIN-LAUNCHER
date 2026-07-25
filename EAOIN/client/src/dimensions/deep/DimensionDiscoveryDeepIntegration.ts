/**
 * DimensionDiscoveryDeepIntegration — Lore Unlocking & Technology Tracking
 */
import { AncientStructureGenerator } from '../structures/AncientStructureGenerator';

export interface TechnologyDiscovery {
  techId: string;
  structureId: string;
  discovered: boolean;
  unlockRequirements: string[];
}

export class DimensionDiscoveryDeepIntegration {
  private technologies = new Map<string, TechnologyDiscovery>();

  registerTechnology(tech: TechnologyDiscovery): void {
    this.technologies.set(tech.techId, tech);
  }

  unlockTechnology(techId: string, structureId: string): boolean {
    const tech = this.technologies.get(techId);
    if (!tech || tech.discovered) return false;
    if (tech.structureId !== structureId) return false;
    tech.discovered = true;
    console.log(`[TechUnlock] Technology ${techId} unlocked from ${structureId}`);
    return true;
  }

  getDiscoveredTechnologies(): TechnologyDiscovery[] {
    return Array.from(this.technologies.values()).filter(t => t.discovered);
  }
}
