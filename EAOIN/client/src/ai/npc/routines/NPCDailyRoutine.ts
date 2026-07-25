/**
 * NPC Daily Routine — Schedule Framework
 * Morning → Work → Gather → Social → Return → Sleep
 */
export interface DailyRoutine {
  scheduleId: string;
  npcId: string;
  phases: RoutinePhase[];
  currentPhase: number;
  tickCounter: number;
}

export interface RoutinePhase {
  phase: 'morning' | 'work' | 'gather' | 'social' | 'return' | 'sleep';
  duration: number; // ticks
  targetLocation?: { x: number; z: number };
  activity: string;
}

export class NPCDailyRoutine {
  private routines = new Map<string, DailyRoutine>();

  createRoutine(npcId: string): DailyRoutine {
    const routine: DailyRoutine = {
      scheduleId: `schedule_${npcId}`,
      npcId,
      phases: [
        { phase: 'morning', duration: 100, activity: 'wake_up' },
        { phase: 'work', duration: 300, targetLocation: { x: 0, z: 0 }, activity: 'work_at_station' },
        { phase: 'gather', duration: 200, activity: 'gather_resources' },
        { phase: 'social', duration: 150, activity: 'social_interaction' },
        { phase: 'return', duration: 100, targetLocation: { x: 0, z: 0 }, activity: 'return_home' },
        { phase: 'sleep', duration: 400, activity: 'sleep' },
      ],
      currentPhase: 0,
      tickCounter: 0,
    };
    this.routines.set(npcId, routine);
    console.log(`[DailyRoutine] Created routine for ${npcId}`);
    return routine;
  }

  tick(npcId: string): string {
    const routine = this.routines.get(npcId);
    if (!routine) return 'no_routine';
    routine.tickCounter++;
    const currentPhase = routine.phases[routine.currentPhase];
    if (routine.tickCounter >= currentPhase.duration) {
      routine.tickCounter = 0;
      routine.currentPhase = (routine.currentPhase + 1) % routine.phases.length;
      console.log(`[DailyRoutine] ${npcId} moved to phase: ${routine.phases[routine.currentPhase].phase}`);
    }
    return currentPhase.phase;
  }

  getCurrentPhase(npcId: string): string {
    const routine = this.routines.get(npcId);
    return routine ? routine.phases[routine.currentPhase].phase : 'none';
  }
}
