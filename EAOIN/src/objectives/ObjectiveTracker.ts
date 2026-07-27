import { RuntimeStatus } from '../runtime/RuntimeStatus';
import { getStackCount, InventoryStacks } from '../player/InventoryState';
import { isToolUnlocked, ToolInventory } from '../player/ToolState';

export interface GameplayCounters {
  blocksMined: number;
  blocksPlaced: number;
  creaturesDefeated: number;
  dropsCollected: number;
  craftedItems: number;
  inventoryOpened: boolean;
  shardsCollected: number;
}

export type GameplayCounterKey = Exclude<keyof GameplayCounters, 'inventoryOpened'>;

export interface ObjectiveStatus {
  id: string;
  label: string;
  complete: boolean;
  progress: string;
}

export function createGameplayCounters(): GameplayCounters {
  return {
    blocksMined: 0,
    blocksPlaced: 0,
    creaturesDefeated: 0,
    dropsCollected: 0,
    craftedItems: 0,
    inventoryOpened: false,
    shardsCollected: 0,
  };
}

export function buildObjectives(
  inventory: InventoryStacks,
  tools: ToolInventory,
  counters: GameplayCounters,
  runtime?: RuntimeStatus
): ObjectiveStatus[] {
  const totalMaterials = Object.values(inventory).reduce((sum, count) => sum + count, 0);
  return [
    {
      id: 'open_inventory',
      label: 'Open inventory/crafting with I or E',
      complete: counters.inventoryOpened,
      progress: counters.inventoryOpened ? 'opened' : 'not opened',
    },
    {
      id: 'collect_blocks',
      label: 'Collect 20 total materials',
      complete: totalMaterials >= 20,
      progress: `${Math.min(totalMaterials, 20)}/20`,
    },
    {
      id: 'craft_pick',
      label: 'Craft a wooden pickaxe',
      complete: isToolUnlocked(tools, 'wooden_pickaxe'),
      progress: isToolUnlocked(tools, 'wooden_pickaxe') ? 'crafted' : `${getStackCount(inventory, 6)}/3 wood`,
    },
    {
      id: 'mine_stone',
      label: 'Mine or collect 8 stone',
      complete: getStackCount(inventory, 3) >= 8,
      progress: `${Math.min(getStackCount(inventory, 3), 8)}/8`,
    },
    {
      id: 'craft_stone_pick',
      label: 'Craft a stone pickaxe',
      complete: isToolUnlocked(tools, 'stone_pickaxe'),
      progress: isToolUnlocked(tools, 'stone_pickaxe') ? 'crafted' : 'needs stone + wood',
    },
    {
      id: 'place_blocks',
      label: 'Place 10 blocks',
      complete: counters.blocksPlaced >= 10,
      progress: `${Math.min(counters.blocksPlaced, 10)}/10`,
    },
    {
      id: 'creature_interaction',
      label: 'Defeat one passive creature',
      complete: counters.creaturesDefeated >= 1,
      progress: `${Math.min(counters.creaturesDefeated, 1)}/1`,
    },
    {
      id: 'redstone_signal',
      label: 'Toggle the redstone signal with L',
      complete: (runtime?.redstoneToggles ?? 0) >= 1,
      progress: `${Math.min(runtime?.redstoneToggles ?? 0, 1)}/1`,
    },
    {
      id: 'dimension_shift',
      label: 'Cycle a dimension with P',
      complete: (runtime?.portalUses ?? 0) >= 1,
      progress: runtime?.dimensionName ?? 'Overworld',
    },
    {
      id: 'find_settlement',
      label: 'Find the starter settlement',
      complete: runtime?.settlementDiscovered ?? false,
      progress: runtime?.settlementName ?? 'Undiscovered',
    },
    {
      id: 'craft_logic',
      label: 'Craft buildable logic wire',
      complete: getStackCount(inventory, 13) > 0,
      progress: `${getStackCount(inventory, 13)} owned`,
    },
    {
      id: 'craft_portal_core',
      label: 'Craft a portal core',
      complete: getStackCount(inventory, 15) > 0,
      progress: `${getStackCount(inventory, 15)} owned`,
    },
    {
      id: 'supply_village',
      label: 'Deliver supplies to settlement with V',
      complete: (runtime?.settlementProsperity ?? 0) >= 2,
      progress: `${runtime?.settlementProsperity ?? 0}/2 prosperity`,
    },
    {
      id: 'power_lamps',
      label: 'Power a placed signal lamp',
      complete: (runtime?.poweredSignalLamps ?? 0) > 0,
      progress: `${runtime?.poweredSignalLamps ?? 0} powered`,
    },
    {
      id: 'authority_ticks',
      label: 'Keep local authority online for 200 ticks',
      complete: (runtime?.authorityTicks ?? 0) >= 200,
      progress: `${Math.min(runtime?.authorityTicks ?? 0, 200)}/200`,
    },
    {
      id: 'settlement_trade',
      label: 'Complete a settlement barter with B',
      complete: (runtime?.tradesCompleted ?? 0) >= 1,
      progress: `${Math.min(runtime?.tradesCompleted ?? 0, 1)}/1`,
    },
    {
      id: 'network_sync',
      label: 'Maintain 75%+ local sync quality',
      complete: (runtime?.syncQuality ?? 0) >= 75,
      progress: `${runtime?.syncQuality ?? 0}%`,
    },
    {
      id: 'nextgen_planets',
      label: 'Observe the solar system runtime',
      complete: (runtime?.nextGen.planets ?? 0) >= 7,
      progress: `${runtime?.nextGen.planets ?? 0}/7`,
    },
    {
      id: 'ender_boss',
      label: 'Damage the Ender/Abyss finale with N',
      complete: (runtime?.nextGen.dragonHealth ?? 500) < 500,
      progress: `Dragon ${runtime?.nextGen.dragonHealth ?? 500}`,
    },
    {
      id: 'moon_launch',
      label: 'Launch a rocket to the Moon with R',
      complete: runtime?.nextGen.moonRuntime ?? false,
      progress: runtime?.nextGen.moonRuntime ? 'moon reached' : 'rocket ready',
    },
    {
      id: 'credits',
      label: 'Unlock or start the ending credits with C',
      complete: runtime?.nextGen.creditsActive ?? false,
      progress: runtime?.nextGen.endingUnlocked ? 'ending unlocked' : 'bosses remain',
    },
    {
      id: 'memory_shards',
      label: 'Collect 71 Memory Shards to restore the Journal',
      complete: counters.shardsCollected >= 71,
      progress: `${counters.shardsCollected}/71 shards`,
    },
  ];
}
