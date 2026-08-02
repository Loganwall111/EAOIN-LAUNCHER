/**
 * AIAssistant — the in-game AI assistant (slash `/ai`).
 *
 * A lightweight rule-based assistant that understands a few commands and
 * returns helpful results, plus an "NPC player" persona system. It supports:
 *   /ai build <what>      → generates a building plan / action message
 *   /ai mod <what>        → describes a new mod it would add
 *   /ai teleport <x> <z>  → returns a teleport effect
 *   /ai summon <npc>      → summons an NPC player variant
 *   /ai help              → lists what it can do
 *
 * It's a demo/coding assistant: it produces deterministic responses and
 * sometimes emits a `CommandEffect` the engine can apply (e.g. teleport).
 */
import { CommandEffect } from '../commands/CommandRuntime';

export interface AIResult {
  message: string;
  effect?: CommandEffect;
  /** When set, an NPC player should be spawned with this persona. */
  npcSpawn?: string;
}

const NPC_PERSONAS: Array<{ id: string; name: string; style: string; cape: string }> = [
  { id: 'alex', name: 'Alex', style: 'explorer', cape: 'classic' },
  { id: 'aria', name: 'Aria', style: 'builder', cape: 'cosmic' },
  { id: 'zed', name: 'Zed', style: 'knight', cape: 'ember' },
  { id: 'nova', name: 'Nova', style: 'ranger', cape: 'galaxy' },
];

export function aiReply(raw: string): AIResult {
  const text = raw.replace(/^\/ai/i, '').trim().toLowerCase();
  if (!text || text === 'help') {
    return { message: '🤖 AI Assistant — try: /ai build a castle • /ai mod add a ruby block • /ai teleport 100 50 • /ai summon alex' };
  }
  if (text.startsWith('build')) {
    const what = text.replace(/^build\s*/i, '') || 'a house';
    return {
      message: `🧱 Build plan ready: ${what}. Place it near you, or type /ai build help for variations. (Structures spawn at your feet on rebuild.)`,
    };
  }
  if (text.startsWith('mod')) {
    const what = text.replace(/^mod\s*/i, '') || 'a new block';
    return {
      message: `🧩 Mod draft: "${what}". I can add it as a new block/recipe in Developer mode. Try /ai mod add a ruby block to see the pattern.`,
    };
  }
  if (text.startsWith('teleport')) {
    const parts = text.replace(/^teleport\s*/i, '').split(/\s+/);
    const x = parseInt(parts[0], 10);
    const z = parseInt(parts[1], 10);
    if (Number.isFinite(x) && Number.isFinite(z)) {
      return { message: `🌀 Teleporting to ${x}, ~, ${z}`, effect: { kind: 'teleport', x, z } };
    }
    return { message: '🤖 Teleport usage: /ai teleport <x> <z>' };
  }
  if (text.startsWith('summon')) {
    const who = text.replace(/^summon\s*/i, '').trim().toLowerCase();
    const persona = NPC_PERSONAS.find((p) => p.name.toLowerCase() === who) ?? NPC_PERSONAS[0];
    return { message: `🧑 Spawning NPC "${persona.name}" (${persona.style}, ${persona.cape} cape)`, npcSpawn: persona.id };
  }
  // Default: build/mod helper based on keywords.
  if (text.includes('player') || text.includes('npc')) {
    return { message: `🧑 NPC system ready — different player variants (styles, hairstyles, capes) are in. Use /ai summon ${NPC_PERSONAS.map((p) => p.name.toLowerCase()).join(' or ')}.` };
  }
  return { message: `🤖 Assistant: I heard "${raw}". Try /ai help, /ai build, /ai mod, /ai teleport, or /ai summon.` };
}

export function npcPersona(id: string) {
  return NPC_PERSONAS.find((p) => p.id === id) ?? NPC_PERSONAS[0];
}
