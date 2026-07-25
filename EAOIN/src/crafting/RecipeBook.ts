import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import { addToInventory, canConsumeBlock, InventoryStacks, removeFromInventory } from '../player/InventoryState';
import { getTool, isToolUnlocked, ToolID, ToolInventory, unlockTool } from '../player/ToolState';

export type RecipeID =
  | 'wooden_pickaxe'
  | 'stone_pickaxe'
  | 'wooden_axe'
  | 'wooden_shovel'
  | 'pack_dirt'
  | 'pack_stone'
  | 'pack_sand'
  | 'coal_from_logs'
  | 'logic_wire'
  | 'signal_lamp'
  | 'crystal_shards'
  | 'portal_core'
  | 'village_crate'
  | 'crate_to_wood'
  | 'command_block'
  | 'time_machine'
  | 'wooden_door'
  | 'dimensional_door'
  | 'rocket_core'
  | 'moon_rock';

export interface RecipeCost {
  blockId: BlockID;
  amount: number;
}

export type RecipeOutput =
  | { type: 'tool'; toolId: ToolID }
  | { type: 'block'; blockId: BlockID; amount: number };

export interface Recipe {
  id: RecipeID;
  name: string;
  description: string;
  costs: RecipeCost[];
  output: RecipeOutput;
}

export interface CraftingState {
  inventory: InventoryStacks;
  tools: ToolInventory;
}

export interface CraftResult extends CraftingState {
  ok: boolean;
  message: string;
}

export const RECIPES: Recipe[] = [
  {
    id: 'wooden_pickaxe',
    name: 'Wooden Pickaxe',
    description: 'Unlocks tier-1 stone and coal mining.',
    costs: [{ blockId: 6, amount: 3 }],
    output: { type: 'tool', toolId: 'wooden_pickaxe' },
  },
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    description: 'Unlocks faster mining and tier-2 ore drops.',
    costs: [{ blockId: 6, amount: 2 }, { blockId: 3, amount: 3 }],
    output: { type: 'tool', toolId: 'stone_pickaxe' },
  },
  {
    id: 'wooden_axe',
    name: 'Wooden Axe',
    description: 'Cuts logs and leaves faster.',
    costs: [{ blockId: 6, amount: 3 }],
    output: { type: 'tool', toolId: 'wooden_axe' },
  },
  {
    id: 'wooden_shovel',
    name: 'Wooden Shovel',
    description: 'Digs dirt, grass, and sand faster.',
    costs: [{ blockId: 6, amount: 2 }],
    output: { type: 'tool', toolId: 'wooden_shovel' },
  },
  {
    id: 'pack_dirt',
    name: 'Pack Dirt',
    description: 'Compress grass into usable dirt blocks.',
    costs: [{ blockId: 1, amount: 2 }],
    output: { type: 'block', blockId: 2, amount: 2 },
  },
  {
    id: 'pack_stone',
    name: 'Stone Bundle',
    description: 'Bundle mined stone into extra building blocks.',
    costs: [{ blockId: 3, amount: 2 }, { blockId: 2, amount: 1 }],
    output: { type: 'block', blockId: 3, amount: 3 },
  },
  {
    id: 'pack_sand',
    name: 'Sand Fill',
    description: 'Loosen dirt into sand for desert building.',
    costs: [{ blockId: 2, amount: 2 }],
    output: { type: 'block', blockId: 4, amount: 2 },
  },
  {
    id: 'coal_from_logs',
    name: 'Charcoal Test Batch',
    description: 'Prototype conversion recipe for early fuel.',
    costs: [{ blockId: 6, amount: 2 }],
    output: { type: 'block', blockId: 8, amount: 1 },
  },
  {
    id: 'logic_wire',
    name: 'Logic Wire Kit',
    description: 'Buildable redstone-style signal blocks for logic testing.',
    costs: [{ blockId: 8, amount: 1 }, { blockId: 3, amount: 1 }],
    output: { type: 'block', blockId: 13, amount: 6 },
  },
  {
    id: 'signal_lamp',
    name: 'Signal Lamp',
    description: 'Emissive lamp block that fits the logic/redstone runtime.',
    costs: [{ blockId: 13, amount: 2 }, { blockId: 10, amount: 1 }],
    output: { type: 'block', blockId: 14, amount: 2 },
  },
  {
    id: 'crystal_shards',
    name: 'Crystal Shards',
    description: 'Refine diamond ore into dimension-tuned crystal blocks.',
    costs: [{ blockId: 11, amount: 1 }, { blockId: 5, amount: 1 }],
    output: { type: 'block', blockId: 16, amount: 3 },
  },
  {
    id: 'portal_core',
    name: 'Portal Core',
    description: 'Placeable dimension anchor block for portal experiments.',
    costs: [{ blockId: 12, amount: 1 }, { blockId: 16, amount: 2 }, { blockId: 10, amount: 1 }],
    output: { type: 'block', blockId: 15, amount: 1 },
  },
  {
    id: 'village_crate',
    name: 'Village Supply Crate',
    description: 'Settlement supply block used by civilization tasks.',
    costs: [{ blockId: 6, amount: 3 }, { blockId: 2, amount: 2 }, { blockId: 3, amount: 1 }],
    output: { type: 'block', blockId: 17, amount: 2 },
  },

  {
    id: 'command_block',
    name: 'Command Block',
    description: 'Experimental command runtime block for slash commands and automation.',
    costs: [{ blockId: 13, amount: 2 }, { blockId: 16, amount: 1 }, { blockId: 9, amount: 1 }],
    output: { type: 'block', blockId: 18, amount: 1 },
  },
  {
    id: 'time_machine',
    name: 'Time Machine',
    description: 'Experimental block for freezing and changing world time.',
    costs: [{ blockId: 18, amount: 1 }, { blockId: 10, amount: 1 }, { blockId: 16, amount: 1 }],
    output: { type: 'block', blockId: 19, amount: 1 },
  },
  {
    id: 'wooden_door',
    name: 'Wooden Door',
    description: 'A regular door for settlement builds and home entrances.',
    costs: [{ blockId: 6, amount: 2 }],
    output: { type: 'block', blockId: 20, amount: 2 },
  },
  {
    id: 'dimensional_door',
    name: 'Dimensional Door',
    description: 'Experimental doorway that can shift dimension rules without a full portal.',
    costs: [{ blockId: 20, amount: 1 }, { blockId: 15, amount: 1 }, { blockId: 16, amount: 1 }],
    output: { type: 'block', blockId: 21, amount: 1 },
  },
  {
    id: 'rocket_core',
    name: 'Rocket Core',
    description: 'Moon travel experiment block for the rocket runtime.',
    costs: [{ blockId: 9, amount: 2 }, { blockId: 8, amount: 2 }, { blockId: 16, amount: 1 }],
    output: { type: 'block', blockId: 22, amount: 1 },
  },
  {
    id: 'moon_rock',
    name: 'Moon Rock Synth',
    description: 'Prototype moon material for lunar builds until moon terrain is fully native.',
    costs: [{ blockId: 3, amount: 2 }, { blockId: 16, amount: 1 }],
    output: { type: 'block', blockId: 23, amount: 3 },
  },
  {
    id: 'crate_to_wood',
    name: 'Unpack Crate',
    description: 'Recover emergency wood from settlement crates.',
    costs: [{ blockId: 17, amount: 1 }],
    output: { type: 'block', blockId: 6, amount: 2 },
  },
];

