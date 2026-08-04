/**
 * SuperSettingsPanel — the deep settings drawer (Part 4).
 *
 * A large, tabbed panel underneath the regular Settings that exposes the full
 * configurability of SuperSettings: coloured lighting, god rays, glass
 * refraction, world colour overrides, camera capture, hardware ray tracing
 * (experimental, off by default), debug/developer toggles, a mod rebuilder and
 * an in-game world editor shortcut.
 */
import { useState } from 'react';
import { SuperSettings, defaultSuperSettings } from '../settings/SuperSettings';
import { getGodMode } from '../arg/GodMode';

type Tab = 'sky' | 'world' | 'lighting' | 'fx' | 'audio' | 'gameplay' | 'creative' | 'perf' | 'ui' | 'misc' | 'camera' | 'rt' | 'god' | 'debug' | 'mods';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'sky', label: 'Sky', icon: '🌌' },
  { id: 'world', label: 'World', icon: '🌍' },
  { id: 'lighting', label: 'Lighting', icon: '💡' },
  { id: 'fx', label: 'Particles & FX', icon: '✨' },
  { id: 'audio', label: 'Audio', icon: '🔊' },
  { id: 'gameplay', label: 'Gameplay', icon: '🎮' },
  { id: 'creative', label: 'Creative & Build', icon: '🏗️' },
  { id: 'perf', label: 'Performance', icon: '⚡' },
  { id: 'ui', label: 'UI', icon: '🖥️' },
  { id: 'misc', label: 'Misc / Rules', icon: '🧩' },
  { id: 'camera', label: 'Camera', icon: '📷' },
  { id: 'rt', label: 'Ray Tracing', icon: '🔆' },
  { id: 'god', label: 'God Mode', icon: '👑' },
  { id: 'debug', label: 'Debug', icon: '🐞' },
  { id: 'mods', label: 'Mods & Editor', icon: '🛠' },
];

interface Props {
  settings: SuperSettings;
  onChange: (s: SuperSettings) => void;
  /** Callbacks the deeper features need. */
  onCapture?: (mode: 'photo' | 'video') => void;
  onOpenModEditor?: () => void;
  onOpenWorldEditor?: () => void;
  onClose: () => void;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="opt-row">
      <div className="opt-label"><strong>{label}</strong>{hint && <small>{hint}</small>}</div>
      <div className="opt-control">{children}</div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick} aria-label={label}>
      <span />
    </button>
  );
}

