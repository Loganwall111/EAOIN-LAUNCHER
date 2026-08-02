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
import { SuperSettings } from '../settings/SuperSettings';

type Tab = 'lighting' | 'world' | 'camera' | 'rt' | 'debug' | 'mods';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'lighting', label: 'Lighting', icon: '💡' },
  { id: 'world', label: 'World', icon: '🌍' },
  { id: 'camera', label: 'Camera', icon: '📷' },
  { id: 'rt', label: 'Ray Tracing', icon: '⚡' },
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
  const [tab, setTab] = useState<Tab>('lighting');
  const patch = (next: Partial<SuperSettings>) => onChange({ ...settings, ...next });

  return (
    <div className="super-settings scrim">
      <div className="super-panel">
        <div className="super-head">
          <span>⚡ Super Settings</span>
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
          {tab === 'lighting' && (
            <>
              <Row label="Coloured lighting" hint="Tint every light source by its block colour.">
                <Toggle on={settings.coloredLighting} onClick={() => patch({ coloredLighting: !settings.coloredLighting })} label="Coloured lighting" />
              </Row>
              <Row label="Light mixing" hint="Blend when two coloured lights overlap.">
                <Toggle on={settings.lightMixing} onClick={() => patch({ lightMixing: !settings.lightMixing })} label="Light mixing" />
              </Row>
              <Row label="God rays" hint={`${Math.round(settings.godRays * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={settings.godRays} onChange={(e) => patch({ godRays: Number(e.target.value) })} />
              </Row>
              <Row label="Glass refraction" hint="Light bends through glass & glow glass.">
                <Toggle on={settings.glassRefraction} onClick={() => patch({ glassRefraction: !settings.glassRefraction })} label="Glass refraction" />
              </Row>
              <Row label="Glow glass intensity" hint={`${Math.round(settings.glowGlassIntensity * 100)}%`}>
                <input type="range" min={0} max={1} step={0.05} value={settings.glowGlassIntensity} onChange={(e) => patch({ glowGlassIntensity: Number(e.target.value) })} />
              </Row>
            </>
          )}

          {tab === 'world' && (
            <>
              <Row label="Sky tint" hint="Hex colour overlay on the sky.">
                <input type="color" value={settings.skyTint === '#000000' ? '#000000' : settings.skyTint} onChange={(e) => patch({ skyTint: e.target.value })} />
              </Row>
              <Row label="Fog tint">
                <input type="color" value={settings.fogTint} onChange={(e) => patch({ fogTint: e.target.value })} />
              </Row>
              <Row label="Day tint">
                <input type="color" value={settings.dayTint} onChange={(e) => patch({ dayTint: e.target.value })} />
              </Row>
              <Row label="Night tint">
                <input type="color" value={settings.nightTint} onChange={(e) => patch({ nightTint: e.target.value })} />
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
                <select className="ui-input" value={settings.captureResolution} onChange={(e) => patch({ captureResolution: e.target.value as '720' | '1080' })}>
                  <option value="720">720p</option>
                  <option value="1080">1080p</option>
                </select>
              </Row>
            </>
          )}

          {tab === 'rt' && (
            <>
              <Row label="Hardware ray tracing" hint="Experimental, OFF by default — requires a capable GPU.">
                <Toggle on={settings.hardwareRayTracing} onClick={() => patch({ hardwareRayTracing: !settings.hardwareRayTracing })} label="Hardware ray tracing" />
              </Row>
            </>
          )}

          {tab === 'debug' && (
            <>
              <Row label="Show chunk borders">
                <Toggle on={settings.showChunkBorders} onClick={() => patch({ showChunkBorders: !settings.showChunkBorders })} label="Show chunk borders" />
              </Row>
              <Row label="Wireframe mode">
                <Toggle on={settings.showWireframe} onClick={() => patch({ showWireframe: !settings.showWireframe })} label="Wireframe" />
              </Row>
              <Row label="Dev god mode">
                <Toggle on={settings.devGodMode} onClick={() => patch({ devGodMode: !settings.devGodMode })} label="God mode" />
              </Row>
              <Row label="Dev no-clip">
                <Toggle on={settings.devNoClip} onClick={() => patch({ devNoClip: !settings.devNoClip })} label="No clip" />
              </Row>
            </>
          )}

          {tab === 'mods' && (
            <>
              <Row label="Mod rebuilder" hint="Rebuild & preview a mod from inside the game.">
                <Toggle on={settings.modRebuilder} onClick={() => patch({ modRebuilder: !settings.modRebuilder })} label="Mod rebuilder" />
              </Row>
              <Row label="In-game world editor" hint="Open the block-by-block world editor.">
                <Toggle on={settings.worldEditor} onClick={() => patch({ worldEditor: !settings.worldEditor })} label="World editor" />
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
