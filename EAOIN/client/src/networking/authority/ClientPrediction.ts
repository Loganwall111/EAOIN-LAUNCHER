/**
 * ClientPrediction — Prediction & Reconciliation Framework
 */
export interface PredictionState {
  predictedPosition: { x: number; y: number; z: number };
  serverPosition: { x: number; y: number; z: number };
  pendingInputs: number[];
  sequenceNumber: number;
}

export class ClientPrediction {
  private state: PredictionState;

  constructor(playerId: string) {
    this.state = {
      predictedPosition: { x: 0, y: 8, z: 0 },
      serverPosition: { x: 0, y: 8, z: 0 },
      pendingInputs: [],
      sequenceNumber: 0,
    };
  }

  predict(input: { x: number; y: number; z: number }, sequence: number): { x: number; y: number; z: number } {
    this.state.sequenceNumber = sequence;
    this.state.pendingInputs.push(sequence);
    // Apply input locally
    const newPos = {
      x: this.state.predictedPosition.x + input.x,
      y: this.state.predictedPosition.y + input.y,
      z: this.state.predictedPosition.z + input.z,
    };
    this.state.predictedPosition = newPos;
    return newPos;
  }

  reconcile(serverPosition: { x: number; y: number; z: number }, serverSequence: number): boolean {
    this.state.serverPosition = serverPosition;
    // Remove acknowledged inputs
    this.state.pendingInputs = this.state.pendingInputs.filter(s => s > serverSequence);

    const distance = Math.sqrt(
      Math.pow(this.state.predictedPosition.x - serverPosition.x, 2) +
      Math.pow(this.state.predictedPosition.y - serverPosition.y, 2) +
      Math.pow(this.state.predictedPosition.z - serverPosition.z, 2)
    );

    if (distance > 0.1) {
      // Apply server correction smoothly
      this.state.predictedPosition = {
        x: serverPosition.x,
        y: serverPosition.y,
        z: serverPosition.z,
      };
      console.log(`[Prediction] Reconciled at seq ${serverSequence}, desync ${distance.toFixed(3)}`);
      return true; // Reconciliation occurred
    }
    return false;
  }

  getState(): PredictionState {
    return { ...this.state };
  }
}
