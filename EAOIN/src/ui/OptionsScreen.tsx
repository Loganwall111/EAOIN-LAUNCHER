/**
 * OptionsScreen — themed settings screen driving the real GameSettings object.
 *
 * Every control writes through clampSettings, so the same validation the rest
 * of the game relies on applies here too.
 */
import { useState } from 'react';
import { clampSettings, GameSettings, qualityRenderDistance } from '../settings/GameSettings';
import { UI_ASSETS } from './theme';
import MenuScreen from './MenuScreen';

export interface OptionsScreenProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onBack: () => void;
}

type Section = 'video' | 'audio' | 'gameplay' | 'accessibility';

const SECTIONS: Array<{ id: Section; label: string; icon: string }> = [
  { id: 'video', label: 'Video', icon: '🖥' },
  { id: 'audio', label: 'Audio', icon: '🔊' },
  { id: 'gameplay', label: 'Gameplay', icon: '🎮' },
  { id: 'accessibility', label: 'Accessibility', icon: '♿' },
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

export default function OptionsScreen({ settings, onChange, onBack }: OptionsScreenProps) {
  const [section, setSection] = useState<Section>('video');
  const patch = (next: Partial<GameSettings>) => onChange(clampSettings({ ...settings, ...next }));

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
                <Row label="Quality preset" hint={`Render distance ${qualityRenderDistance(settings.qualityPreset)} chunks`}>
                  <select className="ui-input" value={settings.qualityPreset} onChange={(e) => patch({ qualityPreset: e.target.value as GameSettings['qualityPreset'] })}>
                    <option value="performance">Performance</option>
                    <option value="balanced">Balanced</option>
                    <option value="quality">Quality</option>
                    <option value="cinematic">Cinematic</option>
                  </select>
                </Row>
                <Row label="Renderer" hint="WebGPU falls back to WebGL automatically">
                  <select className="ui-input" value={settings.rendererPreference} onChange={(e) => patch({ rendererPreference: e.target.value as GameSettings['rendererPreference'] })}>
                    <option value="auto">Auto</option>
                    <option value="webgpu">Prefer WebGPU</option>
                    <option value="webgl">Force WebGL</option>
                  </select>
                </Row>
                <Row label="Render scale" hint={`${Math.round(settings.renderScale * 100)}%`}>
                  <input type="range" min={0.5} max={1.5} step={0.1} value={settings.renderScale} onChange={(e) => patch({ renderScale: Number(e.target.value) })} aria-label="Render scale" />
                </Row>
                <Row label="Texture pack">
                  <select className="ui-input" value={settings.texturePack} onChange={(e) => patch({ texturePack: e.target.value as GameSettings['texturePack'] })}>
                    <option value="classic">Classic</option>
                    <option value="hd">HD</option>
                    <option value="realistic">Realistic</option>
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
          </div>
        </section>
      </div>
    </MenuScreen>
  );
}
