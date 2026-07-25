import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';

export type ToolKind = 'hand' | 'pickaxe' | 'axe' | 'shovel';
export type ToolID = 'hand' | 'wooden_pickaxe' | 'stone_pickaxe' | 'wooden_axe' | 'wooden_shovel';
export type ToolInventory = Record<ToolID, boolean>;

export interface ToolDefinition {
  id: ToolID;
  name: string;
  kind: ToolKind;
  tier: number;
  speed: number;
}

export interface MiningProfile {
  preferredTool: ToolKind;
  requiredTier: number;
}

export interface MiningEstimate {
  durationMs: number;
  effectiveness: number;
  canHarvest: boolean;
  preferredTool: ToolKind;
}

export const TOOLBELT: ToolID[] = ['hand', 'wooden_pickaxe', 'stone_pickaxe', 'wooden_axe', 'wooden_shovel'];

export const TOOLS: Record<ToolID, ToolDefinition> = {
  hand: { id: 'hand', name: 'Hand', kind: 'hand', tier: 0, speed: 1 },
  wooden_pickaxe: { id: 'wooden_pickaxe', name: 'Wood Pick', kind: 'pickaxe', tier: 1, speed: 2.25 },
  stone_pickaxe: { id: 'stone_pickaxe', name: 'Stone Pick', kind: 'pickaxe', tier: 2, speed: 3.6 },
  wooden_axe: { id: 'wooden_axe', name: 'Wood Axe', kind: 'axe', tier: 1, speed: 2.5 },
  wooden_shovel: { id: 'wooden_shovel', name: 'Wood Shovel', kind: 'shovel', tier: 1, speed: 2.7 },
};

const MINING_PROFILES: Record<BlockID, MiningProfile> = {
  1: { preferredTool: 'shovel', requiredTier: 0 }, // grass
  2: { preferredTool: 'shovel', requiredTier: 0 }, // dirt
  3: { preferredTool: 'pickaxe', requiredTier: 1 }, // stone
  4: { preferredTool: 'shovel', requiredTier: 0 }, // sand
  5: { preferredTool: 'shovel', requiredTier: 0 }, // water placeholder block
  6: { preferredTool: 'axe', requiredTier: 0 }, // wood
  7: { preferredTool: 'axe', requiredTier: 0 }, // leaves
  8: { preferredTool: 'pickaxe', requiredTier: 1 }, // coal
  9: { preferredTool: 'pickaxe', requiredTier: 2 }, // iron
  10: { preferredTool: 'pickaxe', requiredTier: 2 }, // gold
  11: { preferredTool: 'pickaxe', requiredTier: 2 }, // diamond demo
  12: { preferredTool: 'pickaxe', requiredTier: 3 }, // obsidian
  13: { preferredTool: 'pickaxe', requiredTier: 0 }, // logic wire
  14: { preferredTool: 'pickaxe', requiredTier: 1 }, // signal lamp
  15: { preferredTool: 'pickaxe', requiredTier: 2 }, // portal core
  16: { preferredTool: 'pickaxe', requiredTier: 1 }, // crystal shard
  17: { preferredTool: 'axe', requiredTier: 0 }, // village crate
  18: { preferredTool: 'pickaxe', requiredTier: 2 }, // command block
  19: { preferredTool: 'pickaxe', requiredTier: 2 }, // time machine
  20: { preferredTool: 'axe', requiredTier: 0 }, // wooden door
  21: { preferredTool: 'pickaxe', requiredTier: 1 }, // dimensional door
  22: { preferredTool: 'pickaxe', requiredTier: 2 }, // rocket core
  23: { preferredTool: 'pickaxe', requiredTier: 1 }, // moon rock
};

export function createStarterToolInventory(): ToolInventory {
  return {
    hand: true,
    wooden_pickaxe: false,
    stone_pickaxe: false,
    wooden_axe: false,
    wooden_shovel: false,
  };
}

export function unlockTool(inventory: ToolInventory, toolId: ToolID): ToolInventory {
  return { ...inventory, hand: true, [toolId]: true };
}

export function isToolUnlocked(inventory: ToolInventory, toolId: ToolID): boolean {
  return toolId === 'hand' || inventory[toolId] === true;
}

export function sanitizeToolInventory(inventory: Partial<ToolInventory> | undefined): ToolInventory {
  return {
    ...createStarterToolInventory(),
    ...(inventory ?? {}),
    hand: true,
  };
}

export function getTool(id: ToolID): ToolDefinition {
  return TOOLS[id] ?? TOOLS.hand;
}

export function getMiningProfile(blockId: BlockID): MiningProfile {
  return MINING_PROFILES[blockId] ?? { preferredTool: 'hand', requiredTier: 0 };
}

export function estimateMining(blockId: BlockID, toolId: ToolID): MiningEstimate {
  const block = getBlock(blockId);
  const profile = getMiningProfile(blockId);
  const tool = getTool(toolId);
  const hardness = Math.max(0.15, block.hardness || 0.2);
  const canHarvest = profile.requiredTier === 0 || (tool.kind === profile.preferredTool && tool.tier >= profile.requiredTier);

  let effectiveness = 1;
  if (tool.kind === profile.preferredTool) effectiveness = tool.speed;
  else if (tool.kind === 'hand' && profile.requiredTier === 0) effectiveness = 0.85;
  else effectiveness = 0.32;

  if (!canHarvest && profile.requiredTier > 0) effectiveness *= 0.45;

  return {
    durationMs: Math.max(180, Math.round((hardness * 780) / effectiveness)),
    effectiveness,
    canHarvest,
    preferredTool: profile.preferredTool,
  };
}

export function nextTool(current: ToolID, inventory: ToolInventory = allToolsUnlocked()): ToolID {
  const start = TOOLBELT.indexOf(current);
  for (let step = 1; step <= TOOLBELT.length; step += 1) {
    const candidate = TOOLBELT[((start < 0 ? 0 : start) + step) % TOOLBELT.length];
    if (isToolUnlocked(inventory, candidate)) return candidate;
  }
  return 'hand';
}

export function allToolsUnlocked(): ToolInventory {
  return TOOLBELT.reduce<ToolInventory>((tools, toolId) => {
    tools[toolId] = true;
    return tools;
  }, createStarterToolInventory());
}
