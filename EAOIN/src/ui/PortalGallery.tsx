/**
 * PortalGallery — 2.0: an area full of pre-built portals that each take you to
 * a different dimension. Styled like the create-world screen with all the main
 * options, then you step through a portal to enter that dimension.
 *
 * Each portal has its own look (obsidian nether portal, ground end portal,
 * crystal rift, globe aether portal, etc.) in red / blue / orange / purple.
 */
import { useState } from 'react';
import { getBossesByDimension } from '../creatures/BossRegistry';
import { PORTAL_DEFS } from '../portals/PortalSystem';

interface PortalEntry {
  id: string;
  dimension: string;
  name: string;
  emoji: string;
  colour: string;
  style: string;   // the portal look
  blurb: string;
  build?: { label: string; hint: string };
}

/** All dimensions available from the Nexus, with a colour + blurb each. */
const ALL_PORTALS: PortalEntry[] = [
  { id: 'overworld', dimension: 'overworld', name: 'Overworld', emoji: '🌍', colour: '#6cc24a', style: 'Wooden doorway', blurb: 'The main world — mountains, oceans, villages and more.' },
  { id: 'nether', dimension: 'nether', name: 'The Nether', emoji: '🔥', colour: '#ff5a1a', style: 'Obsidian frame', blurb: 'A sealed cave world of lava, basalt and crimson/warped forests under a bedrock roof.' },
  { id: 'end', dimension: 'end', name: 'The End', emoji: '🌌', colour: '#a832ff', style: 'Ground frame + end crystals', blurb: 'Rings of islands around a central dragon platform, under a purple-pink void sky with a growing black hole.' },
  { id: 'rift', dimension: 'rift_dimension', name: 'The Rift', emoji: '🌀', colour: '#2aa8e0', style: 'Blue rippling rift', blurb: 'Colourful floating hills, a reality rift, and drifting jellyfish.' },
  { id: 'humorous', dimension: 'humorous', name: 'The Humorous', emoji: '🪼', colour: '#7a4dff', style: 'Pink-purple portal', blurb: 'Floating isles of crystal spires, laugh-houses and cosmic jellyfish.' },
  { id: 'aether', dimension: 'aether', name: 'The Aether', emoji: '☁️', colour: '#ffd166', style: 'Glowing globe portal', blurb: 'A floating paradise above the clouds.' },
  { id: 'crystal', dimension: 'crystal_realm', name: 'Crystal Realm', emoji: '💎', colour: '#b388ff', style: 'Crystal ring', blurb: 'Glowing crystal shards and light-filled caverns.' },
  { id: 'sky', dimension: 'sky_kingdom', name: 'Sky Kingdom', emoji: '☁', colour: '#9fd6ff', style: 'Sky gate', blurb: 'A floating kingdom among the clouds.' },
  { id: 'abyss', dimension: 'abyss', name: 'The Abyss', emoji: '🕳', colour: '#3a1a5a', style: 'Void rift', blurb: 'A dark void crack in reality itself.' },
  { id: 'alien', dimension: 'alien_worlds', name: 'Alien Worlds', emoji: '👽', colour: '#5dd6c4', style: 'Alien wormhole', blurb: 'Buzzing, humming worlds of exotic life.' },
  { id: 'space', dimension: 'gas_giant', name: 'Deep Space', emoji: '🚀', colour: '#ffb86b', style: 'Space gate', blurb: 'The gas giants and the void between the stars.' },
  { id: 'ancient', dimension: 'ancient_civilization', name: 'Ancient Civilization', emoji: '🏛', colour: '#e8d18a', style: 'Runic arch', blurb: 'A lost sandstone civilization carved with runes.' },
  { id: 'chaos', dimension: 'chaos_dimension', name: 'Chaos Dimension', emoji: '🌀', colour: '#ff3a8a', style: 'Reality fracture', blurb: 'A jagged, unpredictable tear in spacetime.' },
  { id: 'dream', dimension: 'dream_realm', name: 'Dream Realm', emoji: '🌈', colour: '#ff9ad5', style: 'Pastel arch', blurb: 'A soft, surreal world of pastel light.' },
  { id: 'machine', dimension: 'machine_dimension', name: 'Machine Dimension', emoji: '🤖', colour: '#b0bec5', style: 'Gear gate', blurb: 'A world of gears, circuits and industrial light.' },
  { id: 'void', dimension: 'cosmic_void', name: 'Cosmic Void', emoji: '🌌', colour: '#7a2ad0', style: 'Infinite nexus', blurb: 'A central nexus connecting every dimension.' },
  { id: 'toxic', dimension: 'toxic_wasteland', name: 'Toxic Wasteland', emoji: '☢', colour: '#7ad43c', style: 'Acid ring', blurb: 'A noxious green wasteland.' },
  { id: 'frozen', dimension: 'frozen_wasteland', name: 'Frozen Wasteland', emoji: '❄', colour: '#9fc6ff', style: 'Ice arch', blurb: 'A timeless expanse of ice and silence.' },
  { id: 'volcanic', dimension: 'volcanic_realm', name: 'Volcanic Realm', emoji: '🌋', colour: '#e0483f', style: 'Magma circle', blurb: 'Obsidian and basalt with rivers of molten lava.' },
  { id: 'ocean', dimension: 'ocean_world', name: 'Ocean World', emoji: '🌊', colour: '#3a86d0', style: 'Coral arch', blurb: 'A water world of coral and tides.' },
  { id: 'forest', dimension: 'giant_forest', name: 'Giant Forest', emoji: '🌳', colour: '#4a9a4a', style: 'Overgrown arch', blurb: 'Towering trees and overgrown woodland.' },
  { id: 'mushroom', dimension: 'mushroom_kingdom', name: 'Mushroom Kingdom', emoji: '🍄', colour: '#b86ae8', style: 'Spore arch', blurb: 'A spore-lit kingdom of giant mushrooms.' },
  { id: 'storm', dimension: 'storm_dimension', name: 'Storm Dimension', emoji: '⚡', colour: '#7a8aee', style: 'Lightning arch', blurb: 'An endless storm of lightning and wind.' },
  { id: 'astral', dimension: 'astral_plane', name: 'Astral Plane', emoji: '🌠', colour: '#9a6ae8', style: 'Star ring', blurb: 'A floating ring of stars.' },
  { id: 'nature', dimension: 'nature_dimension', name: 'Nature Dimension', emoji: '🌿', colour: '#5fbe6a', style: 'Verdant gate', blurb: 'An untouched, lush wilderness.' },
  { id: 'prehistoric', dimension: 'prehistoric_world', name: 'Prehistoric World', emoji: '🦖', colour: '#8a9a4a', style: 'Ancient gate', blurb: 'A primal world of giant creatures.' },
  { id: 'shadow', dimension: 'shadow_realm', name: 'Shadow Realm', emoji: '🌑', colour: '#4a3a6a', style: 'Dark rift', blurb: 'A realm of shadows and whispers.' },
  { id: 'spirit', dimension: 'spirit_realm', name: 'Spirit Realm', emoji: '👻', colour: '#b0a8e8', style: 'Ghost gate', blurb: 'A spectral world between worlds.' },
  { id: 'undead', dimension: 'undead_realm', name: 'Undead Realm', emoji: '💀', colour: '#6a6a6a', style: 'Bone arch', blurb: 'A cursed land of the restless dead.' },
  { id: 'moon', dimension: 'moon', name: 'The Moon', emoji: '🌙', colour: '#c8ccd8', style: 'Space gate', blurb: 'A low-gravity lunar surface.' },
  { id: 'warped', dimension: 'warped', name: 'The Warped', emoji: '🕳️', colour: '#4a2a8a', style: 'Lensed rift', blurb: 'A regular Minecraft world bent by black holes — lensed sky echoes and gravity wells everywhere.' },
];

