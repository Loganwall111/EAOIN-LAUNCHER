/**
 * LongTermExpansionPlanning — Future Expansion and Preservation Strategy
 */
export interface ExpansionPlan {
  phase: string;
  targetBatch: number;
  focus: string;
  backwardCompatible: boolean;
  forwardCompatible: boolean;
}

export class LongTermExpansionPlanning {
  private plans: ExpansionPlan[] = [];

  constructor() {
    this.loadPlans();
  }

  private loadPlans(): void {
    this.plans.push({ phase: 'Batch 15', targetBatch: 15, focus: 'Modding API Foundation', backwardCompatible: true, forwardCompatible: true });
    this.plans.push({ phase: 'Batch 16', targetBatch: 16, focus: 'Resource Pack & Shader Pack Support', backwardCompatible: true, forwardCompatible: true });
    this.plans.push({ phase: 'Batch 17', targetBatch: 17, focus: 'Editor Tools (World, Biome, Quest)', backwardCompatible: true, forwardCompatible: true });
    this.plans.push({ phase: 'Batch 18', targetBatch: 18, focus: 'Cross-Platform Support & Accessibility', backwardCompatible: true, forwardCompatible: true });
    this.plans.push({ phase: 'Batch 19+', targetBatch: 19, focus: 'Continuous Updates & Community Features', backwardCompatible: true, forwardCompatible: true });
    console.log('[ExpansionPlan] Long-term plans loaded:', this.plans.length, 'phases');
  }

  getPlan(batchNumber: number): ExpansionPlan | null {
    return this.plans.find(p => p.targetBatch === batchNumber) ?? null;
  }

  getAllPlans(): ExpansionPlan[] {
    return [...this.plans];
  }
}
