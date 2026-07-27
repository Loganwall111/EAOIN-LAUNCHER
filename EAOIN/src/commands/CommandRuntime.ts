import { GameSettings } from '../settings/GameSettings';
import { GameMode } from '../modes/GameMode';

export interface WorldTimeState {
  timeOfDay: number;
  frozen: boolean;
}

export interface CommandRuntimeState {
  settings: GameSettings;
  time: WorldTimeState;
  lastMessage: string;
  /** Current game mode, so `/gamemode` can switch it live. */
  gameMode?: GameMode;
}

/**
 * Side effects a command asks the engine to perform.
 *
 * Commands stay pure — they return a description of what should happen and
 * `GameCanvas` carries it out. That keeps this module testable while letting
 * `/kill`, `/tp` and `/give` actually do something; previously several
 * commands only returned a chat string, which is why typing `/kill` appeared
 * to do nothing at all.
 */
export interface CommandEffect {
  kind: 'kill' | 'teleport' | 'give' | 'heal' | 'clear' | 'spawn' | 'weather';
  /** Target coordinates for `teleport`. */
  x?: number;
  y?: number;
  z?: number;
  /** Block/item id for `give`. */
  blockId?: number;
  amount?: number;
  /** Entity name for `spawn`. */
  entity?: string;
  /** Weather id for `weather`. */
  weather?: string;
}

export interface CommandResult extends CommandRuntimeState {
  ok: boolean;
  /** Set when the command asks for a live game-mode change. */
  gameModeChange?: GameMode;
  /** Set when the command asks the engine to change the world or player. */
  effect?: CommandEffect;
}

/** Accepts Minecraft-style aliases: `/gamemode 1`, `/gamemode c`, `/gmc`. */
const GAME_MODE_ALIASES: Record<string, GameMode> = {
  '0': 'survival', s: 'survival', survival: 'survival',
  '1': 'creative', c: 'creative', creative: 'creative',
  '2': 'story', story: 'story', adventure: 'story',
  '3': 'experimental', e: 'experimental', experimental: 'experimental', spectator: 'experimental',
  '4': 'incredible', i: 'incredible', incredible: 'incredible',
};

export function runCommand(input: string, state: CommandRuntimeState): CommandResult {
  const command = input.trim();
  if (!command) return { ...state, ok: false, lastMessage: 'No command entered' };
  const [rawName, ...args] = command.replace(/^\//, '').split(/\s+/);
  const name = rawName.toLowerCase();

  if (name === 'help') {
    return {
      ...state,
      ok: true,
      lastMessage: 'Commands: /gamemode <survival|creative|story|experimental> /kill /heal /tp <x> <y> <z> /give <id> [n] /clear /weather <clear|rain|storm> /day /night /time <0-24|infinite|resume> /vulkan on|off /shader on|off /particles on|off /texture classic|soft|vibrant|noir /summon /credits /god /boss /rocket /mars',
    };
  }

  // Minecraft-style live game-mode switching. This is what makes the creative
  // inventory reachable from inside an already-running survival world.
  if (name === 'gamemode' || name === 'gm') {
    const raw = args[0]?.toLowerCase();
    const mode = raw ? GAME_MODE_ALIASES[raw] : undefined;
    if (!mode) {
      return { ...state, ok: false, lastMessage: 'Usage: /gamemode <survival|creative|story|experimental|incredible>' };
    }
    return { ...state, ok: true, gameMode: mode, gameModeChange: mode, lastMessage: `Game mode set to ${mode}` };
  }
  // Shorthand: /gmc, /gms, /gme …
  if (/^gm[0-9scei]$/.test(name)) {
    const mode = GAME_MODE_ALIASES[name.slice(2)];
    if (mode) return { ...state, ok: true, gameMode: mode, gameModeChange: mode, lastMessage: `Game mode set to ${mode}` };
  }

  // --- commands with real world effects ----------------------------------

  if (name === 'kill') {
    // `/kill` with no argument kills the player, exactly like Minecraft.
    const target = args[0]?.toLowerCase();
    if (!target || target === '@s' || target === '@p') {
      return { ...state, ok: true, effect: { kind: 'kill' }, lastMessage: 'You died. Respawning at the world spawn.' };
    }
    if (target === '@e') {
      return { ...state, ok: true, effect: { kind: 'clear' }, lastMessage: 'Removed every loaded creature.' };
    }
    return { ...state, ok: false, lastMessage: 'Usage: /kill [@s|@p|@e]' };
  }

  if (name === 'heal') {
    return { ...state, ok: true, effect: { kind: 'heal' }, lastMessage: 'Health, hunger and stamina restored.' };
  }

  if (name === 'tp' || name === 'teleport') {
    const [x, y, z] = args.map(Number);
    if (![x, y, z].every(Number.isFinite)) {
      return { ...state, ok: false, lastMessage: 'Usage: /tp <x> <y> <z>' };
    }
    return { ...state, ok: true, effect: { kind: 'teleport', x, y, z }, lastMessage: `Teleported to ${x}, ${y}, ${z}` };
  }

  if (name === 'give') {
    const blockId = Number(args[0]);
    const amount = args[1] === undefined ? 1 : Number(args[1]);
    if (!Number.isFinite(blockId) || blockId <= 0 || !Number.isFinite(amount) || amount <= 0) {
      return { ...state, ok: false, lastMessage: 'Usage: /give <blockId> [amount]' };
    }
    return {
      ...state,
      ok: true,
      effect: { kind: 'give', blockId, amount: Math.min(999, Math.floor(amount)) },
      lastMessage: `Gave ${Math.floor(amount)} of block ${blockId}`,
    };
  }

  if (name === 'weather') {
    const weather = args[0]?.toLowerCase();
    if (!weather || !['clear', 'rain', 'storm', 'snow'].includes(weather)) {
      return { ...state, ok: false, lastMessage: 'Usage: /weather <clear|rain|storm|snow>' };
    }
    return { ...state, ok: true, effect: { kind: 'weather', weather }, lastMessage: `Weather set to ${weather}` };
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
  if (name === 'summon') {
    const entity = args[0] ?? 'sheep';
    return { ...state, ok: true, effect: { kind: 'spawn', entity }, lastMessage: `Summoned ${entity}` };
  }

  return { ...state, ok: false, lastMessage: `Unknown command: /${name}. Try /help` };
}
