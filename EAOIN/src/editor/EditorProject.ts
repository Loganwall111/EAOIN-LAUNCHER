/**
 * EditorProject — the data model behind Editor Mode.
 *
 * A project is a self-contained creation: custom blocks, custom entities, a
 * terrain brush setup, spawn rules and metadata. Projects can be exported to
 * JSON, imported back, and published to the marketplace as a `MarketItem`.
 */
import { MarketCategory, MarketItem, CosmeticSlot } from '../marketplace/MarketplaceCatalog';

export type EditorTool =
  | 'select'
  | 'place'
  | 'erase'
  | 'paint'
  | 'fill'
  | 'brush'
  | 'terrain'
  | 'spawn'
  | 'entity';

export interface EditorToolMeta {
  id: EditorTool;
  label: string;
  icon: string;
  hint: string;
  /** Keyboard shortcut shown in the toolbar. */
  key: string;
}

export const EDITOR_TOOLS: EditorToolMeta[] = [
  { id: 'select', label: 'Select', icon: '🖱', hint: 'Select and move existing objects.', key: '1' },
  { id: 'place', label: 'Place', icon: '🧱', hint: 'Place the active block.', key: '2' },
  { id: 'erase', label: 'Erase', icon: '🧽', hint: 'Remove blocks.', key: '3' },
  { id: 'paint', label: 'Paint', icon: '🖌', hint: 'Repaint a block without changing its shape.', key: '4' },
  { id: 'fill', label: 'Fill', icon: '🪣', hint: 'Flood-fill a region.', key: '5' },
  { id: 'brush', label: 'Brush', icon: '☁', hint: 'Sculpt with a radial brush.', key: '6' },
  { id: 'terrain', label: 'Terrain', icon: '⛰', hint: 'Raise, lower and smooth terrain.', key: '7' },
  { id: 'spawn', label: 'Spawns', icon: '📍', hint: 'Place spawn points and triggers.', key: '8' },
  { id: 'entity', label: 'Entities', icon: '👾', hint: 'Spawn and configure entities.', key: '9' },
];

/** A block the creator defined inside the editor. */
export interface CustomBlock {
  id: string;
  name: string;
  /** Hex colour used for the material. */
  color: string;
  solid: boolean;
  emissive: boolean;
  /** 0-1 light emitted when `emissive`. */
  lightLevel: number;
  hardness: number;
}

/** An entity the creator defined inside the editor. */
export interface CustomEntity {
  id: string;
  name: string;
  /** Emoji/glyph used in the editor list and as placeholder art. */
  glyph: string;
  health: number;
  speed: number;
  hostile: boolean;
  /** Simple behaviour preset the runtime understands. */
  behaviour: 'idle' | 'wander' | 'follow' | 'flee' | 'patrol' | 'guard';
  scale: number;
}

/** A placed instance of an entity within the project. */
export interface EntityPlacement {
  id: string;
  entityId: string;
  x: number;
  y: number;
  z: number;
}

export interface EditorProjectMeta {
  name: string;
  author: string;
  description: string;
  category: MarketCategory;
  /** Price the creator wants to charge on the marketplace, in coins. */
  priceCoins: number;
  art: string;
  tint: string;
  tags: string[];
  slot?: CosmeticSlot;
}

export interface EditorProject {
  id: string;
  meta: EditorProjectMeta;
  blocks: CustomBlock[];
  entities: CustomEntity[];
  placements: EntityPlacement[];
  /** Seed used for the editor's preview world. */
  seed: string;
  createdAt: number;
  updatedAt: number;
  /** True once the project has been pushed to the marketplace. */
  published: boolean;
}

export const TINT_PRESETS = [
  'linear-gradient(135deg,#4a90d9,#2c5f8d)',
  'linear-gradient(135deg,#c0392b,#7b241c)',
  'linear-gradient(135deg,#58d68d,#1d8348)',
  'linear-gradient(135deg,#9b59b6,#5b2c6f)',
  'linear-gradient(135deg,#f39c12,#9a6407)',
  'linear-gradient(135deg,#34495e,#17202a)',
];

