/**
 * DeveloperAppPanel — the embedded, in-game developer app panel.
 *
 * Rendered inside the main HUD overlay but invisible to players: during Alpha
 * Access the panel is fully locked down (no button, no menu entry) and only
 * the developer trigger — backquote `` ` `` or Ctrl+Shift+D — does anything.
 * On a granted machine the panel opens instantly; otherwise the trigger
 * reveals the lock gate, and the unlock code grants access on the spot.
 *
 * Every control writes straight into `developerTuningStore`, which the
 * running scene subscribes to — terrain, clock and lighting edits preview
 * live without a reload.
 */
import { FormEvent, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  developerAccess,
  DeveloperAccessSnapshot,
} from '../dev/DeveloperAccess';
import {
  BIOME_MOD_KEYS,
  BIOME_MOD_LABELS,
  DAY_NIGHT_SPEED_MAX,
  DAY_NIGHT_SPEED_MIN,
  developerTuningStore,
  DeveloperWorldTuning,
  effectiveDayLengthSeconds,
  getLightingPreset,
  LIGHTING_PRESETS,
  TERRAIN_AMPLIFICATION_MAX,
  TERRAIN_AMPLIFICATION_MIN,
} from '../dev/DeveloperTuning';

/** Real seconds in one shipped day cycle (must mirror GameCanvas). */
export const DEV_PANEL_BASE_DAY_SECONDS = 1200;

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isDeveloperTrigger(event: KeyboardEvent): boolean {
  if (event.key === '`' || event.code === 'Backquote') return true;
  return (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd';
}

/** Small labeled slider with a live value bubble — the workhorse of the panel. */
function DevSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="dev-slider-row">
      <label htmlFor={id} className="dev-slider-label">{label}</label>
      <input
        id={id}
        className="dev-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="dev-slider-value">{format(value)}</span>
    </div>
  );
}

