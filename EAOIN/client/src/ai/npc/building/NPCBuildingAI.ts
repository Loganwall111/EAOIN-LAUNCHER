/**
 * NPC Building AI — Structure Construction Foundation
 */
export interface BuildingTask {
  taskId: string;
  structureType: string;
  targetPosition: { x: number; y: number; z: number };
  requiredBlocks: Record<string, number>;
  progress: number; // 0-1
  assignedNpc: string;
  completed: boolean;
}

export class NPCBuildingAI {
  private tasks = new Map<string, BuildingTask>();

  createTask(structureType: string, targetPos: { x: number; y: number; z: number }, assignedNpc: string): BuildingTask {
    const task: BuildingTask = {
      taskId: `build_${Date.now()}`,
      structureType,
      targetPosition: targetPos,
      requiredBlocks: { 'wood': 20, 'stone': 10, 'leaves': 5 },
      progress: 0,
      assignedNpc,
      completed: false,
    };
    this.tasks.set(task.taskId, task);
    console.log(`[BuildingAI] Created task ${task.taskId}: ${structureType}`);
    return task;
  }

  progressTask(taskId: string, amount: number = 0.05): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.completed) return false;
    task.progress = Math.min(1, task.progress + amount);
    if (task.progress >= 1) {
      task.completed = true;
      console.log(`[BuildingAI] Completed task: ${taskId}`);
    }
    return true;
  }

  getTask(taskId: string): BuildingTask | null {
    return this.tasks.get(taskId) ?? null;
  }

  getPendingTasks(): BuildingTask[] {
    return Array.from(this.tasks.values()).filter(t => !t.completed);
  }
}