export const ART_PRESETS = ['🧱', '🌍', '⚔', '✨', '🦸', '🎮', '🐉', '🏝', '⚙', '🎨'];

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function createEmptyProject(author = 'You'): EditorProject {
  const now = Date.now();
  return {
    id: nextId('proj'),
    meta: {
      name: 'Untitled Creation',
      author,
      description: '',
      category: 'worlds',
      priceCoins: 300,
      art: ART_PRESETS[0],
      tint: TINT_PRESETS[0],
      tags: [],
    },
    blocks: [],
    entities: [],
    placements: [],
    seed: `editor_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: now,
    updatedAt: now,
    published: false,
  };
}

export function createCustomBlock(partial: Partial<CustomBlock> = {}): CustomBlock {
  return {
    id: nextId('blk'),
    name: 'New Block',
    color: '#8d6e63',
    solid: true,
    emissive: false,
    lightLevel: 0,
    hardness: 1.5,
    ...partial,
  };
}

export function createCustomEntity(partial: Partial<CustomEntity> = {}): CustomEntity {
  return {
    id: nextId('ent'),
    name: 'New Entity',
    glyph: '👾',
    health: 20,
    speed: 1,
    hostile: false,
    behaviour: 'wander',
    scale: 1,
    ...partial,
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Validation                                 */
/* -------------------------------------------------------------------------- */

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Checks a project is fit to publish. Mirrors what a review team would flag. */
export function validateForPublish(project: EditorProject): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = project.meta.name.trim();
  if (name.length < 3) errors.push('Name must be at least 3 characters.');
  if (name.length > 48) errors.push('Name must be 48 characters or fewer.');
  if (name.toLowerCase() === 'untitled creation') {
    errors.push('Give your creation a real name before publishing.');
  }

  if (project.meta.description.trim().length < 10) {
    errors.push('Write a description of at least 10 characters.');
  }

  if (project.meta.priceCoins < 0) errors.push('Price cannot be negative.');
  if (!Number.isInteger(project.meta.priceCoins)) errors.push('Price must be a whole number of coins.');
  if (project.meta.priceCoins > 10_000) errors.push('Price cannot exceed 10,000 coins.');

  const isEmpty =
    project.blocks.length === 0 &&
    project.entities.length === 0 &&
    project.placements.length === 0;
  if (isEmpty) errors.push('Add at least one custom block or entity before publishing.');

  if (project.meta.tags.length === 0) warnings.push('Adding tags helps players find your creation.');
  if (project.meta.priceCoins === 0) warnings.push('This will be published as a free item.');
  if (project.meta.priceCoins > 2_000) warnings.push('High prices sell far fewer copies.');

  return { ok: errors.length === 0, errors, warnings };
}

/** Convert a finished project into a marketplace listing. */
export function toMarketItem(project: EditorProject): MarketItem {
  return {
    id: `creator-${project.id}`,
    name: project.meta.name.trim(),
    creator: project.meta.author,
    category: project.meta.category,
    priceCoins: project.meta.priceCoins,
    description: project.meta.description.trim(),
    art: project.meta.art,
    tint: project.meta.tint,
    downloads: 0,
    rating: 0,
    tags: project.meta.tags,
    slot: project.meta.slot,
    official: false,
    userCreated: true,
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Persistence                                */
/* -------------------------------------------------------------------------- */

const PROJECTS_KEY = 'eaoin:editor:projects:v1';

export function loadProjects(): EditorProject[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as EditorProject[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: EditorProject[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch { /* non-fatal */ }
}

/** Serialise a project for download/sharing. */
export function exportProject(project: EditorProject): string {
  return JSON.stringify({ format: 'eaoin-editor-project', version: 1, project }, null, 2);
}

/** Parse a previously exported project. Returns null when the file is invalid. */
export function importProject(json: string): EditorProject | null {
  try {
    const parsed = JSON.parse(json) as { format?: string; project?: EditorProject };
    if (parsed.format !== 'eaoin-editor-project' || !parsed.project) return null;
    const project = parsed.project;
    // Re-key on import so importing twice cannot collide.
    return { ...project, id: nextId('proj'), published: false, updatedAt: Date.now() };
  } catch {
    return null;
  }
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}
