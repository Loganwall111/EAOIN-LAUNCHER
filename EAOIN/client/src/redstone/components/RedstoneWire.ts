/**
 * Redstone Component Implementations
 */
import { RedstoneComponent, RedstoneComponentDef } from '../RedstoneSystem';

export class RedstoneWire {
  static create(id: string, x: number, y: number, z: number): RedstoneComponentDef {
    return {
      type: RedstoneComponent.RedstoneWire,
      id,
      position: { x, y, z },
      powered: false,
      signalStrength: 0,
    };
  }
}

export class Repeater {
  static create(id: string, x: number, y: number, z: number, delay = 2): RedstoneComponentDef {
    return {
      type: RedstoneComponent.Repeater,
      id,
      position: { x, y, z },
      powered: false,
      signalStrength: 0,
      properties: { delay, orientation: 'north' },
    };
  }
}

export class Piston {
  static create(id: string, x: number, y: number, z: number, sticky = false): RedstoneComponentDef {
    return {
      type: sticky ? RedstoneComponent.StickyPiston : RedstoneComponent.Piston,
      id,
      position: { x, y, z },
      powered: false,
      signalStrength: 0,
    };
  }
}

export class Hopper {
  static create(id: string, x: number, y: number, z: number): RedstoneComponentDef {
    return {
      type: RedstoneComponent.Hopper,
      id,
      position: { x, y, z },
      powered: false,
      signalStrength: 0,
      properties: { items: [] },
    };
  }
}
