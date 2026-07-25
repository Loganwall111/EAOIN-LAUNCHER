/**
 * MultiplayerRollbackExecution — Apply Server Rollback When Desync Detected
 */
import { ClientPrediction } from '../authority/ClientPrediction';

export class MultiplayerRollbackExecution {
  private rollbackHistory: Array<{ playerId: string; serverState: any; timestamp: number }> = [];

  recordRollback(playerId: string, serverState: any): void {
    this.rollbackHistory.push({ playerId, serverState, timestamp: Date.now() });
    console.log(`[Rollback] Executed rollback for ${playerId}`);
  }

  applyRollbackToClient(playerId: string, prediction: ClientPrediction, serverState: any): boolean {
    const history = this.rollbackHistory.filter(r => r.playerId === playerId);
    if (history.length === 0) return false;
    const latestRollback = history[history.length - 1];
    // Force reconciliation to server position
    prediction.reconcile(latestRollback.serverState, 0);
    console.log(`[Rollback] Applied to client ${playerId}`);
    return true;
  }

  getRollbackHistory(): Array<{ playerId: string; timestamp: number }> {
    return this.rollbackHistory.map(h => ({ playerId: h.playerId, timestamp: h.timestamp }));
  }
}
