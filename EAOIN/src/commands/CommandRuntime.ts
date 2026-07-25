import { GameSettings } from '../settings/GameSettings';

export interface WorldTimeState {
  timeOfDay: number;
  frozen: boolean;
}

export interface CommandRuntimeState {
  settings: GameSettings;
  time: WorldTimeState;
  lastMessage: string;
}

export interface CommandResult extends CommandRuntimeState {
  ok: boolean;
}

export function runCommand(input: string, state: CommandRuntimeState): CommandResult {
  const command = input.trim();
  if (!command) return { ...state, ok: false, lastMessage: 'No command entered' };
  const [rawName, ...args] = command.replace(/^\//, '').split(/\s+/);
  const name = rawName.toLowerCase();

  if (name === 'help') {
    return {
      ...state,
      ok: true,
      lastMessage: 'Commands: /day /night /time <0-24|infinite|resume> /vulkan on|off /shader on|off /particles on|off /texture classic|soft|vibrant|noir /summon /credits /god /boss /rocket /mars',
    };
  }

  if (name === 'day') {
    return { ...state, ok: true, time: { timeOfDay: 12, frozen: false }, lastMessage: 'Time set to day' };
  }

  if (name === 'night') {
    return { ...state, ok: true, time: { timeOfDay: 0, frozen: false }, lastMessage: 'Time set to night' };
  }

  if (name === 'time') {
    const value = args[0]?.toLowerCase();
    if (value === 'infinite' || value === 'freeze') {
      return { ...state, ok: true, time: { ...state.time, frozen: true }, lastMessage: 'Time machine engaged: time frozen' };
    }
    if (value === 'resume') {
      return { ...state, ok: true, time: { ...state.time, frozen: false }, lastMessage: 'Time machine disengaged: time resumed' };
    }
    const hour = Number(value);
    if (Number.isFinite(hour)) {
      return { ...state, ok: true, time: { timeOfDay: ((hour % 24) + 24) % 24, frozen: false }, lastMessage: `Time set to ${hour}:00` };
    }
    return { ...state, ok: false, lastMessage: 'Usage: /time <0-24|infinite|resume>' };
  }

  if (name === 'vulkan') {
    const enabled = args[0]?.toLowerCase() !== 'off';
    return {
      ...state,
      ok: true,
      settings: { ...state.settings, experimentalVulkanMode: enabled, rendererPreference: enabled ? 'webgpu' : state.settings.rendererPreference, realisticLighting: enabled ? true : state.settings.realisticLighting },
      lastMessage: `Experimental Vulkan/WebGPU mode ${enabled ? 'enabled' : 'disabled'}`,
    };
  }

  if (name === 'shader' || name === 'shaders') {
    const enabled = args[0]?.toLowerCase() !== 'off';
    return {
      ...state,
      ok: true,
      settings: { ...state.settings, experimentalShaders: enabled, postProcessEnabled: enabled },
      lastMessage: `Experimental shaders ${enabled ? 'enabled' : 'disabled'}`,
    };
  }

  if (name === 'particles') {
    const enabled = args[0]?.toLowerCase() !== 'off';
    return {
      ...state,
      ok: true,
      settings: { ...state.settings, particlesEnabled: enabled },
      lastMessage: `Particles ${enabled ? 'enabled' : 'disabled'}`,
    };
  }

  if (name === 'texture') {
    const pack = args[0]?.toLowerCase();
    if (pack === 'classic' || pack === 'soft' || pack === 'vibrant' || pack === 'noir') {
      return {
        ...state,
        ok: true,
        settings: { ...state.settings, texturePack: pack },
        lastMessage: `Texture pack set to ${pack}`,
      };
    }
    return { ...state, ok: false, lastMessage: 'Texture packs: classic, soft, vibrant, noir' };
  }

  if (name === 'server') {
    return { ...state, ok: true, lastMessage: 'Local server browser is simulated in the multiplayer panel for 3.0' };
  }

  if (name === 'credits') return { ...state, ok: true, lastMessage: 'Credits command accepted: press C to open the ending credits runtime' };
  if (name === 'god') return { ...state, ok: true, lastMessage: 'God command accepted: press H to toggle unlocked god/editor mode' };
  if (name === 'boss') return { ...state, ok: true, lastMessage: 'Boss command accepted: press N to damage the Ender/Abyss finale bosses' };
  if (name === 'rocket' || name === 'moon') return { ...state, ok: true, lastMessage: 'Rocket command accepted: stand near the rocket and press R to launch' };
  if (name === 'mars') return { ...state, ok: true, lastMessage: 'Mars is visible in the solar runtime; planetary landing is staged through rockets' };
  if (name === 'incredible') return { ...state, ok: true, lastMessage: 'Incredible mode is seed-gated; use McDonald\'s half for the rare world' };
  if (name === 'summon') return { ...state, ok: true, lastMessage: `Summon preview accepted for ${args[0] ?? 'entity'} through the 3.0 modding API` };

  return { ...state, ok: false, lastMessage: `Unknown command: /${name}. Try /help` };
}