const PORTALS: PortalEntry[] = ALL_PORTALS;

/** Pull the live build-technique recipe from PORTAL_DEFS where one exists. */
function buildRecipeFor(dimension: string): { label: string; hint: string } | undefined {
  const def = PORTAL_DEFS.find((d) => d.dimension === dimension);
  if (!def?.build) return undefined;
  return { label: def.build.label, hint: def.build.hint };
}

export default function PortalGallery({ onBack, onTravel }: { onBack: () => void; onTravel: (dimension: string) => void }) {
  const [selected, setSelected] = useState<PortalEntry>(PORTALS[0]);
  const recipe = buildRecipeFor(selected.dimension);

  return (
    <div className="portal-gallery">
      <div className="portal-gallery-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">THE NEXUS</div>
          <h1 className="screen-title">One Portal to Every World</h1>
        </div>
      </div>

      <div className="portal-gallery-body">
        <div className="portal-list">
          {PORTALS.map((p) => (
            <button key={p.id} className={`portal-card ${selected.id === p.id ? 'selected' : ''}`} onClick={() => setSelected(p)}>
              <span className="portal-emoji" style={{ background: p.colour }}>{p.emoji}</span>
              <div>
                <strong>{p.name}</strong>
                <small>{p.style}</small>
              </div>
            </button>
          ))}
        </div>

        <div className="portal-preview">
          {/* The portal: a colourful ring with a glowing inner "see-through" disc */}
          <div className="portal-ring" style={{ borderColor: selected.colour, boxShadow: `0 0 40px ${selected.colour}88` }}>
            <div className="portal-ring-inner" style={{ background: `radial-gradient(circle, ${selected.colour}44, ${selected.colour}aa 45%, ${selected.colour}66)` }} />
            <div className="portal-emoji big">{selected.emoji}</div>
          </div>
          <h2>{selected.name}</h2>
          <p className="portal-blurb">{selected.blurb}</p>
          {recipe && (
            <div className="portal-recipe">
              <strong>🔧 How to build this portal</strong>
              <span className="portal-recipe-label">{recipe.label}</span>
              <span className="portal-recipe-hint">{recipe.hint}</span>
            </div>
          )}
          <div className="portal-mobs">
            {getBossesByDimension(selected.dimension as never).slice(0, 3).map((b) => <span key={b.id} className="portal-mob">{b.emoji} {b.name}</span>)}
          </div>
          <button className="confirm-btn wide" onClick={() => onTravel(selected.dimension)}>
            Step Through → {selected.name}
          </button>
        </div>
      </div>
    </div>
  );
}
