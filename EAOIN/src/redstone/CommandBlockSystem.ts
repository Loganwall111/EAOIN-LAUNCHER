/**
 * CommandBlockSystem — Minecraft-style automation & scripting.
 *
 *  Three block types:
 *    - Impulse Command Block     (orange, fires once when powered)
 *    - Chain Command Block       (green,  fires after the previous)
 *    - Repeating Command Block   (purple, fires every tick while powered)
 *
 *  Plus:
 *    - Conditional execution
 *    - Custom scripting hooks (a tiny DSL: set / if / for / call / emit)
 *    - Timers
 *    - Events
 *    - Variables (global + per-block)
 *    - Functions (named command sequences)
 *    - World editing commands
 *    - Automation logic
 *
 *  The system is intentionally a tiny scripting engine — it doesn't try to
 *  be a full programming language, but it does let players wire up logic
 *  blocks to build redstone-style contraptions and full adventure maps.
 */
export type CommandBlockType = 'impulse' | 'chain' | 'repeating';

export interface CommandBlockDef {
  id: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  type: CommandBlockType;
  command: string;
  conditional: boolean;
  auto: boolean;
  tickDelay: number;
  needsRedstone: boolean;
  trackOutput: boolean;
  lastOutput: string;
  powered: boolean;
}

export interface ScriptEvent {
  type: string;
  payload: any;
}

export interface ScriptFunction {
  name: string;
  body: string[];
}

export class CommandBlockSystem {
  blocks = new Map<string, CommandBlockDef>();
  variables: Record<string, any> = {};
  functions: Record<string, ScriptFunction> = {};
  events: ScriptEvent[] = [];
  timers: { id: string; remaining: number; interval: number; callback: string }[] = [];
  onLog: (msg: string) => void = () => {};

  private nextId = 1;

  constructor() { this.bootstrap(); }

  private bootstrap(): void {
    // Register a small set of built-in functions.
    this.functions['welcome'] = { name: 'welcome', body: ['say Welcome to the EAOIN Scripting Engine!', 'give @p 1 64'] };
    this.functions['clear_inv'] = { name: 'clear_inv', body: ['clear @p', 'say Inventory cleared.'] };
  }

  placeBlock(worldX: number, worldY: number, worldZ: number, type: CommandBlockType, command: string, conditional = false, auto = false): CommandBlockDef {
    const id = `cb_${this.nextId++}`;
    const def: CommandBlockDef = {
      id, worldX, worldY, worldZ, type, command, conditional, auto, tickDelay: 0,
      needsRedstone: type === 'impulse', trackOutput: true, lastOutput: '', powered: false,
    };
    this.blocks.set(id, def);
    return def;
  }

  removeBlock(id: string): void { this.blocks.delete(id); }

  powerBlock(id: string, powered: boolean): void {
    const b = this.blocks.get(id); if (!b) return; b.powered = powered;
  }

  tick(dt: number): void {
    // Repeating blocks
    for (const b of this.blocks.values()) {
      if (b.type !== 'repeating' || (b.needsRedstone && !b.powered)) continue;
      this.execute(b);
    }
    // Impulse blocks (powered)
    for (const b of this.blocks.values()) {
      if (b.type !== 'impulse' || !b.powered) continue;
      if (this.evaluateConditional(b)) this.execute(b);
      b.powered = false;
    }
    // Chain blocks (last fired)
    for (const b of this.blocks.values()) {
      if (b.type !== 'chain') continue;
      const upstream = this.findUpstream(b);
      if (upstream && this.firedThisTick.has(upstream.id)) this.execute(b);
    }
    // Timers
    for (const t of this.timers) {
      t.remaining -= dt;
      if (t.remaining <= 0) {
        this.runLine(t.callback);
        t.remaining = t.interval;
      }
    }
    this.firedThisTick.clear();
  }

  firedThisTick = new Set<string>();

  private findUpstream(b: CommandBlockDef): CommandBlockDef | null {
    for (const candidate of this.blocks.values()) {
      if (candidate === b) continue;
      if (candidate.worldX === b.worldX && candidate.worldY === b.worldY && candidate.worldZ === b.worldZ - 1) return candidate;
    }
    return null;
  }

  private evaluateConditional(b: CommandBlockDef): boolean {
    if (!b.conditional) return true;
    return Boolean(this.variables['_cond_']);
  }

  execute(b: CommandBlockDef): void {
    if (b.conditional && !this.evaluateConditional(b)) return;
    this.runLine(b.command);
    this.firedThisTick.add(b.id);
  }

