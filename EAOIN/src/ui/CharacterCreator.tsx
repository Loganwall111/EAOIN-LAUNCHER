/**
 * CharacterCreator — the second concept-art screen.
 *
 * Left: category tabs + option pickers. Centre: live voxel preview on a stone
 * platform with turntable arrows and a name field. Right: background picker.
 */
import { useState } from 'react';
import {
  CharacterAppearance, CLOTHES_COLORS, CREATOR_BACKGROUNDS, CREATOR_TABS, CreatorTabID,
  EYE_COLORS, FACIAL_HAIR_COUNT, HAIR_COLORS, HAIR_STYLE_COUNT, SKIN_TONES, UI_ASSETS,
} from './theme';
import VoxelAvatar, { MiniHead } from './VoxelAvatar';

export interface CharacterCreatorProps {
  appearance: CharacterAppearance;
  onChange: (next: CharacterAppearance) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const PRESETS: Array<{ id: string; label: string; patch: Partial<CharacterAppearance> }> = [
  { id: 'explorer', label: 'Explorer', patch: { skinTone: SKIN_TONES[1], hairStyle: 10, hairColor: HAIR_COLORS[2], shirtColor: '#2aa8a8' } },
  { id: 'miner', label: 'Miner', patch: { skinTone: SKIN_TONES[3], hairStyle: 2, hairColor: HAIR_COLORS[0], shirtColor: '#8a5738' } },
  { id: 'mage', label: 'Mage', patch: { skinTone: SKIN_TONES[0], hairStyle: 18, hairColor: HAIR_COLORS[8], shirtColor: '#8b5cf6' } },
  { id: 'ranger', label: 'Ranger', patch: { skinTone: SKIN_TONES[4], hairStyle: 7, hairColor: HAIR_COLORS[5], shirtColor: '#7ac74f' } },
  { id: 'knight', label: 'Knight', patch: { skinTone: SKIN_TONES[2], hairStyle: 4, hairColor: HAIR_COLORS[3], shirtColor: '#2f3640' } },
  { id: 'nomad', label: 'Nomad', patch: { skinTone: SKIN_TONES[5], hairStyle: 21, hairColor: HAIR_COLORS[1], shirtColor: '#e8a23a' } },
];

export default function CharacterCreator({ appearance, onChange, onConfirm, onCancel }: CharacterCreatorProps) {
  const [tab, setTab] = useState<CreatorTabID>('appearance');
  const [rotation, setRotation] = useState(0);

  const patch = (next: Partial<CharacterAppearance>) => onChange({ ...appearance, ...next });
  const background = CREATOR_BACKGROUNDS.find((b) => b.id === appearance.background) ?? CREATOR_BACKGROUNDS[0];

  return (
    <div className="eaoin-creator" style={{ backgroundImage: `url(${UI_ASSETS.creatorBackdrop})` }}>
      <h2 className="creator-heading ui-panel">Character Creator</h2>

      {/* ------------------------------ left column ------------------------------ */}
      <div className="creator-left">
        <div className="creator-body" style={{ flex: 1, minHeight: 0 }}>
          <div className="creator-tabs ui-panel">
            {CREATOR_TABS.map((entry) => (
              <button key={entry.id} className={`creator-tab ${tab === entry.id ? 'active' : ''}`} onClick={() => setTab(entry.id)}>
                <span>{entry.icon}</span>{entry.label}
              </button>
            ))}
          </div>

          <div className="creator-options ui-panel">
            {(tab === 'appearance' || tab === 'body') && (
              <div className="option-group">
                <p className="option-group-label">Skin Tone</p>
                <div className="swatch-row">
                  {SKIN_TONES.map((tone) => (
                    <button key={tone} className={`swatch ${appearance.skinTone === tone ? 'selected' : ''}`}
                      style={{ background: tone }} onClick={() => patch({ skinTone: tone })} aria-label={`Skin ${tone}`} />
                  ))}
                </div>
              </div>
            )}

            {(tab === 'appearance' || tab === 'hair') && (
              <>
                <div className="option-group">
                  <p className="option-group-label">Hair Style</p>
                  <div className="style-grid">
                    {Array.from({ length: HAIR_STYLE_COUNT }, (_, i) => (
                      <button key={i} className={`style-cell ${appearance.hairStyle === i ? 'selected' : ''}`}
                        onClick={() => patch({ hairStyle: i })} aria-label={`Hair style ${i + 1}`}>
                        <MiniHead skinTone={appearance.skinTone} hairColor={appearance.hairColor} style={i} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="option-group">
                  <p className="option-group-label">Hair Color</p>
                  <div className="swatch-row">
                    {HAIR_COLORS.map((color) => (
                      <button key={color} className={`swatch ${appearance.hairColor === color ? 'selected' : ''}`}
                        style={{ background: color }} onClick={() => patch({ hairColor: color })} aria-label={`Hair ${color}`} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'facial' && (
              <div className="option-group">
                <p className="option-group-label">Facial Hair</p>
                <div className="style-grid">
                  {Array.from({ length: FACIAL_HAIR_COUNT }, (_, i) => (
                    <button key={i} className={`style-cell ${appearance.facialHair === i ? 'selected' : ''}`}
                      onClick={() => patch({ facialHair: i })} aria-label={i === 0 ? 'No facial hair' : `Facial hair ${i}`}>
                      <span style={{ fontSize: 13 }}>{i === 0 ? '—' : '🧔'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'eyes' && (
              <div className="option-group">
                <p className="option-group-label">Eye Color</p>
                <div className="swatch-row">
                  {EYE_COLORS.map((color) => (
                    <button key={color} className={`swatch ${appearance.eyeColor === color ? 'selected' : ''}`}
                      style={{ background: color }} onClick={() => patch({ eyeColor: color })} aria-label={`Eyes ${color}`} />
                  ))}
                </div>
              </div>
            )}

            {tab === 'clothes' && (
              <>
                <div className="option-group">
                  <p className="option-group-label">Shirt</p>
                  <div className="swatch-row">
                    {CLOTHES_COLORS.map((color) => (
                      <button key={color} className={`swatch ${appearance.shirtColor === color ? 'selected' : ''}`}
                        style={{ background: color }} onClick={() => patch({ shirtColor: color })} aria-label={`Shirt ${color}`} />
                    ))}
                  </div>
                </div>
                <div className="option-group">
                  <p className="option-group-label">Trousers</p>
                  <div className="swatch-row">
                    {CLOTHES_COLORS.map((color) => (
                      <button key={color} className={`swatch ${appearance.pantsColor === color ? 'selected' : ''}`}
                        style={{ background: color }} onClick={() => patch({ pantsColor: color })} aria-label={`Trousers ${color}`} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'accessories' && (
              <div className="option-group">
                <p className="option-group-label">Accessories</p>
                <p style={{ font: '400 11px/1.6 var(--ui-font)', color: 'var(--ui-text-dim)' }}>
                  Backpacks, capes and pets unlock as you progress through the world.
                </p>
              </div>
            )}

            {tab === 'presets' && (
              <div className="option-group">
                <p className="option-group-label">Presets</p>
                <div className="style-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                  {PRESETS.map((preset) => (
                    <button key={preset.id} className="style-cell" style={{ aspectRatio: 'auto', padding: '10px 4px', fontSize: 10, fontWeight: 700 }}
                      onClick={() => patch(preset.patch)}>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------ preview stage ---------------------------- */}
      <div className="creator-stage">
        <div className="avatar-stage" style={{ background: background.css, backgroundBlendMode: 'multiply' }}>
          <VoxelAvatar appearance={appearance} rotation={rotation} />
        </div>
        <div className="avatar-platform" />
        <div className="rotate-row">
          <button className="rotate-btn" onClick={() => setRotation((r) => r - 45)} aria-label="Rotate left">↺</button>
          <div className="name-field ui-panel">
            <input value={appearance.name} maxLength={20} onChange={(e) => patch({ name: e.target.value })} aria-label="Character name" />
            <span style={{ color: 'var(--ui-text-dim)' }}>✎</span>
          </div>
          <button className="rotate-btn" onClick={() => setRotation((r) => r + 45)} aria-label="Rotate right">↻</button>
        </div>
        <button className="confirm-btn" onClick={onConfirm}>Confirm</button>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--ui-text-dim)', font: '700 11px var(--ui-font)', letterSpacing: '.1em', cursor: 'pointer', textTransform: 'uppercase' }}
        >
          Back to menu
        </button>
      </div>

      {/* ------------------------------ background picker ------------------------ */}
      <div className="creator-right">
        <div className="ui-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="ui-panel-title">Background</div>
          <div className="bg-list">
            {CREATOR_BACKGROUNDS.map((bg) => (
              <button key={bg.id} className={`bg-cell ${appearance.background === bg.id ? 'selected' : ''}`}
                style={{ background: bg.css }} onClick={() => patch({ background: bg.id })} title={bg.label} aria-label={bg.label} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
