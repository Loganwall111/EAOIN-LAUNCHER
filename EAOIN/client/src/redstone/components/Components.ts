export { RedstoneSystem, RedstoneComponent } from '../RedstoneSystem';

export interface ComponentProps {
  powered: boolean;
  signalStrength: number;
}

export const RedstoneComponentRegister = {
  registerAll(system: any): void {
    // Auto-register default components
    system.registerComponent({ type: 0, id: 'default_wire', position: { x: 0, y: 0, z: 0 }, powered: false, signalStrength: 0 });
  }
};