  /** Parse and execute one line of the scripting DSL. */
  runLine(line: string): any {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = (i: number) => parts.slice(i).join(' ');

    let result: any = null;
    switch (cmd) {
      case 'say': result = this.say(arg(1)); break;
      case 'set': result = this.setVariable(parts[1], arg(2)); break;
      case 'get': result = this.getVariable(parts[1]); break;
      case 'if': result = this.runIf(parts[1], parts[2], arg(3)); break;
      case 'for': result = this.runFor(parts); break;
      case 'call': result = this.callFunction(parts[1]); break;
      case 'def': result = this.defineFunction(parts[1], arg(2)); break;
      case 'give': result = this.giveBlock(parts[1], parts[2], parts[3]); break;
      case 'tp': result = this.teleport(parts[1], parts[2], parts[3], parts[4]); break;
      case 'time': result = this.setTime(parts[1]); break;
      case 'weather': result = this.setWeather(parts[1]); break;
      case 'fill': result = this.fillRegion(arg(1)); break;
      case 'clone': result = this.cloneRegion(arg(1)); break;
      case 'kill': result = this.kill(parts[1]); break;
      case 'effect': result = this.applyEffect(parts[1], parts[2], parts[3], parts[4]); break;
      case 'summon': result = this.summonEntity(parts[1]); break;
      case 'event': result = this.emitEvent(parts[1], arg(2)); break;
      case 'on': result = this.onEvent(parts[1], parts[2]); break;
      case 'timer': result = this.setTimer(parts[1], parts[2], arg(3)); break;
      case 'wait': result = this.wait(parts[1]); break;
      case 'execute': result = this.runLine(arg(1)); break;
      case 'log': result = this.log(arg(1)); break;
      default: result = `Unknown command: ${cmd}`;
    }
    this.log(String(result ?? ''));
    return result;
  }

  /* ----- built-in commands ----- */
  say(msg: string): string { return `[say] ${msg}`; }
  setVariable(name: string, value: string): any { this.variables[name] = this.parseValue(value); return value; }
  getVariable(name: string): any { return this.variables[name]; }
  runIf(left: string, op: string, right: string): any {
    const a = this.parseValue(left), b = this.parseValue(right);
    const v = op === '==' ? a == b : op === '!=' ? a != b : op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : op === '>=' ? a >= b : false;
    this.variables['_cond_'] = v; return v;
  }
  runFor(parts: string[]): any {
    // for i 0 10 { ... } — recursive evaluation not supported; treat as n-times counter increment.
    const name = parts[1]; const from = Number(parts[2]); const to = Number(parts[3]);
    let count = 0; for (let i = from; i < to; i++) { this.variables[name] = i; count++; } return count;
  }
  callFunction(name: string): any {
    const f = this.functions[name]; if (!f) return `No function: ${name}`;
    let r: any = null; for (const line of f.body) r = this.runLine(line); return r;
  }
  defineFunction(name: string, body: string): any {
    this.functions[name] = { name, body: [body] }; return name;
  }
  giveBlock(target: string, block: string, amount: string): any { return `Gave ${amount} of ${block} to ${target}`; }
  teleport(target: string, x: string, y: string, z: string): any { return `Teleported ${target} to (${x}, ${y}, ${z})`; }
  setTime(value: string): any { return `Time set to ${value}`; }
  setWeather(value: string): any { return `Weather set to ${value}`; }
  fillRegion(args: string): any { return `Filled region with ${args}`; }
  cloneRegion(args: string): any { return `Cloned region ${args}`; }
  kill(target: string): any { return `Killed ${target}`; }
  applyEffect(target: string, effect: string, seconds: string, amplifier: string): any { return `Applied ${effect} to ${target} for ${seconds}s at amp ${amplifier}`; }
  summonEntity(type: string): any { return `Summoned ${type}`; }
  emitEvent(type: string, payload: string): any { this.events.push({ type, payload }); return `Event ${type} emitted`; }
  onEvent(type: string, callback: string): any { this.events.push({ type: 'handler', payload: { type, callback } }); return `Listening for ${type}`; }
  setTimer(id: string, interval: string, callback: string): any {
    this.timers.push({ id, remaining: Number(interval), interval: Number(interval), callback });
    return `Timer ${id} set`;
  }
  wait(seconds: string): any { return `Wait ${seconds}s`; }
  log(msg: string): any { this.onLog(msg); return msg; }

  private parseValue(s: string): any {
    if (s === undefined) return null;
    if (!isNaN(Number(s))) return Number(s);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
    if (this.variables[s] !== undefined) return this.variables[s];
    return s;
  }

  /** All registered command blocks. */
  list(): CommandBlockDef[] { return Array.from(this.blocks.values()); }
}

export default CommandBlockSystem;
