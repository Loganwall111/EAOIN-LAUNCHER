/**
 * HowToPlayGuide — the instruction manual panel.
 *
 * The Guide button (📖) on the title screen and the in-game nav rail existed
 * for a long time pointing nowhere useful: on the title screen it silently
 * opened the world list, and in-game it opened the plain inventory with no
 * actual instructions anywhere in it. This is the panel that button was
 * always supposed to open — a real "how to play" reference covering:
 *
 *   1. Basic block-building and mining controls.
 *   2. The exact crafting recipes for early tools (wooden pickaxe first).
 *   3. The exact block structures + item interactions that ignite and
 *      activate the dimensional portals.
 *
 * It reads its content straight from `RecipeBook` and `PortalSystem` so the
 * numbers shown here can never drift out of sync with the actual game rules.
 */
import { getBlock } from '@shared/blocks/BlockRegistry';
import { RECIPES, recipeCostLabel, recipeOutputLabel } from '../crafting/RecipeBook';
import { PORTAL_DEFS } from '../portals/PortalSystem';

export interface HowToPlayGuideProps {
  onClose: () => void;
}

/** The recipes worth teaching a brand-new player first, in learning order. */
const STARTER_RECIPE_IDS = ['wooden_pickaxe', 'wooden_axe', 'wooden_shovel', 'stone_pickaxe', 'portal_core'] as const;

const CONTROLS: Array<{ key: string; action: string }> = [
  { key: 'W A S D', action: 'Move' },
  { key: 'SPACE', action: 'Jump (double-tap to toggle flight in Creative)' },
  { key: 'Mouse', action: 'Look around' },
  { key: 'Left Click (hold)', action: 'Mine the block you are looking at' },
  { key: 'Right Click', action: 'Place the selected block' },
  { key: '1-9', action: 'Select a hotbar slot' },
  { key: 'E or I', action: 'Open Inventory & Crafting' },
  { key: 'Q', action: 'Switch equipped tool' },
  { key: 'F', action: 'Toggle flight' },
  { key: 'P', action: 'Activate the portal you are standing at' },
  { key: 'G', action: 'Open a door' },
  { key: 'T', action: 'Open chat / commands' },
];

/** A step in the portal build-and-light sequence, in the order to perform them. */
const PORTAL_STEPS: string[] = [
  'Craft a Portal Core (see Recipes below) — this is the item that actually ignites a frame.',
  "Build a standing frame out of that dimension's frame block (see the table below — obsidian for the Nether, sandstone for Ancient Civilization, and so on).",
  'Place the Portal Core block inside the finished frame to light it.',
  'Stand within a few blocks of the lit frame and press P to activate it.',
  'The dimension you are sent to is always the frame\'s own configured destination — never a random jump — so the world you built for is the world you arrive in.',
];

export default function HowToPlayGuide({ onClose }: HowToPlayGuideProps) {
  const starterRecipes = STARTER_RECIPE_IDS
    .map((id) => RECIPES.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  // De-duplicate portal frame blocks so common ones (obsidian, sandstone…)
  // only show once with every dimension that uses them.
  const frameBlockToDimensions = new Map<number, string[]>();
  for (const def of PORTAL_DEFS) {
    if (def.dimension === 'overworld') continue; // the home doorway isn't a "portal to build"
    const list = frameBlockToDimensions.get(def.frameBlock) ?? [];
    list.push(def.name);
    frameBlockToDimensions.set(def.frameBlock, list);
  }

  return (
    <div className="how-to-play-panel" role="dialog" aria-label="How to Play">
      <div className="inventory-header">
        <div>
          <h2>📖 How to Play</h2>
          <p>Everything a new player needs: controls, crafting, and how to light a portal.</p>
        </div>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="htp-body">
        <section className="htp-section">
          <h3>Controls</h3>
          <div className="htp-controls-grid">
            {CONTROLS.map((c) => (
              <div key={c.key} className="htp-control-row">
                <span className="htp-key">{c.key}</span>
                <span className="htp-action">{c.action}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="htp-section">
          <h3>Crafting: Your First Tools</h3>
          <p className="htp-hint">Craft in this order. A wooden pickaxe is the very first thing you need — it unlocks mining stone and coal.</p>
          <div className="htp-recipe-list">
            {starterRecipes.map((recipe) => (
              <div key={recipe.id} className="htp-recipe-row">
                <strong>{recipe.name}</strong>
                <span>Needs: {recipeCostLabel(recipe)}</span>
                <span>Makes: {recipeOutputLabel(recipe)}</span>
                <small>{recipe.description}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="htp-section">
          <h3>Building &amp; Activating a Dimensional Portal</h3>
          <ol className="htp-steps">
            {PORTAL_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="htp-hint">Frame blocks by destination:</p>
          <div className="htp-portal-list">
            {Array.from(frameBlockToDimensions.entries()).map(([blockId, dimensions]) => (
              <div key={blockId} className="htp-portal-row">
                <strong>{getBlock(blockId).name}</strong>
                <span>{dimensions.join(', ')}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
