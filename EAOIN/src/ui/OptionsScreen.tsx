/**
 * OptionsScreen — themed settings screen driving the real GameSettings object.
 *
 * Every control writes through clampSettings, so the same validation the rest
 * of the game relies on applies here too.
 */
import { useCallback, useState, useSyncExternalStore } from 'react';
import { clampSettings, GameSettings, effectiveRenderDistance } from '../settings/GameSettings';
import { UI_ASSETS } from './theme';
import MenuScreen from './MenuScreen';
import { DeveloperControls, DeveloperGate } from './DeveloperAppPanel';
import { developerAccess } from '../dev/DeveloperAccess';
import { developerTuningStore } from '../dev/DeveloperTuning';

export interface OptionsScreenProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onBack: () => void;
  /** Open the deep "Super Settings" panel. */
  onOpenSuperSettings?: () => void;
}

type Section = 'video' | 'audio' | 'gameplay' | 'controls' | 'world' | 'accessibility' | 'info';

const SECTIONS: Array<{ id: Section; label: string; icon: string }> = [
  { id: 'video', label: 'Video', icon: '🖥' },
  { id: 'audio', label: 'Audio', icon: '🔊' },
  { id: 'gameplay', label: 'Gameplay', icon: '🎮' },
  { id: 'controls', label: 'Controls', icon: '🎮' },
  { id: 'world', label: 'World', icon: '🌍' },
  { id: 'accessibility', label: 'Accessibility', icon: '♿' },
  { id: 'info', label: 'Info & Help', icon: 'ℹ️' },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="opt-row">
      <div className="opt-label">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="opt-control">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={label}
    >
      <span />
    </button>
  );
}

