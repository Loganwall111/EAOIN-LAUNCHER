/**
 * LightingSystem — Dynamic Lighting & Deferred Pipeline Foundation
 */
export interface LightSource {
  id: string;
  type: 'point' | 'directional' | 'spot';
  position?: { x: number; y: number; z: number };
  direction?: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number };
  intensity: number;
  range?: number;
  enabled: boolean;
}

export class LightingSystem {
  private lights = new Map<string, LightSource>();
  private ambientLight = { r: 0.05, g: 0.07, b: 0.1 };

  constructor() {
    // Sun light
    this.registerLight({
      id: 'sun',
      type: 'directional',
      direction: { x: 0.2, y: -0.8, z: 0.1 },
      color: { r: 1.0, g: 0.95, b: 0.85 },
      intensity: 1.2,
      enabled: true,
    });
  }

  registerLight(light: LightSource): void {
    this.lights.set(light.id, light);
  }

  updateAmbient(r: number, g: number, b: number): void {
    this.ambientLight = { r, g, b };
  }

  getAmbient(): { r: number; g: number; b: number } {
    return { ...this.ambientLight };
  }

  getLights(): LightSource[] {
    return Array.from(this.lights.values()).filter(l => l.enabled);
  }

  disableLight(id: string): void {
    const light = this.lights.get(id);
    if (light) light.enabled = false;
  }
}
