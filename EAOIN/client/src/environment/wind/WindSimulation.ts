// EAOIN Next-Gen Wind Simulation
export class WindSimulation {
  private windSpeed: number = 0.8;
  private windDirection: number = 0;
  private gustTimer: number = 0;

  update(delta: number) {
    this.gustTimer += delta;
    if (this.gustTimer > 8) {
      this.windSpeed = 0.8 + Math.random() * 2.5;
      this.windDirection = Math.random() * Math.PI * 2;
      this.gustTimer = 0;
    }
    // Smooth wind direction change
    this.windDirection += (Math.random() - 0.5) * 0.02;
  }

  getWindForce(): { speed: number; direction: number } {
    return { speed: this.windSpeed, direction: this.windDirection };
  }

  applyToGrass(position: any, time: number) {
    const force = this.getWindForce();
    return Math.sin(time * 2 + position.x * 0.1) * force.speed * 0.3;
  }
}