export function canCraft(recipe: Recipe, inventory: InventoryStacks, tools: ToolInventory): boolean {
  if (recipe.output.type === 'tool' && isToolUnlocked(tools, recipe.output.toolId)) return false;
  return recipe.costs.every((cost) => canConsumeBlock(inventory, cost.blockId, cost.amount));
}

export function craftRecipe(recipe: Recipe, state: CraftingState): CraftResult {
  if (!canCraft(recipe, state.inventory, state.tools)) {
    return { ...state, ok: false, message: missingRequirementsMessage(recipe, state.inventory, state.tools) };
  }

  let inventory = state.inventory;
  for (const cost of recipe.costs) {
    inventory = removeFromInventory(inventory, cost.blockId, cost.amount);
  }

  let tools = state.tools;
  if (recipe.output.type === 'tool') {
    tools = unlockTool(tools, recipe.output.toolId);
    return {
      inventory,
      tools,
      ok: true,
      message: `Crafted ${getTool(recipe.output.toolId).name}`,
    };
  }

  inventory = addToInventory(inventory, recipe.output.blockId, recipe.output.amount);
  return {
    inventory,
    tools,
    ok: true,
    message: `Crafted ${getBlock(recipe.output.blockId).name} ×${recipe.output.amount}`,
  };
}

export function recipeCostLabel(recipe: Recipe): string {
  return recipe.costs.map((cost) => `${getBlock(cost.blockId).name} ×${cost.amount}`).join(' + ');
}

export function recipeOutputLabel(recipe: Recipe): string {
  if (recipe.output.type === 'tool') return getTool(recipe.output.toolId).name;
  return `${getBlock(recipe.output.blockId).name} ×${recipe.output.amount}`;
}

function missingRequirementsMessage(recipe: Recipe, inventory: InventoryStacks, tools: ToolInventory): string {
  if (recipe.output.type === 'tool' && isToolUnlocked(tools, recipe.output.toolId)) {
    return `${getTool(recipe.output.toolId).name} already unlocked`;
  }

  const missing = recipe.costs
    .filter((cost) => !canConsumeBlock(inventory, cost.blockId, cost.amount))
    .map((cost) => `${getBlock(cost.blockId).name} ×${cost.amount}`);

  return missing.length > 0 ? `Need ${missing.join(', ')}` : 'Recipe unavailable';
}
