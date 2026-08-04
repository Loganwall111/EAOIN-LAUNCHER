/**
 * GodConsole — a searchable "control everything" command bar.
 *
 * Lists every Full-Game-Settings option by name with a live toggle/slider, so
 * you can search and flip ANY of the 187 settings instantly. Also gives quick
 * one-click actions: toggle flight, spawn a mob, and teleport to spawn.
 *
 * Opened with the ` key (backtick) or the 🕹 God Console button.
 */
import { useMemo, useState } from 'react';
import { SuperSettings, defaultSuperSettings } from '../settings/SuperSettings';

interface Props {
  settings: SuperSettings;
  onChange: (s: SuperSettings) => void;
  onFly: () => void;
  onNoClip: () => void;
  onSpawnMob: () => void;
  onTeleportSpawn: () => void;
  onSummonPet: () => void;
  onClose: () => void;
}

/** Human labels for every setting key, so search feels natural. */
const LABELS: Record<string, string> = {
  coloredLighting: 'Coloured lighting', lightMixing: 'Light mixing', godRays: 'God rays',
  glassRefraction: 'Glass refraction', glowGlassIntensity: 'Glow glass intensity',
  skyTint: 'Sky tint', fogTint: 'Fog tint', dayTint: 'Day tint', nightTint: 'Night tint',
  cloudDensity: 'Cloud density', cloudHeight: 'Cloud height', starDensity: 'Star density',
  auroraStrength: 'Aurora strength', sunBrightness: 'Sun brightness', moonBrightness: 'Moon brightness',
  horizonBlend: 'Horizon blend', particleDensity: 'Particle density', weatherIntensity: 'Weather intensity',
  gravityScale: 'Gravity scale', dayLength: 'Day length', knockback: 'Knockback',
  flySpeed: 'Fly speed', mouseSensitivity: 'Mouse sensitivity', fovSlider: 'Field of view',
  terrainHeight: 'Terrain height', biomeSize: 'Biome size', caveSize: 'Cave size',
  treeDensity: 'Tree density', oreDensity: 'Ore density', mobCap: 'Mob cap',
  mobSpawnRate: 'Mob spawn rate', animalDensity: 'Animal density', cropGrowthSpeed: 'Crop growth speed',
  waterOpacity: 'Water opacity', glassOpacity: 'Glass opacity', hudOpacity: 'HUD opacity',
  hotbarScale: 'Hotbar scale', chatSize: 'Chat size', autoSaveInterval: 'Auto-save interval',
};

export default function GodConsole({ settings, onChange, onFly, onNoClip, onSpawnMob, onTeleportSpawn, onSummonPet, onClose }: Props) {
  const merged = useMemo(() => ({ ...defaultSuperSettings(), ...settings }) as SuperSettings, [settings]);
  const [query, setQuery] = useState('');

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (Object.keys(merged) as Array<keyof SuperSettings>)
      .filter((key) => key !== 'enabled' && key !== 'blockColorOverrides')
      .map((key) => ({
        key,
        label: LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
        value: merged[key],
      }))
      .filter((e) => !q || e.label.toLowerCase().includes(q) || e.key.toLowerCase().includes(q));
  }, [merged, query]);

  const patch = (next: Partial<SuperSettings>) => onChange({ ...merged, ...next });

  return (
    <div className="god-console scrim">
      <div className="god-console-panel">
        <div className="god-console-head">
          <span>🕹 Creative God Console</span>
          <button className="super-close" onClick={onClose}>✕</button>
        </div>
        <div className="god-console-search">
          <input
            className="ui-input"
            autoFocus
            placeholder="Search any setting… e.g. gravity, cloud, fly, day length"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="god-console-count">{entries.length} settings</span>
        </div>

        <div className="god-console-actions">
          <button className="super-btn" onClick={onFly}>🪽 Toggle Flight</button>
          <button className="super-btn" onClick={onNoClip}>👻 No-Clip</button>
          <button className="super-btn" onClick={onSpawnMob}>🐑 Spawn Mob</button>
          <button className="super-btn" onClick={onTeleportSpawn}>📍 Teleport to Spawn</button>
          <button className="super-btn" onClick={onSummonPet}>🐺 Summon Pet</button>
        </div>

        <div className="god-console-list">
          {entries.map((e) => (
            <div className="god-console-row" key={e.key}>
              <span className="god-console-label">{e.label}</span>
              {typeof e.value === 'boolean' ? (
                <button
                  className={`toggle ${e.value ? 'on' : ''}`}
                  onClick={() => patch({ [e.key]: !e.value } as Partial<SuperSettings>)}
                  aria-label={e.label}
                ><span /></button>
              ) : (
                <input
                  type="range"
                  min={0}
                  max={e.key === 'dayLength' ? 3600 : e.key === 'mobCap' ? 200 : e.key === 'autoSaveInterval' ? 600 : 3}
                  step={0.05}
                  value={Number(e.value)}
                  onChange={(ev) => patch({ [e.key]: Number(ev.target.value) } as Partial<SuperSettings>)}
                />
              )}
            </div>
          ))}
          {entries.length === 0 && <div className="god-console-empty">No settings match “{query}”.</div>}
        </div>
      </div>
    </div>
  );
}
