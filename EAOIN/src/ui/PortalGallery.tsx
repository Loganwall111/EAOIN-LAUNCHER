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

interface PortalEntry {
  id: string;
  dimension: string;
  name: string;
  emoji: string;
  colour: string;
  style: string;   // the portal look
  blurb: string;
}

const PORTALS: PortalEntry[] = [
  { id: 'nether', dimension: 'nether', name: 'The Nether', emoji: '🔥', colour: '#ff5a1a', style: 'Obsidian frame', blurb: 'A sealed cave world of lava, basalt and crimson/warped forests under a bedrock roof.' },
  { id: 'end', dimension: 'end', name: 'The End', emoji: '🌌', colour: '#a832ff', style: 'Ground frame + end crystals', blurb: 'Rings of islands around a central dragon platform, under a purple-pink void sky.' },
  { id: 'rift', dimension: 'rift_dimension', name: 'The Rift', emoji: '🌀', colour: '#2aa8e0', style: 'Blue rippling rift', blurb: 'Colourful floating hills, a reality rift, and drifting jellyfish.' },
  { id: 'humorous', dimension: 'humorous', name: 'The Humorous', emoji: '🪼', colour: '#7a4dff', style: 'Pink-purple portal', blurb: 'Floating isles of crystal spires, laugh-houses and cosmic jellyfish.' },
  { id: 'aether', dimension: 'aether', name: 'The Aether', emoji: '☁️', colour: '#ffd166', style: 'Glowing globe portal', blurb: 'A floating paradise above the clouds.' },
  { id: 'nether2', dimension: 'volcanic_realm', name: 'Volcanic Realm', emoji: '🌋', colour: '#e0483f', style: 'Magma circle', blurb: 'Obsidian and basalt with rivers of molten lava.' },
];

export default function PortalGallery({ onBack, onTravel }: { onBack: () => void; onTravel: (dimension: string) => void }) {
  const [selected, setSelected] = useState<PortalEntry>(PORTALS[0]);

  return (
    <div className="portal-gallery">
      <div className="portal-gallery-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">PORTAL GALLERY</div>
          <h1 className="screen-title">Choose a Portal</h1>
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
