/**
 * Crafting System — Recipes, Crafting Table, Recipe Book
 */
export interface Recipe {
  id: string;
  output: number; // BlockID or ItemID
  outputCount: number;
  ingredients: Record<string, number>; // item name -> count
  shape?: string[]; // 3x3 grid pattern
  category: 'crafting' | 'smelting' | 'smithing';
}

export class CraftingSystem {
  private recipes: Map<string, Recipe> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.registerRecipe({
      id: 'planks',
      output: 6,
      outputCount: 4,
      ingredients: { 'wood': 1 },
      category: 'crafting',
    });
    this.registerRecipe({
      id: 'stick',
      output: 3,
      outputCount: 4,
      ingredients: { 'planks': 2 },
      category: 'crafting',
    });
  }

  registerRecipe(recipe: Recipe): void {
    this.recipes.set(recipe.id, recipe);
    console.log(`[Crafting] Registered recipe: ${recipe.id}`);
  }

  canCraft(recipeId: string, inventory: Record<string, number>): boolean {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return false;
    for (const [item, count] of Object.entries(recipe.ingredients)) {
      if ((inventory[item] ?? 0) < count) return false;
    }
    return true;
  }

  craft(recipeId: string, inventory: Record<string, number>): { result?: number; resultCount?: number; inventory: Record<string, number> } {
    const recipe = this.recipes.get(recipeId);
    const newInv = { ...inventory };
    if (!recipe) return { inventory: newInv };
    for (const [item, count] of Object.entries(recipe.ingredients)) {
      newInv[item] = (newInv[item] ?? 0) - count;
    }
    newInv[recipe.id] = (newInv[recipe.id] ?? 0) + recipe.outputCount;
    return { result: recipe.output, resultCount: recipe.outputCount, inventory: newInv };
  }

  getRecipes(): Recipe[] {
    return Array.from(this.recipes.values());
  }
}
