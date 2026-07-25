/**
 * JobSystem — NPC Professions: Farmer, Miner, Builder, Merchant, Explorer
 */
export interface JobDef {
  id: string;
  name: string;
  category: 'production' | 'service' | 'exploration';
  requiredSkills: string[];
  workCycle: number; // ticks per cycle
  outputs: string[];
  socialPriority: number;
}

export class JobSystem {
  private jobs = new Map<string, JobDef>();
  private assignments = new Map<string, string>(); // npcId -> jobId

  constructor() {
    this.registerDefaultJobs();
  }

  private registerDefaultJobs(): void {
    this.registerJob({
      id: 'farmer', name: 'Farmer', category: 'production',
      requiredSkills: ['farming'], workCycle: 200,
      outputs: ['wheat', 'carrot', 'potato'], socialPriority: 0.7,
    });
    this.registerJob({
      id: 'miner', name: 'Miner', category: 'production',
      requiredSkills: ['mining'], workCycle: 300,
      outputs: ['stone', 'coal', 'iron_ore'], socialPriority: 0.5,
    });
    this.registerJob({
      id: 'builder', name: 'Builder', category: 'production',
      requiredSkills: ['building'], workCycle: 400,
      outputs: ['structure', 'repair'], socialPriority: 0.6,
    });
    this.registerJob({
      id: 'merchant', name: 'Merchant', category: 'service',
      requiredSkills: ['trading'], workCycle: 150,
      outputs: ['trade', 'economy_boost'], socialPriority: 0.9,
    });
  }

  registerJob(job: JobDef): void {
    this.jobs.set(job.id, job);
  }

  assignJob(npcId: string, jobId: string): boolean {
    if (!this.jobs.has(jobId)) return false;
    this.assignments.set(npcId, jobId);
    console.log(`[JobSystem] Assigned ${jobId} to ${npcId}`);
    return true;
  }

  getJob(npcId: string): JobDef | null {
    const jobId = this.assignments.get(npcId);
    return jobId ? this.jobs.get(jobId) ?? null : null;
  }

  getJobs(): JobDef[] {
    return Array.from(this.jobs.values());
  }
}