export default function SuperSettingsPanel({ settings, onChange, onCapture, onOpenModEditor, onOpenWorldEditor, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('sky');
  // Merge with defaults so a partially-populated settings object (tests, older
  // saves) never crashes on a missing field.
  const merged: SuperSettings = { ...defaultSuperSettings(), ...settings };
  const patch = (next: Partial<SuperSettings>) => onChange({ ...merged, ...next });

  return (
    <div className="super-settings scrim">
      <div className="super-panel">
        <div className="super-head">
          <span>⚙️ Full Game Settings</span>
          <button className="super-close" onClick={onClose}>✕</button>
        </div>

        <div className="super-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`super-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="super-body">
          {tab === 'sky' && (
            <>
              <Row label="Sky mode" hint="Pick the atmosphere look for the world.">
                <select className="ui-input" value={merged.skyMode} onChange={(e) => patch({ skyMode: e.target.value as SuperSettings['skyMode'] })}>
                  <option value="default">Default</option>
                  <option value="day">Always day</option>
                  <option value="night">Always night</option>
                  <option value="sunset">Sunset</option>
                  <option value="space">Space</option>
                  <option value="void">Void</option>
                  <option value="aurora">Aurora</option>
                </select>
              </Row>
              <Row label="Cloud density" hint={`${Math.round(merged.cloudDensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.cloudDensity} onChange={(e) => patch({ cloudDensity: Number(e.target.value) })} />
              </Row>
              <Row label="Cloud height offset" hint={String(merged.cloudHeight)}>
                <input type="range" min={-40} max={40} step={2} value={merged.cloudHeight} onChange={(e) => patch({ cloudHeight: Number(e.target.value) })} />
              </Row>
              <Row label="Star density" hint={`${Math.round(merged.starDensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.starDensity} onChange={(e) => patch({ starDensity: Number(e.target.value) })} />
              </Row>
              <Row label="Aurora strength" hint={`${Math.round(merged.auroraStrength * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.auroraStrength} onChange={(e) => patch({ auroraStrength: Number(e.target.value) })} />
              </Row>
              <Row label="Sun brightness" hint={`${merged.sunBrightness.toFixed(2)}x`}>
                <input type="range" min={0} max={2} step={0.05} value={merged.sunBrightness} onChange={(e) => patch({ sunBrightness: Number(e.target.value) })} />
              </Row>
              <Row label="Moon brightness" hint={`${merged.moonBrightness.toFixed(2)}x`}>
                <input type="range" min={0} max={2} step={0.05} value={merged.moonBrightness} onChange={(e) => patch({ moonBrightness: Number(e.target.value) })} />
              </Row>
              <Row label="Horizon blend" hint={`${Math.round(merged.horizonBlend * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.horizonBlend} onChange={(e) => patch({ horizonBlend: Number(e.target.value) })} />
              </Row>
            </>
          )}

          {tab === 'fx' && (
            <>
              <Row label="Particle density" hint={`${Math.round(merged.particleDensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.particleDensity} onChange={(e) => patch({ particleDensity: Number(e.target.value) })} />
              </Row>
              <Row label="Weather" hint="Enable storms, rain and biome weather.">
                <Toggle on={merged.weatherEnabled} onClick={() => patch({ weatherEnabled: !merged.weatherEnabled })} label="Weather" />
              </Row>
              <Row label="Weather intensity" hint={`${Math.round(merged.weatherIntensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.weatherIntensity} onChange={(e) => patch({ weatherIntensity: Number(e.target.value) })} />
              </Row>
              <Row label="Tornadoes" hint="Severe-weather tornadoes can form.">
                <Toggle on={merged.tornadoes} onClick={() => patch({ tornadoes: !merged.tornadoes })} label="Tornadoes" />
              </Row>
              <Row label="Meteor showers" hint="Meteors streak across the night sky.">
                <Toggle on={merged.meteors} onClick={() => patch({ meteors: !merged.meteors })} label="Meteors" />
              </Row>
              <Row label="Fireflies" hint="Glowing fireflies in swamps after dark.">
                <Toggle on={merged.fireflies} onClick={() => patch({ fireflies: !merged.fireflies })} label="Fireflies" />
              </Row>
              <Row label="Leaf particles" hint="Leaves drop petals and debris.">
                <Toggle on={merged.leafParticles} onClick={() => patch({ leafParticles: !merged.leafParticles })} label="Leaf particles" />
              </Row>
              <Row label="Biome VFX" hint="Biome-specific ambient effects (snow, spores, etc.).">
                <Toggle on={merged.biomeVFX} onClick={() => patch({ biomeVFX: !merged.biomeVFX })} label="Biome VFX" />
              </Row>
            </>
          )}

          {tab === 'audio' && (
            <>
              <Row label="Master volume" hint={`${Math.round(merged.masterVolume * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.masterVolume} onChange={(e) => patch({ masterVolume: Number(e.target.value) })} />
              </Row>
              <Row label="Music volume" hint={`${Math.round(merged.musicVolume * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.musicVolume} onChange={(e) => patch({ musicVolume: Number(e.target.value) })} />
              </Row>
              <Row label="Sound effects" hint={`${Math.round(merged.sfxVolume * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.sfxVolume} onChange={(e) => patch({ sfxVolume: Number(e.target.value) })} />
              </Row>
              <Row label="Ambience" hint={`${Math.round(merged.ambienceVolume * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.ambienceVolume} onChange={(e) => patch({ ambienceVolume: Number(e.target.value) })} />
              </Row>
              <Row label="UI sounds" hint={`${Math.round(merged.uiVolume * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.uiVolume} onChange={(e) => patch({ uiVolume: Number(e.target.value) })} />
              </Row>
            </>
          )}

          {tab === 'gameplay' && (
            <>
              <Row label="Gravity scale" hint={`${merged.gravityScale.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.gravityScale} onChange={(e) => patch({ gravityScale: Number(e.target.value) })} />
              </Row>
              <Row label="Day length (seconds)" hint={`${merged.dayLength}s`}>
                <input type="range" min={120} max={3600} step={30} value={merged.dayLength} onChange={(e) => patch({ dayLength: Number(e.target.value) })} />
              </Row>
              <Row label="Mob spawning" hint="All mobs spawn in the world.">
                <Toggle on={merged.mobSpawning} onClick={() => patch({ mobSpawning: !merged.mobSpawning })} label="Mob spawning" />
              </Row>
              <Row label="Passive mobs" hint="Animals and villagers spawn.">
                <Toggle on={merged.passiveSpawning} onClick={() => patch({ passiveSpawning: !merged.passiveSpawning })} label="Passive mobs" />
              </Row>
              <Row label="Hostile mobs" hint="Monsters spawn at night.">
                <Toggle on={merged.hostileSpawning} onClick={() => patch({ hostileSpawning: !merged.hostileSpawning })} label="Hostile mobs" />
              </Row>
              <Row label="Breeding" hint="Animals can breed with food.">
                <Toggle on={merged.breeding} onClick={() => patch({ breeding: !merged.breeding })} label="Breeding" />
              </Row>
              <Row label="Food decay" hint="Hunger drains over time.">
                <Toggle on={merged.foodDecay} onClick={() => patch({ foodDecay: !merged.foodDecay })} label="Food decay" />
              </Row>
              <Row label="Tool durability" hint="Tools wear out with use.">
                <Toggle on={merged.toolDurability} onClick={() => patch({ toolDurability: !merged.toolDurability })} label="Tool durability" />
              </Row>
            </>
          )}

          {tab === 'creative' && (
            <>
              <Row label="Unlimited creative" hint="Never run out of blocks in creative.">
                <Toggle on={merged.unlimitedCreative} onClick={() => patch({ unlimitedCreative: !merged.unlimitedCreative })} label="Unlimited creative" />
              </Row>
              <Row label="Flight" hint="Creative flight is enabled.">
                <Toggle on={merged.flightEnabled} onClick={() => patch({ flightEnabled: !merged.flightEnabled })} label="Flight" />
              </Row>
              <Row label="Fly speed" hint={`${merged.flySpeed.toFixed(1)}x`}>
                <input type="range" min={0} max={5} step={0.1} value={merged.flySpeed} onChange={(e) => patch({ flySpeed: Number(e.target.value) })} />
              </Row>
              <Row label="Building tools" hint="Extra build tools in the creative menu.">
                <Toggle on={merged.buildingTools} onClick={() => patch({ buildingTools: !merged.buildingTools })} label="Building tools" />
              </Row>
              <Row label="Instant build" hint="Place and mine instantly.">
                <Toggle on={merged.instantBuild} onClick={() => patch({ instantBuild: !merged.instantBuild })} label="Instant build" />
              </Row>
              <Row label="Place on leaves" hint="Blocks can be placed on leaf surfaces.">
                <Toggle on={merged.placeOnLeaves} onClick={() => patch({ placeOnLeaves: !merged.placeOnLeaves })} label="Place on leaves" />
              </Row>
              <Row label="Replace mode" hint="Placing replaces existing blocks directly.">
                <Toggle on={merged.replaceMode} onClick={() => patch({ replaceMode: !merged.replaceMode })} label="Replace mode" />
              </Row>
              <Row label="Schematic tools" hint="Copy/paste schematic building tools.">
                <Toggle on={merged.schematicTools} onClick={() => patch({ schematicTools: !merged.schematicTools })} label="Schematic tools" />
              </Row>
              <Row label="Creative menu" hint="The full tabbed creative block menu.">
                <Toggle on={merged.creativeMenu} onClick={() => patch({ creativeMenu: !merged.creativeMenu })} label="Creative menu" />
              </Row>
            </>
          )}

          {tab === 'perf' && (
            <>
              <Row label="Render distance boost" hint={`+${merged.renderDistanceBoost} chunks`}>
                <input type="range" min={0} max={20} step={1} value={merged.renderDistanceBoost} onChange={(e) => patch({ renderDistanceBoost: Number(e.target.value) })} />
              </Row>
              <Row label="Effect tier" hint="Master quality for post-processing.">
                <select className="ui-input" value={merged.effectTier} onChange={(e) => patch({ effectTier: e.target.value as SuperSettings['effectTier'] })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="ultra">Ultra</option>
                </select>
              </Row>
              <Row label="VSync">
                <Toggle on={merged.vSync} onClick={() => patch({ vSync: !merged.vSync })} label="VSync" />
              </Row>
              <Row label="Antialiasing">
                <Toggle on={merged.antialiasing} onClick={() => patch({ antialiasing: !merged.antialiasing })} label="Antialiasing" />
              </Row>
              <Row label="Shadows">
                <Toggle on={merged.shadows} onClick={() => patch({ shadows: !merged.shadows })} label="Shadows" />
              </Row>
              <Row label="Reflections">
                <Toggle on={merged.reflections} onClick={() => patch({ reflections: !merged.reflections })} label="Reflections" />
              </Row>
              <Row label="SSAO">
                <Toggle on={merged.ssao} onClick={() => patch({ ssao: !merged.ssao })} label="SSAO" />
              </Row>
              <Row label="Bloom">
                <Toggle on={merged.bloom} onClick={() => patch({ bloom: !merged.bloom })} label="Bloom" />
              </Row>
              <Row label="Motion blur">
                <Toggle on={merged.motionBlur} onClick={() => patch({ motionBlur: !merged.motionBlur })} label="Motion blur" />
              </Row>
            </>
          )}

          {tab === 'ui' && (
            <>
              <Row label="HUD opacity" hint={`${Math.round(merged.hudOpacity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.hudOpacity} onChange={(e) => patch({ hudOpacity: Number(e.target.value) })} />
              </Row>
              <Row label="Hotbar scale" hint={`${merged.hotbarScale.toFixed(2)}x`}>
                <input type="range" min={0.5} max={2} step={0.05} value={merged.hotbarScale} onChange={(e) => patch({ hotbarScale: Number(e.target.value) })} />
              </Row>
              <Row label="Chat size" hint={`${merged.chatSize.toFixed(2)}x`}>
                <input type="range" min={0.5} max={2} step={0.05} value={merged.chatSize} onChange={(e) => patch({ chatSize: Number(e.target.value) })} />
              </Row>
              <Row label="Show coordinates" hint="Display XYZ in the HUD.">
                <Toggle on={merged.showCoordinates} onClick={() => patch({ showCoordinates: !merged.showCoordinates })} label="Show coordinates" />
              </Row>
              <Row label="Show day count">
                <Toggle on={merged.showDayCount} onClick={() => patch({ showDayCount: !merged.showDayCount })} label="Show day count" />
              </Row>
              <Row label="Show compass">
                <Toggle on={merged.showCompass} onClick={() => patch({ showCompass: !merged.showCompass })} label="Show compass" />
              </Row>
              <Row label="Show minimap">
                <Toggle on={merged.showMinimap} onClick={() => patch({ showMinimap: !merged.showMinimap })} label="Show minimap" />
              </Row>
              <Row label="Pixel font" hint="Use the blocky voxel font for UI.">
                <Toggle on={merged.pixelFont} onClick={() => patch({ pixelFont: !merged.pixelFont })} label="Pixel font" />
              </Row>
            </>
          )}

          {tab === 'misc' && (
            <>
              <Row label="Cheats enabled">
                <Toggle on={merged.cheatsEnabled} onClick={() => patch({ cheatsEnabled: !merged.cheatsEnabled })} label="Cheats enabled" />
              </Row>
              <Row label="Hardcore mode" hint="Permadeath — one life.">
                <Toggle on={merged.hardcoreMode} onClick={() => patch({ hardcoreMode: !merged.hardcoreMode })} label="Hardcore mode" />
              </Row>
              <Row label="Keep inventory" hint="Don't drop items on death.">
                <Toggle on={merged.keepInventory} onClick={() => patch({ keepInventory: !merged.keepInventory })} label="Keep inventory" />
              </Row>
              <Row label="Fire spread" hint="Fire spreads between blocks.">
                <Toggle on={merged.doFireTick} onClick={() => patch({ doFireTick: !merged.doFireTick })} label="Fire spread" />
              </Row>
              <Row label="Mob loot" hint="Mobs drop items when killed.">
                <Toggle on={merged.doMobLoot} onClick={() => patch({ doMobLoot: !merged.doMobLoot })} label="Mob loot" />
              </Row>
              <Row label="Daylight cycle" hint="The sun and moon move.">
                <Toggle on={merged.doDaylightCycle} onClick={() => patch({ doDaylightCycle: !merged.doDaylightCycle })} label="Daylight cycle" />
              </Row>
            </>
          )}

          {tab === 'lighting' && (
            <>
              <Row label="Coloured lighting" hint="Tint every light source by its block colour.">
                <Toggle on={merged.coloredLighting} onClick={() => patch({ coloredLighting: !merged.coloredLighting })} label="Coloured lighting" />
              </Row>
              <Row label="Light mixing" hint="Blend when two coloured lights overlap.">
                <Toggle on={merged.lightMixing} onClick={() => patch({ lightMixing: !merged.lightMixing })} label="Light mixing" />
              </Row>
              <Row label="God rays" hint={`${Math.round(merged.godRays * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.godRays} onChange={(e) => patch({ godRays: Number(e.target.value) })} />
              </Row>
              <Row label="Glass refraction" hint="Light bends through glass & glow glass.">
                <Toggle on={merged.glassRefraction} onClick={() => patch({ glassRefraction: !merged.glassRefraction })} label="Glass refraction" />
              </Row>
              <Row label="Glow glass intensity" hint={`${Math.round(merged.glowGlassIntensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.glowGlassIntensity} onChange={(e) => patch({ glowGlassIntensity: Number(e.target.value) })} />
              </Row>
            </>
          )}

          {tab === 'world' && (
            <>
              <Row label="Sky tint" hint="Hex colour overlay on the sky.">
                <input type="color" value={merged.skyTint === '#000000' ? '#000000' : merged.skyTint} onChange={(e) => patch({ skyTint: e.target.value })} />
              </Row>
              <Row label="Fog tint">
                <input type="color" value={merged.fogTint} onChange={(e) => patch({ fogTint: e.target.value })} />
              </Row>
              <Row label="Day tint">
                <input type="color" value={merged.dayTint} onChange={(e) => patch({ dayTint: e.target.value })} />
              </Row>
              <Row label="Night tint">
                <input type="color" value={merged.nightTint} onChange={(e) => patch({ nightTint: e.target.value })} />
              </Row>
            </>
          )}

          {tab === 'camera' && (
            <>
              <Row label="Camera mode" hint="Snap a photo or record a video of the world.">
                <span style={{ display: 'flex', gap: 8 }}>
                  <button className="super-btn" onClick={() => onCapture?.('photo')}>📷 Photo</button>
                  <button className="super-btn" onClick={() => onCapture?.('video')}>🎥 Video</button>
                </span>
              </Row>
              <Row label="Capture resolution">
                <select className="ui-input" value={merged.captureResolution} onChange={(e) => patch({ captureResolution: e.target.value as '720' | '1080' })}>
                  <option value="720">720p</option>
                  <option value="1080">1080p</option>
                </select>
              </Row>
            </>
          )}

          {tab === 'rt' && (
            <>
              <Row label="Hardware ray tracing" hint="Experimental, OFF by default — requires a capable GPU.">
                <Toggle on={merged.hardwareRayTracing} onClick={() => patch({ hardwareRayTracing: !merged.hardwareRayTracing })} label="Hardware ray tracing" />
              </Row>
            </>
          )}

          {tab === 'god' && (
            <GodModePanel />
          )}

          {tab === 'debug' && (
            <>
              <Row label="Show chunk borders">
                <Toggle on={merged.showChunkBorders} onClick={() => patch({ showChunkBorders: !merged.showChunkBorders })} label="Show chunk borders" />
              </Row>
              <Row label="Wireframe mode">
                <Toggle on={merged.showWireframe} onClick={() => patch({ showWireframe: !merged.showWireframe })} label="Wireframe" />
              </Row>
              <Row label="Dev god mode">
                <Toggle on={merged.devGodMode} onClick={() => patch({ devGodMode: !merged.devGodMode })} label="God mode" />
              </Row>
              <Row label="Dev no-clip">
                <Toggle on={merged.devNoClip} onClick={() => patch({ devNoClip: !merged.devNoClip })} label="No clip" />
              </Row>
            </>
          )}

          {tab === 'mods' && (
            <>
              <Row label="Mod rebuilder" hint="Rebuild & preview a mod from inside the game.">
                <Toggle on={merged.modRebuilder} onClick={() => patch({ modRebuilder: !merged.modRebuilder })} label="Mod rebuilder" />
              </Row>
              <Row label="In-game world editor" hint="Open the block-by-block world editor.">
                <Toggle on={merged.worldEditor} onClick={() => patch({ worldEditor: !merged.worldEditor })} label="World editor" />
              </Row>
              <div className="super-actions">
                <button className="super-btn" onClick={onOpenModEditor}>Open Mod Editor</button>
                <button className="super-btn" onClick={onOpenWorldEditor}>Open World Editor</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * GodModePanel — the "God Mode" tab in Super Settings.
 *
 * Only available once the ARG is complete (God Mode unlocked). Lets you enable
 * God Mode and toggle its powers: super edit, god flight, no damage, instant
 * build and unlimited inventory. When locked it explains how to unlock it.
 */
function GodModePanel() {
  const [god, setGod] = useState(getGodMode().get());
  const refresh = () => setGod(getGodMode().get());

  if (!god.unlocked) {
    return (
      <div className="god-locked">
        <div className="god-locked-title">👑 God Mode is LOCKED</div>
        <p className="god-locked-desc">
          Complete the ARG to unlock God Mode — the gift of the Cosmic Girl.
          Enter the Singularity, collect all {5} fragments across the dimensions,
          zoom through the black hole, and enter the key at the monitor.
        </p>
        <p className="god-locked-key">The key: <b>EAOIN</b></p>
      </div>
    );
  }

  const set = (key: 'superEdit' | 'godFlight' | 'noDamage' | 'instantBuild' | 'unlimitedInventory', v: boolean) => {
    getGodMode().set(key, v);
    refresh();
  };

  return (
    <>
      <Row label="God Mode" hint="The gift of a lifetime — customize everything at once.">
        <Toggle on={god.active} onClick={() => { getGodMode().toggleActive(); refresh(); }} label="God Mode" />
      </Row>
      {god.active && (
        <>
          <Row label="Super Edit" hint="Edit every block freely.">
            <Toggle on={god.superEdit} onClick={() => set('superEdit', !god.superEdit)} label="Super edit" />
          </Row>
          <Row label="God Flight" hint="Fly anywhere, no limits.">
            <Toggle on={god.godFlight} onClick={() => set('godFlight', !god.godFlight)} label="God flight" />
          </Row>
          <Row label="No Damage" hint="Invulnerable to everything.">
            <Toggle on={god.noDamage} onClick={() => set('noDamage', !god.noDamage)} label="No damage" />
          </Row>
          <Row label="Instant Build" hint="Place and mine instantly.">
            <Toggle on={god.instantBuild} onClick={() => set('instantBuild', !god.instantBuild)} label="Instant build" />
          </Row>
          <Row label="Unlimited Inventory" hint="Every block, endless.">
            <Toggle on={god.unlimitedInventory} onClick={() => set('unlimitedInventory', !god.unlimitedInventory)} label="Unlimited inventory" />
          </Row>
        </>
      )}
    </>
  );
}