export default function OptionsScreen({ settings, onChange, onBack, onOpenSuperSettings }: OptionsScreenProps) {
  const [section, setSection] = useState<Section>('video');
  const patch = (next: Partial<GameSettings>) => onChange(clampSettings({ ...settings, ...next }));

  // Developer Settings entrance at the bottom of Options.
  const devAccess = useSyncExternalStore(
    useCallback((listener) => developerAccess.subscribe(listener), []),
    useCallback(() => developerAccess.get(), [])
  );
  const devTuning = useSyncExternalStore(
    useCallback((listener) => developerTuningStore.subscribe(listener), []),
    useCallback(() => developerTuningStore.get(), [])
  );
  const openDevGate = () => {
    developerAccess.trigger(); // toggles panel if granted, else opens the lock gate
  };

  return (
    <MenuScreen
      title="Options"
      subtitle="Video, audio, gameplay and accessibility"
      backdrop={UI_ASSETS.bgOptions}
      onBack={onBack}
    >
      <div className="split-side">
        <nav className="ui-panel side-nav">
          {SECTIONS.map((entry) => (
            <button
              key={entry.id}
              className={`creator-tab ${section === entry.id ? 'active' : ''}`}
              onClick={() => setSection(entry.id)}
            >
              <span>{entry.icon}</span>{entry.label}
            </button>
          ))}
        </nav>

        <section className="ui-panel opt-pane">
          <div className="ui-panel-title">{SECTIONS.find((s) => s.id === section)?.label}</div>
          <div className="opt-list">
            {section === 'video' && (
              <>
                <Row label="Quality preset" hint={settings.extremeDistance ? `Render distance ${effectiveRenderDistance(settings)} chunks (Extreme)` : `Render distance ${effectiveRenderDistance(settings)} chunks`}>
                  <select className="ui-input" value={settings.qualityPreset} onChange={(e) => patch({ qualityPreset: e.target.value as GameSettings['qualityPreset'] })}>
                    <option value="performance">Performance</option>
                    <option value="balanced">Balanced</option>
                    <option value="quality">Quality</option>
                    <option value="cinematic">Cinematic</option>
                  </select>
                </Row>
                <Row
                  label="Extreme Distance"
                  hint={`Distant-Horizons style. Pushes render distance to ${effectiveRenderDistance({ qualityPreset: settings.qualityPreset, extremeDistance: true })} chunks so you can see mountains from anywhere. Heavy on performance — lowers resolution/effects automatically to keep the frame rate.`}
                >
                  <Toggle checked={settings.extremeDistance} onChange={(v) => patch({ extremeDistance: v })} label="Extreme Distance" />
                </Row>
                <Row label="Renderer" hint="Vulkan uses WebGPU, which is Vulkan-backed on Windows/Linux. Falls back to WebGL automatically.">
                  <select className="ui-input" value={settings.rendererPreference} onChange={(e) => patch({ rendererPreference: e.target.value as GameSettings['rendererPreference'] })}>
                    <option value="auto">Auto (recommended)</option>
                    <option value="vulkan">Vulkan / WebGPU</option>
                    <option value="webgpu">Prefer WebGPU</option>
                    <option value="webgl">Force WebGL</option>
                  </select>
                </Row>
                <Row
                  label="Adaptive performance"
                  hint="Automatically trades resolution, effects and view distance to hold your target framerate. The main fix for stutter."
                >
                  <Toggle checked={settings.adaptivePerformance} onChange={(v) => patch({ adaptivePerformance: v })} label="Adaptive performance" />
                </Row>
                <Row label="Target framerate" hint={`${settings.targetFps} FPS`}>
                  <input type="range" min={30} max={240} step={10} value={settings.targetFps} onChange={(e) => patch({ targetFps: Number(e.target.value) })} aria-label="Target framerate" />
                </Row>
                <Row
                  label="Render scale"
                  hint={settings.adaptivePerformance
                    ? 'Managed automatically while adaptive performance is on'
                    : `${Math.round(settings.renderScale * 100)}%`}
                >
                  <input type="range" min={0.5} max={1.5} step={0.1} value={settings.renderScale} disabled={settings.adaptivePerformance} onChange={(e) => patch({ renderScale: Number(e.target.value) })} aria-label="Render scale" />
                </Row>
                <Row
                  label="Greedy meshing"
                  hint="Merges flat voxel faces into large quads. Typically 60-85% fewer triangles."
                >
                  <Toggle checked={settings.greedyMeshing} onChange={(v) => patch({ greedyMeshing: v })} label="Greedy meshing" />
                </Row>
                <Row label="Performance overlay" hint="Live frame time, triangle count and graphics backend">
                  <Toggle checked={settings.showPerformanceOverlay} onChange={(v) => patch({ showPerformanceOverlay: v })} label="Performance overlay" />
                </Row>
                <Row label="Texture pack">
                  <select className="ui-input" value={settings.texturePack} onChange={(e) => patch({ texturePack: e.target.value as GameSettings['texturePack'] })}>
                    <option value="classic">Classic</option>
                    <option value="soft">Soft</option>
                    <option value="vibrant">Vibrant</option>
                    <option value="noir">Noir</option>
                  </select>
                </Row>
                <Row label="Fog" hint="Distance haze, 100–1000 blocks">
                  <Toggle checked={settings.fogEnabled} onChange={(v) => patch({ fogEnabled: v })} label="Fog" />
                </Row>
                <Row label="Post-processing" hint="Bloom, SSAO and colour grading">
                  <Toggle checked={settings.postProcessEnabled} onChange={(v) => patch({ postProcessEnabled: v })} label="Post-processing" />
                </Row>
                <Row label="Realistic lighting" hint="Soft shadows and richer ambient light">
                  <Toggle checked={settings.realisticLighting} onChange={(v) => patch({ realisticLighting: v })} label="Realistic lighting" />
                </Row>
                <Row label="Particles">
                  <Toggle checked={settings.particlesEnabled} onChange={(v) => patch({ particlesEnabled: v })} label="Particles" />
                </Row>

                <div className="opt-subhead">Screen-space ray tracing</div>
                <p className="opt-note">
                  Real per-pixel ray marching against the depth buffer. This is genuine ray
                  tracing, but <strong>screen-space</strong> — anything off-screen or behind the
                  camera cannot be reflected. Hardware ray tracing (DXR / Vulkan RT) needs a
                  ray-tracing pipeline that WebGPU does not expose; that lives in the native
                  Vulkan build.
                </p>
                <Row label="Ray tracing quality" hint="Off by default — it is genuinely expensive">
                  <select
                    className="ui-input"
                    value={settings.rayTracingQuality}
                    onChange={(e) => patch({ rayTracingQuality: e.target.value as GameSettings['rayTracingQuality'] })}
                  >
                    <option value="off">Off</option>
                    <option value="low">Low (12 steps)</option>
                    <option value="medium">Medium (24 steps)</option>
                    <option value="high">High (40 steps)</option>
                    <option value="ultra">Ultra (64 steps)</option>
                  </select>
                </Row>
                <Row label="RT reflections" hint="Traced reflections off water, ice and metal">
                  <Toggle checked={settings.rayTracedReflections} onChange={(v) => patch({ rayTracedReflections: v })} label="RT reflections" />
                </Row>
                <Row label="RT contact shadows" hint="Short shadow rays toward the sun">
                  <Toggle checked={settings.rayTracedShadows} onChange={(v) => patch({ rayTracedShadows: v })} label="RT contact shadows" />
                </Row>
                <Row label="RT ambient occlusion" hint="Hemisphere rays for contact darkening">
                  <Toggle checked={settings.rayTracedAO} onChange={(v) => patch({ rayTracedAO: v })} label="RT ambient occlusion" />
                </Row>
              </>
            )}

            {section === 'audio' && (
              <>
                <Row label="Master volume" hint={`${Math.round(settings.volume * 100)}%`}>
                  <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => patch({ volume: Number(e.target.value) })} aria-label="Master volume" />
                </Row>
                <Row label="Mute all audio">
                  <Toggle checked={settings.muted} onChange={(v) => patch({ muted: v })} label="Mute" />
                </Row>
              </>
            )}

            {section === 'gameplay' && (
              <>
                <Row label="Camera speed" hint={settings.cameraSpeed.toFixed(2)}>
                  <input type="range" min={0.2} max={3} step={0.05} value={settings.cameraSpeed} onChange={(e) => patch({ cameraSpeed: Number(e.target.value) })} aria-label="Camera speed" />
                </Row>
                <Row label="Show performance stats" hint="FPS, chunks, triangles">
                  <Toggle checked={settings.showStats} onChange={(v) => patch({ showStats: v })} label="Show stats" />
                </Row>
                <Row label="Show objectives">
                  <Toggle checked={settings.showObjectives} onChange={(v) => patch({ showObjectives: v })} label="Show objectives" />
                </Row>
                <Row label="Command blocks">
                  <Toggle checked={settings.commandBlocksEnabled} onChange={(v) => patch({ commandBlocksEnabled: v })} label="Command blocks" />
                </Row>
                <Row label="Multiplayer servers">
                  <Toggle checked={settings.multiplayerServersEnabled} onChange={(v) => patch({ multiplayerServersEnabled: v })} label="Multiplayer servers" />
                </Row>
                <Row label="Experimental shaders" hint="May reduce performance">
                  <Toggle checked={settings.experimentalShaders} onChange={(v) => patch({ experimentalShaders: v })} label="Experimental shaders" />
                </Row>
                <Row label="Experimental Vulkan mode" hint="WebGPU path with native bootstrap">
                  <Toggle checked={settings.experimentalVulkanMode} onChange={(v) => patch({ experimentalVulkanMode: v })} label="Experimental Vulkan" />
                </Row>
                <Row label="Controller support" hint="Gamepad/controller. Off by default (PC keyboard + mouse). Lets you move, look, jump, fly, mine and place blocks with a controller.">
                  <Toggle checked={settings.controllerSupport} onChange={(v) => patch({ controllerSupport: v })} label="Controller support" />
                </Row>
                <Row label="Touch controls" hint="On-screen mobile buttons (virtual joystick, mine/place/fly/jump/inventory/chat/pause). Off by default.">
                  <Toggle checked={settings.touchControls} onChange={(v) => patch({ touchControls: v })} label="Touch controls" />
                </Row>
                <Row label="Auto-save" hint="Save the world automatically as you play">
                  <Toggle checked={settings.autoSave} onChange={(v) => patch({ autoSave: v })} label="Auto-save" />
                </Row>
                <Row label="View bobbing" hint="Head-bob while walking">
                  <Toggle checked={settings.viewBobbing} onChange={(v) => patch({ viewBobbing: v })} label="View bobbing" />
                </Row>
                <Row label="Crosshair" hint="Show the centre crosshair">
                  <Toggle checked={settings.crosshair} onChange={(v) => patch({ crosshair: v })} label="Crosshair" />
                </Row>
                <Row label="Day/night speed" hint={`${settings.daySpeed.toFixed(2)}× — how fast the sun and moon travel`}>
                  <input type="range" min={0.25} max={8} step={0.25} value={settings.daySpeed} onChange={(e) => patch({ daySpeed: Number(e.target.value) })} aria-label="Day/night speed" />
                </Row>
                <Row label="Mob difficulty" hint="How aggressive hostile mobs are">
                  <select className="ui-input" value={settings.mobDifficulty} onChange={(e) => patch({ mobDifficulty: e.target.value as GameSettings['mobDifficulty'] })}>
                    <option value="peaceful">Peaceful</option>
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </Row>
                <Row label="Keep inventory on death" hint="Don't drop your items when you die">
                  <Toggle checked={settings.keepInventory} onChange={(v) => patch({ keepInventory: v })} label="Keep inventory" />
                </Row>
                <Row label="World border" hint="An invisible edge around the world">
                  <Toggle checked={settings.worldBorder} onChange={(v) => patch({ worldBorder: v })} label="World border" />
                </Row>
                <Row label="World border radius" hint={`${settings.worldBorderRadius} blocks`}>
                  <input type="range" min={32} max={2000} step={8} value={settings.worldBorderRadius} onChange={(e) => patch({ worldBorderRadius: Number(e.target.value) })} aria-label="World border radius" />
                </Row>
                <Row label="Full Game Settings" hint="Hundreds of toggles across sky, textures, blocks, particles, audio, gameplay, creative, performance, UI, controls, multiplayer, modding and more.">
                  {onOpenSuperSettings
                    ? <button className="confirm-btn wide" style={{ margin: 0 }} onClick={onOpenSuperSettings}>⚙️ Open Full Game Settings</button>
                    : <Toggle checked={false} onChange={() => {}} label="Full Game Settings (unavailable here)" />}
                </Row>
              </>
            )}

            {section === 'controls' && (
              <>
                <Row label="Camera speed" hint={settings.cameraSpeed.toFixed(2)}>
                  <input type="range" min={0.2} max={3} step={0.05} value={settings.cameraSpeed} onChange={(e) => patch({ cameraSpeed: Number(e.target.value) })} aria-label="Camera speed" />
                </Row>
                <Row label="Controller support" hint="Gamepad/controller movement &amp; look.">
                  <Toggle checked={settings.controllerSupport} onChange={(v) => patch({ controllerSupport: v })} label="Controller support" />
                </Row>
                <Row label="Touch controls" hint="On-screen mobile buttons.">
                  <Toggle checked={settings.touchControls} onChange={(v) => patch({ touchControls: v })} label="Touch controls" />
                </Row>
                <Row label="Flight speed" hint={settings.cameraSpeed.toFixed(2)}>
                  <input type="range" min={1} max={8} step={0.1} value={settings.cameraSpeed} onChange={(e) => patch({ cameraSpeed: Number(e.target.value) })} aria-label="Flight speed" />
                </Row>
              </>
            )}

            {section === 'world' && (
              <>
                <Row label="Day/night speed" hint={`${settings.daySpeed.toFixed(2)}x`}>
                  <input type="range" min={0.25} max={8} step={0.25} value={settings.daySpeed} onChange={(e) => patch({ daySpeed: Number(e.target.value) })} aria-label="Day/night speed" />
                </Row>
                <Row label="Mob difficulty">
                  <select className="ui-input" value={settings.mobDifficulty} onChange={(e) => patch({ mobDifficulty: e.target.value as GameSettings['mobDifficulty'] })}>
                    <option value="peaceful">Peaceful</option>
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </Row>
                <Row label="Keep inventory on death">
                  <Toggle checked={settings.keepInventory} onChange={(v) => patch({ keepInventory: v })} label="Keep inventory" />
                </Row>
                <Row label="World border" hint="An invisible edge around the world.">
                  <Toggle checked={settings.worldBorder} onChange={(v) => patch({ worldBorder: v })} label="World border" />
                </Row>
                <Row label="World border radius" hint={`${settings.worldBorderRadius} blocks`}>
                  <input type="range" min={32} max={2000} step={8} value={settings.worldBorderRadius} onChange={(e) => patch({ worldBorderRadius: Number(e.target.value) })} aria-label="World border radius" />
                </Row>
                <Row label="View bobbing">
                  <Toggle checked={settings.viewBobbing} onChange={(v) => patch({ viewBobbing: v })} label="View bobbing" />
                </Row>
                <Row label="Crosshair">
                  <Toggle checked={settings.crosshair} onChange={(v) => patch({ crosshair: v })} label="Crosshair" />
                </Row>
              </>
            )}

            {section === 'accessibility' && (
              <>
                <Row label="High contrast" hint="Stronger panel borders and text">
                  <Toggle checked={settings.highContrast} onChange={(v) => patch({ highContrast: v })} label="High contrast" />
                </Row>
                <Row label="Reduced motion" hint="Disables parallax and UI animation">
                  <Toggle checked={settings.reducedMotion} onChange={(v) => patch({ reducedMotion: v })} label="Reduced motion" />
                </Row>
              </>
            )}

            {section === 'info' && (
              <div className="opt-info">
                <div className="opt-info-card">
                  <div className="opt-info-title">🎮 Quick Controls</div>
                  <ul className="opt-info-list">
                    <li><b>WASD</b> — Move</li>
                    <li><b>Mouse</b> — Look</li>
                    <li><b>Space</b> — Jump / Fly up</li>
                    <li><b>F</b> — Toggle fly</li>
                    <li><b>E / I</b> — Inventory</li>
                    <li><b>T</b> — Chat &amp; commands</li>
                    <li><b>/</b> — Command console</li>
                    <li><b>F8</b> — Dimensions menu</li>
                    <li><b>Esc</b> — Pause / World settings</li>
                  </ul>
                </div>
                <div className="opt-info-card">
                  <div className="opt-info-title">ℹ️ About</div>
                  <p className="opt-info-text">
                    EAOIN — Everything And On Infinite. A fully configurable voxel sandbox.
                    Every system can be tweaked from <b>Options → Full Game Settings</b>.
                  </p>
                </div>
                <div className="opt-info-card">
                  <div className="opt-info-title">🛠 Community</div>
                  <p className="opt-info-text">
                    Join the Discord, share your worlds and preset configurations, and help
                    shape what comes next.
                  </p>
                </div>
              </div>
            )}

            {/* Developer Settings entrance, pinned to the bottom of Options. */}
            <div className="opt-dev-entry">
              <div className="opt-subhead">Developer</div>
              <Row
                label="Developer Settings"
                hint={devAccess.granted ? 'Access granted — opens the developer app panel' : 'Unlock the developer app (terrain, time, lighting tuning)'}
              >
                <button type="button" className="btn-primary" onClick={openDevGate}>
                  {devAccess.granted ? 'Open Developer App' : 'Enter Code'}
                </button>
              </Row>
              {devAccess.gateOpen && !devAccess.granted && (
                <div className="dev-gate-inline">
                  <DeveloperGate error={devAccess.lastError} />
                </div>
              )}
              {devAccess.granted && devAccess.panelOpen && (
                <div className="dev-panel-inline">
                  <DeveloperControls tuning={devTuning} />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </MenuScreen>
  );
}
