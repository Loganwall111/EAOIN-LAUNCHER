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

type Tab = 'sky' | 'world' | 'worldgen' | 'lighting' | 'textures' | 'fx' | 'audio' | 'gameplay' | 'creative' | 'perf' | 'ui' | 'controls' | 'multiplayer' | 'modding' | 'mobs' | 'physics' | 'farming' | 'difficulty' | 'weather' | 'qol' | 'misc' | 'camera' | 'rt' | 'god' | 'debug' | 'mods';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'sky', label: 'Sky', icon: '🌌' },
  { id: 'world', label: 'World', icon: '🌍' },
  { id: 'worldgen', label: 'World Gen & Biomes', icon: '⛰️' },
  { id: 'lighting', label: 'Lighting', icon: '💡' },
  { id: 'textures', label: 'Textures & Blocks', icon: '🧱' },
  { id: 'fx', label: 'Particles & FX', icon: '✨' },
  { id: 'audio', label: 'Audio', icon: '🔊' },
  { id: 'gameplay', label: 'Gameplay', icon: '🎮' },
  { id: 'creative', label: 'Creative & Build', icon: '🏗️' },
  { id: 'perf', label: 'Performance', icon: '⚡' },
  { id: 'ui', label: 'UI', icon: '🖥️' },
  { id: 'controls', label: 'Controls', icon: '🎮' },
  { id: 'multiplayer', label: 'Multiplayer', icon: '🌐' },
  { id: 'modding', label: 'Modding', icon: '🧩' },
  { id: 'mobs', label: 'Mobs & Entities', icon: '🐺' },
  { id: 'physics', label: 'Physics', icon: '⚖️' },
  { id: 'farming', label: 'Farming & Plants', icon: '🌾' },
  { id: 'difficulty', label: 'Difficulty', icon: '⚔️' },
  { id: 'weather', label: 'Weather & Seasons', icon: '🌦️' },
  { id: 'qol', label: 'Quality of Life', icon: '💫' },
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
          {tab === 'textures' && (
            <>
              <Row label="Texture pack" hint="Overall block/terrain art style.">
                <select className="ui-input" value={merged.texturePack} onChange={(e) => patch({ texturePack: e.target.value as SuperSettings['texturePack'] })}>
                  <option value="classic">Classic</option>
                  <option value="soft">Soft</option>
                  <option value="vibrant">Vibrant</option>
                  <option value="noir">Noir</option>
                </select>
              </Row>
              <Row label="Block detail" hint={`${Math.round(merged.blockDetail * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.blockDetail} onChange={(e) => patch({ blockDetail: Number(e.target.value) })} />
              </Row>
              <Row label="Smooth lighting" hint="Blend light across block faces.">
                <Toggle on={merged.smoothLighting} onClick={() => patch({ smoothLighting: !merged.smoothLighting })} label="Smooth lighting" />
              </Row>
              <Row label="Mipmap textures" hint="Sharper distant textures (small memory cost).">
                <Toggle on={merged.mipmapTextures} onClick={() => patch({ mipmapTextures: !merged.mipmapTextures })} label="Mipmap textures" />
              </Row>
              <Row label="Water opacity" hint={`${Math.round(merged.waterOpacity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.waterOpacity} onChange={(e) => patch({ waterOpacity: Number(e.target.value) })} />
              </Row>
              <Row label="Water colour">
                <input type="color" value={merged.waterColor} onChange={(e) => patch({ waterColor: e.target.value })} />
              </Row>
              <Row label="Lava colour">
                <input type="color" value={merged.lavaColor} onChange={(e) => patch({ lavaColor: e.target.value })} />
              </Row>
              <Row label="Glass opacity" hint={`${Math.round(merged.glassOpacity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.glassOpacity} onChange={(e) => patch({ glassOpacity: Number(e.target.value) })} />
              </Row>
            </>
          )}

          {tab === 'controls' && (
            <>
              <Row label="Mouse sensitivity" hint={`${merged.mouseSensitivity.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.mouseSensitivity} onChange={(e) => patch({ mouseSensitivity: Number(e.target.value) })} />
              </Row>
              <Row label="Invert Y" hint="Look up when you move the mouse down.">
                <Toggle on={merged.invertY} onClick={() => patch({ invertY: !merged.invertY })} label="Invert Y" />
              </Row>
              <Row label="Invert X" hint="Look left when you move the mouse right.">
                <Toggle on={merged.invertX} onClick={() => patch({ invertX: !merged.invertX })} label="Invert X" />
              </Row>
              <Row label="Auto-jump" hint="Jump automatically when you hit a block.">
                <Toggle on={merged.autoJump} onClick={() => patch({ autoJump: !merged.autoJump })} label="Auto-jump" />
              </Row>
              <Row label="Sneak toggle" hint="Sneak stays on until you press it again.">
                <Toggle on={merged.sneakToggle} onClick={() => patch({ sneakToggle: !merged.sneakToggle })} label="Sneak toggle" />
              </Row>
              <Row label="Sprint toggle" hint="Sprint stays on until you press it again.">
                <Toggle on={merged.sprintToggle} onClick={() => patch({ sprintToggle: !merged.sprintToggle })} label="Sprint toggle" />
              </Row>
            </>
          )}

          {tab === 'multiplayer' && (
            <>
              <Row label="Multiplayer" hint="Master switch for servers, guilds and nations.">
                <Toggle on={merged.multiplayerEnabled} onClick={() => patch({ multiplayerEnabled: !merged.multiplayerEnabled })} label="Multiplayer" />
              </Row>
              <Row label="Server browser" hint="Show the official server list.">
                <Toggle on={merged.serverList} onClick={() => patch({ serverList: !merged.serverList })} label="Server browser" />
              </Row>
              <Row label="Voice chat" hint="Proximity voice chat on servers.">
                <Toggle on={merged.voiceChat} onClick={() => patch({ voiceChat: !merged.voiceChat })} label="Voice chat" />
              </Row>
              <Row label="Show player names" hint="Show name tags above players.">
                <Toggle on={merged.showPlayerNames} onClick={() => patch({ showPlayerNames: !merged.showPlayerNames })} label="Show player names" />
              </Row>
              <Row label="PvP" hint="Players can damage each other.">
                <Toggle on={merged.pvp} onClick={() => patch({ pvp: !merged.pvp })} label="PvP" />
              </Row>
            </>
          )}

          {tab === 'modding' && (
            <>
              <Row label="Modding" hint="Master switch for loading mods.">
                <Toggle on={merged.moddingEnabled} onClick={() => patch({ moddingEnabled: !merged.moddingEnabled })} label="Modding" />
              </Row>
              <Row label="Resource packs" hint="Custom textures and models.">
                <Toggle on={merged.resourcePacks} onClick={() => patch({ resourcePacks: !merged.resourcePacks })} label="Resource packs" />
              </Row>
              <Row label="Data packs" hint="Custom recipes, loot and world rules.">
                <Toggle on={merged.dataPacks} onClick={() => patch({ dataPacks: !merged.dataPacks })} label="Data packs" />
              </Row>
              <Row label="Shader packs" hint="Custom shader presets.">
                <Toggle on={merged.shaderPacks} onClick={() => patch({ shaderPacks: !merged.shaderPacks })} label="Shader packs" />
              </Row>
              <Row label="Auto-mod update" hint="Check for mod updates automatically.">
                <Toggle on={merged.autoModUpdate} onClick={() => patch({ autoModUpdate: !merged.autoModUpdate })} label="Auto-mod update" />
              </Row>
            </>
          )}

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

          {tab === 'worldgen' && (
            <>
              <Row label="Terrain height" hint={`${merged.terrainHeight.toFixed(2)}x`}>
                <input type="range" min={0} max={2} step={0.05} value={merged.terrainHeight} onChange={(e) => patch({ terrainHeight: Number(e.target.value) })} />
              </Row>
              <Row label="Biome size" hint={`${merged.biomeSize.toFixed(2)}x`}>
                <input type="range" min={0} max={2} step={0.05} value={merged.biomeSize} onChange={(e) => patch({ biomeSize: Number(e.target.value) })} />
              </Row>
              <Row label="Caves" hint="Generate underground caverns.">
                <Toggle on={merged.cavesEnabled} onClick={() => patch({ cavesEnabled: !merged.cavesEnabled })} label="Caves" />
              </Row>
              <Row label="Cave size" hint={`${merged.caveSize.toFixed(2)}x`}>
                <input type="range" min={0} max={2} step={0.05} value={merged.caveSize} onChange={(e) => patch({ caveSize: Number(e.target.value) })} />
              </Row>
              <Row label="Trees" hint="Generate trees in forests.">
                <Toggle on={merged.treesEnabled} onClick={() => patch({ treesEnabled: !merged.treesEnabled })} label="Trees" />
              </Row>
              <Row label="Tree density" hint={`${Math.round(merged.treeDensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.treeDensity} onChange={(e) => patch({ treeDensity: Number(e.target.value) })} />
              </Row>
              <Row label="Ore density" hint={`${Math.round(merged.oreDensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.oreDensity} onChange={(e) => patch({ oreDensity: Number(e.target.value) })} />
              </Row>
              <Row label="Rare ores" hint="Diamonds, emeralds, ancient debris.">
                <Toggle on={merged.rareOres} onClick={() => patch({ rareOres: !merged.rareOres })} label="Rare ores" />
              </Row>
              <Row label="Villages" hint="Generate villages and settlements.">
                <Toggle on={merged.villagesEnabled} onClick={() => patch({ villagesEnabled: !merged.villagesEnabled })} label="Villages" />
              </Row>
              <Row label="Strongholds" hint="Generate strongholds underground.">
                <Toggle on={merged.strongholdsEnabled} onClick={() => patch({ strongholdsEnabled: !merged.strongholdsEnabled })} label="Strongholds" />
              </Row>
              <Row label="Floating islands" hint="Scatter floating islands in the sky.">
                <Toggle on={merged.floatingIslands} onClick={() => patch({ floatingIslands: !merged.floatingIslands })} label="Floating islands" />
              </Row>
              <Row label="Ocean size" hint={`${merged.oceanSize.toFixed(2)}x`}>
                <input type="range" min={0} max={2} step={0.05} value={merged.oceanSize} onChange={(e) => patch({ oceanSize: Number(e.target.value) })} />
              </Row>
              <Row label="Lava lakes" hint="Lava pools in the underground.">
                <Toggle on={merged.lavaLakes} onClick={() => patch({ lavaLakes: !merged.lavaLakes })} label="Lava lakes" />
              </Row>
              <Row label="Water lakes" hint="Surface water pools.">
                <Toggle on={merged.waterLakes} onClick={() => patch({ waterLakes: !merged.waterLakes })} label="Water lakes" />
              </Row>
              <Row label="Erosion" hint={`${Math.round(merged.erosion * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.erosion} onChange={(e) => patch({ erosion: Number(e.target.value) })} />
              </Row>
            </>
          )}

          {tab === 'mobs' && (
            <>
              <Row label="Mob cap" hint={`${merged.mobCap} mobs`}>
                <input type="range" min={0} max={200} step={5} value={merged.mobCap} onChange={(e) => patch({ mobCap: Number(e.target.value) })} />
              </Row>
              <Row label="Mob spawn rate" hint={`${merged.mobSpawnRate.toFixed(2)}x`}>
                <input type="range" min={0} max={2} step={0.05} value={merged.mobSpawnRate} onChange={(e) => patch({ mobSpawnRate: Number(e.target.value) })} />
              </Row>
              <Row label="Mob taming" hint="Tame dogs, cats and more.">
                <Toggle on={merged.mobTaming} onClick={() => patch({ mobTaming: !merged.mobTaming })} label="Mob taming" />
              </Row>
              <Row label="Mob breeding">
                <Toggle on={merged.mobBreeding} onClick={() => patch({ mobBreeding: !merged.mobBreeding })} label="Mob breeding" />
              </Row>
              <Row label="Mob griefing" hint="Mobs can alter the world.">
                <Toggle on={merged.mobGriefing} onClick={() => patch({ mobGriefing: !merged.mobGriefing })} label="Mob griefing" />
              </Row>
              <Row label="Creeper explosions">
                <Toggle on={merged.creeperExplosions} onClick={() => patch({ creeperExplosions: !merged.creeperExplosions })} label="Creeper explosions" />
              </Row>
              <Row label="Enderman griefing">
                <Toggle on={merged.endermanGriefing} onClick={() => patch({ endermanGriefing: !merged.endermanGriefing })} label="Enderman griefing" />
              </Row>
              <Row label="Zombie hordes">
                <Toggle on={merged.zombieHordes} onClick={() => patch({ zombieHordes: !merged.zombieHordes })} label="Zombie hordes" />
              </Row>
              <Row label="Animal density" hint={`${Math.round(merged.animalDensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.animalDensity} onChange={(e) => patch({ animalDensity: Number(e.target.value) })} />
              </Row>
              <Row label="Villager trading">
                <Toggle on={merged.villagerTrading} onClick={() => patch({ villagerTrading: !merged.villagerTrading })} label="Villager trading" />
              </Row>
              <Row label="Boss mobs" hint="Enable boss encounters.">
                <Toggle on={merged.bossMobs} onClick={() => patch({ bossMobs: !merged.bossMobs })} label="Boss mobs" />
              </Row>
              <Row label="Passive mobs spawn">
                <Toggle on={merged.passiveMobsSpawn} onClick={() => patch({ passiveMobsSpawn: !merged.passiveMobsSpawn })} label="Passive mobs spawn" />
              </Row>
              <Row label="Flying mobs">
                <Toggle on={merged.flyingMobs} onClick={() => patch({ flyingMobs: !merged.flyingMobs })} label="Flying mobs" />
              </Row>
              <Row label="Water mobs">
                <Toggle on={merged.waterMobs} onClick={() => patch({ waterMobs: !merged.waterMobs })} label="Water mobs" />
              </Row>
            </>
          )}

          {tab === 'physics' && (
            <>
              <Row label="Water physics">
                <Toggle on={merged.waterPhysics} onClick={() => patch({ waterPhysics: !merged.waterPhysics })} label="Water physics" />
              </Row>
              <Row label="Lava physics">
                <Toggle on={merged.lavaPhysics} onClick={() => patch({ lavaPhysics: !merged.lavaPhysics })} label="Lava physics" />
              </Row>
              <Row label="Falling sand" hint="Sand and gravel obey gravity.">
                <Toggle on={merged.sandFalling} onClick={() => patch({ sandFalling: !merged.sandFalling })} label="Falling sand" />
              </Row>
              <Row label="Falling gravel">
                <Toggle on={merged.gravelFalling} onClick={() => patch({ gravelFalling: !merged.gravelFalling })} label="Falling gravel" />
              </Row>
              <Row label="Fluid flow speed" hint={`${merged.fluidFlowSpeed.toFixed(2)}x`}>
                <input type="range" min={0} max={2} step={0.05} value={merged.fluidFlowSpeed} onChange={(e) => patch({ fluidFlowSpeed: Number(e.target.value) })} />
              </Row>
              <Row label="Knockback" hint={`${merged.knockback.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.knockback} onChange={(e) => patch({ knockback: Number(e.target.value) })} />
              </Row>
              <Row label="Fall damage">
                <Toggle on={merged.fallDamage} onClick={() => patch({ fallDamage: !merged.fallDamage })} label="Fall damage" />
              </Row>
              <Row label="Drown damage">
                <Toggle on={merged.drownDamage} onClick={() => patch({ drownDamage: !merged.drownDamage })} label="Drown damage" />
              </Row>
              <Row label="Fire damage">
                <Toggle on={merged.fireDamage} onClick={() => patch({ fireDamage: !merged.fireDamage })} label="Fire damage" />
              </Row>
              <Row label="Void damage">
                <Toggle on={merged.voidDamage} onClick={() => patch({ voidDamage: !merged.voidDamage })} label="Void damage" />
              </Row>
              <Row label="Explosion physics">
                <Toggle on={merged.explosionPhysics} onClick={() => patch({ explosionPhysics: !merged.explosionPhysics })} label="Explosion physics" />
              </Row>
              <Row label="Collision precision" hint={`${Math.round(merged.collisionPrecision * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.collisionPrecision} onChange={(e) => patch({ collisionPrecision: Number(e.target.value) })} />
              </Row>
              <Row label="Swim speed" hint={`${merged.swimSpeed.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.swimSpeed} onChange={(e) => patch({ swimSpeed: Number(e.target.value) })} />
              </Row>
            </>
          )}

          {tab === 'farming' && (
            <>
              <Row label="Crop growth speed" hint={`${merged.cropGrowthSpeed.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.cropGrowthSpeed} onChange={(e) => patch({ cropGrowthSpeed: Number(e.target.value) })} />
              </Row>
              <Row label="Plant density" hint={`${Math.round(merged.plantDensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={merged.plantDensity} onChange={(e) => patch({ plantDensity: Number(e.target.value) })} />
              </Row>
              <Row label="Saplings grow" hint="Saplings turn into trees.">
                <Toggle on={merged.saplingsGrow} onClick={() => patch({ saplingsGrow: !merged.saplingsGrow })} label="Saplings grow" />
              </Row>
              <Row label="Bonemeal" hint="Bonemeal accelerates growth.">
                <Toggle on={merged.bonemeal} onClick={() => patch({ bonemeal: !merged.bonemeal })} label="Bonemeal" />
              </Row>
              <Row label="Farming" hint="Tilling, crops and harvests.">
                <Toggle on={merged.farmingEnabled} onClick={() => patch({ farmingEnabled: !merged.farmingEnabled })} label="Farming" />
              </Row>
              <Row label="Hunger decay" hint={`${merged.hungerDecay.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.hungerDecay} onChange={(e) => patch({ hungerDecay: Number(e.target.value) })} />
              </Row>
              <Row label="Food heals">
                <Toggle on={merged.foodHeal} onClick={() => patch({ foodHeal: !merged.foodHeal })} label="Food heals" />
              </Row>
            </>
          )}

          {tab === 'difficulty' && (
            <>
              <Row label="Difficulty">
                <select className="ui-input" value={merged.difficulty} onChange={(e) => patch({ difficulty: e.target.value as SuperSettings['difficulty'] })}>
                  <option value="peaceful">Peaceful</option>
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </Row>
              <Row label="Mob damage" hint={`${merged.mobDamage.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.mobDamage} onChange={(e) => patch({ mobDamage: Number(e.target.value) })} />
              </Row>
              <Row label="Mob health" hint={`${merged.mobHealth.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.mobHealth} onChange={(e) => patch({ mobHealth: Number(e.target.value) })} />
              </Row>
              <Row label="Regeneration" hint="Health regenerates over time.">
                <Toggle on={merged.regeneration} onClick={() => patch({ regeneration: !merged.regeneration })} label="Regeneration" />
              </Row>
              <Row label="Natural regen">
                <Toggle on={merged.naturalRegen} onClick={() => patch({ naturalRegen: !merged.naturalRegen })} label="Natural regen" />
              </Row>
              <Row label="Regen speed" hint={`${merged.regenSpeed.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.regenSpeed} onChange={(e) => patch({ regenSpeed: Number(e.target.value) })} />
              </Row>
              <Row label="Death loot" hint="Drops items on death.">
                <Toggle on={merged.deathLoot} onClick={() => patch({ deathLoot: !merged.deathLoot })} label="Death loot" />
              </Row>
              <Row label="Keep inventory on death">
                <Toggle on={merged.keepInventoryOnDeath} onClick={() => patch({ keepInventoryOnDeath: !merged.keepInventoryOnDeath })} label="Keep inventory on death" />
              </Row>
              <Row label="Show death message">
                <Toggle on={merged.showDeathMessage} onClick={() => patch({ showDeathMessage: !merged.showDeathMessage })} label="Show death message" />
              </Row>
              <Row label="Respawn radius" hint={`${merged.respawnRadius} blocks`}>
                <input type="range" min={0} max={20} step={1} value={merged.respawnRadius} onChange={(e) => patch({ respawnRadius: Number(e.target.value) })} />
              </Row>
            </>
          )}

          {tab === 'weather' && (
            <>
              <Row label="Seasons" hint="Seasons change leaf colours and weather.">
                <Toggle on={merged.seasons} onClick={() => patch({ seasons: !merged.seasons })} label="Seasons" />
              </Row>
              <Row label="Rain">
                <Toggle on={merged.rainEnabled} onClick={() => patch({ rainEnabled: !merged.rainEnabled })} label="Rain" />
              </Row>
              <Row label="Snow">
                <Toggle on={merged.snowEnabled} onClick={() => patch({ snowEnabled: !merged.snowEnabled })} label="Snow" />
              </Row>
              <Row label="Thunder">
                <Toggle on={merged.thunderEnabled} onClick={() => patch({ thunderEnabled: !merged.thunderEnabled })} label="Thunder" />
              </Row>
              <Row label="Seasonal leaf colour">
                <Toggle on={merged.seasonalLeafColor} onClick={() => patch({ seasonalLeafColor: !merged.seasonalLeafColor })} label="Seasonal leaf colour" />
              </Row>
              <Row label="Day/night cycle">
                <Toggle on={merged.dayNightCycle} onClick={() => patch({ dayNightCycle: !merged.dayNightCycle })} label="Day/night cycle" />
              </Row>
            </>
          )}

          {tab === 'qol' && (
            <>
              <Row label="Show coordinates" hint="Display XYZ in the HUD.">
                <Toggle on={merged.coordinates} onClick={() => patch({ coordinates: !merged.coordinates })} label="Show coordinates" />
              </Row>
              <Row label="Field of view" hint={`${merged.fovSlider.toFixed(2)}x`}>
                <input type="range" min={0} max={2} step={0.05} value={merged.fovSlider} onChange={(e) => patch({ fovSlider: Number(e.target.value) })} />
              </Row>
              <Row label="FOV bobbing">
                <Toggle on={merged.fovBobbing} onClick={() => patch({ fovBobbing: !merged.fovBobbing })} label="FOV bobbing" />
              </Row>
              <Row label="Auto-save interval" hint={`every ${merged.autoSaveInterval}s`}>
                <input type="range" min={30} max={600} step={10} value={merged.autoSaveInterval} onChange={(e) => patch({ autoSaveInterval: Number(e.target.value) })} />
              </Row>
              <Row label="Show tips">
                <Toggle on={merged.showTips} onClick={() => patch({ showTips: !merged.showTips })} label="Show tips" />
              </Row>
              <Row label="Tooltips">
                <Toggle on={merged.tooltips} onClick={() => patch({ tooltips: !merged.tooltips })} label="Tooltips" />
              </Row>
              <Row label="Item drops">
                <Toggle on={merged.itemDrops} onClick={() => patch({ itemDrops: !merged.itemDrops })} label="Item drops" />
              </Row>
              <Row label="Experience orbs">
                <Toggle on={merged.experienceOrbs} onClick={() => patch({ experienceOrbs: !merged.experienceOrbs })} label="Experience orbs" />
              </Row>
              <Row label="Death tint" hint="Red flash when you take damage / die.">
                <Toggle on={merged.deathTint} onClick={() => patch({ deathTint: !merged.deathTint })} label="Death tint" />
              </Row>
              <Row label="Damage flash">
                <Toggle on={merged.damageFlash} onClick={() => patch({ damageFlash: !merged.damageFlash })} label="Damage flash" />
              </Row>
              <Row label="Hitmarkers">
                <Toggle on={merged.hitmarkers} onClick={() => patch({ hitmarkers: !merged.hitmarkers })} label="Hitmarkers" />
              </Row>
              <Row label="Redstone" hint="Enable redstone circuitry.">
                <Toggle on={merged.redstone} onClick={() => patch({ redstone: !merged.redstone })} label="Redstone" />
              </Row>
              <Row label="Hopper speed" hint={`${merged.hopperSpeed.toFixed(2)}x`}>
                <input type="range" min={0} max={3} step={0.05} value={merged.hopperSpeed} onChange={(e) => patch({ hopperSpeed: Number(e.target.value) })} />
              </Row>
              <Row label="Command blocks in-game">
                <Toggle on={merged.commandBlocksInGame} onClick={() => patch({ commandBlocksInGame: !merged.commandBlocksInGame })} label="Command blocks in-game" />
              </Row>
              <Row label="Creative flight">
                <Toggle on={merged.creativeFlight} onClick={() => patch({ creativeFlight: !merged.creativeFlight })} label="Creative flight" />
              </Row>
              <Row label="Spectator mode">
                <Toggle on={merged.spectatorMode} onClick={() => patch({ spectatorMode: !merged.spectatorMode })} label="Spectator mode" />
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