/** The lock gate shown to anyone who triggers the panel without a grant. */
function DeveloperGate({ error }: { error: string | null }) {
  const [code, setCode] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    developerAccess.submitCode(code);
    setCode('');
  };
  return (
    <div className="dev-app-gate" role="dialog" aria-label="Developer access lock">
      <div className="dev-app-gate-card">
        <div className="dev-gate-lock">🔒</div>
        <h3>Developer Access</h3>
        <p className="dev-gate-sub">Locked down during Alpha Access.</p>
        {error && <p className="dev-gate-error" role="alert">{error}</p>}
        <form onSubmit={submit}>
          <input
            type="password"
            value={code}
            aria-label="Unlock code"
            placeholder="Unlock code"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="dev-gate-actions">
            <button type="submit" className="btn-primary">Unlock</button>
            <button type="button" className="btn-secondary" onClick={() => developerAccess.dismiss()}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** The granted control surface. */
function DeveloperControls({ tuning }: { tuning: DeveloperWorldTuning }) {
  const daySeconds = effectiveDayLengthSeconds(tuning, DEV_PANEL_BASE_DAY_SECONDS);
  const activePreset = getLightingPreset(tuning.lightingPreset);

  return (
    <div className="dev-app-panel" role="dialog" aria-label="Developer app panel">
      <div className="dev-app-header">
        <div>
          <h2>🛠 Developer App</h2>
          <span className="dev-alpha-badge">ALPHA ACCESS — DEV BUILD ONLY</span>
        </div>
        <button
          type="button"
          className="dev-close-btn"
          aria-label="Close developer panel"
          onClick={() => developerAccess.dismiss()}
        >
          ✕
        </button>
      </div>

      <section className="dev-app-section" aria-label="Terrain">
        <h3>⛰ Terrain — 1.18 Noise</h3>
        <DevSlider
          id="dev-terrain-amplification"
          label="Terrain Amplification"
          value={tuning.terrainAmplification}
          min={TERRAIN_AMPLIFICATION_MIN}
          max={TERRAIN_AMPLIFICATION_MAX}
          step={0.05}
          format={(v) => `×${v.toFixed(2)}`}
          onChange={(v) => developerTuningStore.patch({ terrainAmplification: v })}
        />
        <p className="dev-hint">
          Height scale multiplier on the 1.18 continentalness/peaks noise. ×1.00 is the shipped
          terrain; changes regenerate streamed chunks live.
        </p>
      </section>

      <section className="dev-app-section" aria-label="Time and lighting">
        <h3>🌗 Time &amp; Lighting</h3>
        <DevSlider
          id="dev-day-night-speed"
          label="Day / Night Speed"
          value={tuning.dayNightSpeed}
          min={DAY_NIGHT_SPEED_MIN}
          max={DAY_NIGHT_SPEED_MAX}
          step={0.25}
          format={(v) => `×${v.toFixed(2)}`}
          onChange={(v) => developerTuningStore.patch({ dayNightSpeed: v })}
        />
        <p className="dev-hint">
          Full cycle: {daySeconds >= 90 ? `${(daySeconds / 60).toFixed(1)} min` : `${Math.round(daySeconds)} sec`}
          {' '}({(60 / (daySeconds / 60)).toFixed(1)} days/hour).
        </p>
        <label className="dev-toggle-row">
          <input
            type="checkbox"
            checked={tuning.timeFrozen}
            aria-label="Freeze world clock"
            onChange={(e) => developerTuningStore.patch({ timeFrozen: e.target.checked })}
          />
          <span className="dev-toggle-track" aria-hidden="true" />
          <span className="dev-toggle-label">⏸ Freeze world clock</span>
        </label>
        <div className="dev-preset-grid" role="group" aria-label="Lighting presets">
          {LIGHTING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              className={`dev-preset-btn ${preset.id === tuning.lightingPreset ? 'active' : ''}`}
              onClick={() => developerTuningStore.patch({ lightingPreset: preset.id })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="dev-hint">{activePreset.label}: {activePreset.description}</p>
      </section>

      <section className="dev-app-section" aria-label="Biome modifications">
        <h3>🌍 Biome Modifications</h3>
        <ul className="dev-biome-list">
          {BIOME_MOD_KEYS.map((key) => {
            const meta = BIOME_MOD_LABELS[key];
            const enabled = tuning.biomeMods[key];
            return (
              <li key={key}>
                <label className="dev-toggle-row">
                  <input
                    type="checkbox"
                    checked={enabled}
                    aria-label={meta.label}
                    onChange={(e) => developerTuningStore.patchBiomeMod(key, e.target.checked)}
                  />
                  <span className="dev-toggle-track" aria-hidden="true" />
                  <span className="dev-toggle-label">
                    {meta.icon} {meta.label}
                    <small>{meta.description}</small>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="dev-app-footer">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => developerTuningStore.reset()}
        >
          ↺ Reset to defaults
        </button>
        <span className="dev-hint">Trigger: ` or Ctrl+Shift+D • Esc closes</span>
      </div>
    </div>
  );
}

export default function DeveloperAppPanel() {
  const access: DeveloperAccessSnapshot = useSyncExternalStore(
    useCallback((listener) => developerAccess.subscribe(listener), []),
    useCallback(() => developerAccess.get(), [])
  );
  const tuning = useSyncExternalStore(
    useCallback((listener) => developerTuningStore.subscribe(listener), []),
    useCallback(() => developerTuningStore.get(), [])
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        // Never steal keys from text entry — except Escape, which closes.
        if (event.key === 'Escape') developerAccess.dismiss();
        return;
      }
      if (isDeveloperTrigger(event)) {
        event.preventDefault();
        developerAccess.trigger();
      } else if (event.key === 'Escape') {
        developerAccess.dismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Alpha Access lockdown: players see literally nothing. The panel only
  // exists in the tree once the developer has triggered it open, or the gate
  // is asking for the unlock code.
  if (!access.granted) {
    return access.gateOpen ? <DeveloperGate error={access.lastError} /> : null;
  }
  if (!access.panelOpen) return null;
  return <DeveloperControls tuning={tuning} />;
}
