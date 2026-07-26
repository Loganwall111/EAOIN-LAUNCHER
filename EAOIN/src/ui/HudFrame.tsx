/**
 * HudFrame — the concept-art in-game HUD shell.
 *
 * Purely presentational: every value is passed in, so this stays cheap to
 * re-render and the gameplay systems keep owning their own state. The heavy
 * panels (inventory, shaders, quests…) still live in HUD.tsx and are layered
 * above this frame.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import { getStackCount, HOTBAR_BLOCKS, InventoryStacks } from '../player/InventoryState';
import { SurvivalStats } from '../player/SurvivalState';
import { getTool, ToolID } from '../player/ToolState';
import { ObjectiveStatus } from '../objectives/ObjectiveTracker';
import { RuntimeStatus } from '../runtime/RuntimeStatus';
import {
  CHAT_CHANNELS, ChatChannel, ChatEntry, CharacterAppearance,
  compassTicks, DEMO_CHAT, HUD_ABILITIES,
} from './theme';
import { deriveStatusEffects } from '../player/StatusEffects';
import { AvatarPortrait } from './VoxelAvatar';

export interface HudFrameProps {
  appearance: CharacterAppearance;
  survivalStats: SurvivalStats;
  inventory: InventoryStacks;
  selectedBlock: BlockID;
  selectedTool: ToolID;
  onSelectBlock: (id: BlockID) => void;
  position: { x: number; y: number; z: number };
  /** Camera yaw in radians, used to drive the compass strip. */
  yaw: number;
  timeOfDay: number;
  day: number;
  biome: string;
  runtimeStatus: RuntimeStatus;
  objectives: ObjectiveStatus[];
  toast?: string;
  /** Live flight state, mirrored from the engine. */
  flightEnabled?: boolean;
  /** Fires the real keyboard handler behind an ability button. */
  onAbility?: (key: string) => void;
  onOpenInventory: () => void;
  onOpenGuide: () => void;
  onOpenFriends: () => void;
  onOpenSettings: () => void;
  onOpenQuests: () => void;
}

const TICK_WIDTH = 34;

function formatClock(timeOfDay: number): string {
  // Work in whole minutes so float drift (18.7 -> 18:41) cannot bite, and wrap
  // 24:00 back to 00:00.
  const totalMinutes = Math.round(timeOfDay * 60) % (24 * 60);
  const safe = (totalMinutes + 24 * 60) % (24 * 60);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Repeating pip row (hearts / drumsticks) like the concept art. */
function PipRow({ icon, value, max, count = 10 }: { icon: string; value: number; max: number; count?: number }) {
  const filled = Math.round((Math.max(0, Math.min(max, value)) / max) * count);
  return (
    <span className="pips">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ opacity: i < filled ? 1 : 0.24, filter: i < filled ? 'none' : 'grayscale(1)' }}>{icon}</span>
      ))}
    </span>
  );
}

export default function HudFrame({
  appearance, survivalStats, inventory, selectedBlock, selectedTool, onSelectBlock,
  position, yaw, timeOfDay, day, biome, runtimeStatus, objectives, toast,
  flightEnabled = false, onAbility,
  onOpenInventory, onOpenGuide, onOpenFriends, onOpenSettings, onOpenQuests,
}: HudFrameProps) {
  const [chatChannel, setChatChannel] = useState<ChatChannel>('GLOBAL');
  const [chatDraft, setChatDraft] = useState('');
  const [chatLog, setChatLog] = useState<ChatEntry[]>(DEMO_CHAT);
  const minimapRef = useRef<HTMLCanvasElement>(null);

  const ticks = useMemo(() => compassTicks(), []);

  // Effects are a pure function of live world state rather than a fixed list.
  const effects = useMemo(() => deriveStatusEffects({
    survivalStats,
    dimensionId: runtimeStatus.dimensionId ?? 'overworld',
    timeOfDay,
    flightEnabled,
    nearPortal: Boolean(runtimeStatus.nearbyPortalCore),
    depthBelowSurface: Math.max(0, 64 - position.y),
  }), [survivalStats, runtimeStatus.dimensionId, runtimeStatus.nearbyPortalCore, timeOfDay, flightEnabled, position.y]);
  const headingDeg = ((yaw * 180) / Math.PI % 360 + 360) % 360;

  // Sun/moon glyph tracks the world clock.
  const skyIcon = timeOfDay >= 6 && timeOfDay < 18 ? '☀️' : '🌙';

  // Lightweight procedural minimap: a cheap noise wash tinted by biome so the
  // panel reads as a real map without paying for a second render target.
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const image = ctx.createImageData(size, size);
    const ox = Math.floor(position.x / 4);
    const oz = Math.floor(position.z / 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const wx = x + ox;
        const wz = y + oz;
        // Cheap deterministic hash noise — stable as the player moves.
        const h = Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453;
        const n = h - Math.floor(h);
        const water = n < 0.22;
        const rock = n > 0.86;
        const i = (y * size + x) * 4;
        if (water) { image.data[i] = 42; image.data[i + 1] = 88; image.data[i + 2] = 150; }
        else if (rock) { image.data[i] = 112; image.data[i + 1] = 112; image.data[i + 2] = 116; }
        else { image.data[i] = 46 + n * 44; image.data[i + 1] = 96 + n * 62; image.data[i + 2] = 38 + n * 30; }
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, [position.x, position.z, biome]);

  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    setChatLog((log) => [...log, { id: Date.now(), channel: chatChannel, author: appearance.name, text }].slice(-40));
    setChatDraft('');
  };

  const visibleChat = chatLog.filter((line) => chatChannel === 'GLOBAL' || line.channel === chatChannel).slice(-12);
  const xpPercent = Math.min(100, (runtimeStatus.authorityTicks ?? 0) % 100);

  return (
    <div className="eaoin-hud">
      {/* ------------------------------- player card ------------------------------ */}
      <div className="hud-player ui-panel hud-interactive">
        <AvatarPortrait appearance={appearance} size={46} />
        <div>
          <div className="hud-player-name">{appearance.name}</div>
          <div className="hud-bar hp"><i style={{ width: `${survivalStats.health}%` }} /><b>{Math.round(survivalStats.health)} / 100</b></div>
          <div className="hud-bar stam"><i style={{ width: `${survivalStats.stamina}%` }} /><b>{Math.round(survivalStats.stamina)} / 100</b></div>
          <span className="hud-level-chip">LVL {Math.max(1, Math.floor((runtimeStatus.authorityTicks ?? 0) / 60) + 1)}</span>
        </div>
      </div>

      {/* --------------------------------- compass -------------------------------- */}
      <div className="hud-compass ui-panel">
        <div className="compass-strip" style={{ transform: `translateX(calc(50% - ${(headingDeg / 15) * TICK_WIDTH}px))`, left: 0 }}>
          {[...ticks, ...ticks].map((tick, index) => (
            <span key={`${tick.deg}-${index}`} className={`compass-tick ${tick.cardinal ? 'card' : ''}`}>{tick.label}</span>
          ))}
        </div>
        <span className="compass-needle">▼ {Math.round(headingDeg)}</span>
      </div>

      {/* ---------------------------------- clock --------------------------------- */}
      <div className="hud-clock">
        <div className="clock-day">DAY {day}</div>
        <div className="clock-sun">{skyIcon}</div>
        <div className="clock-time">{formatClock(timeOfDay)}</div>
      </div>

      {/* -------------------------------- effects --------------------------------- */}
      <div className="hud-effects ui-panel">
        {effects.map((effect) => (
          <div key={effect.id} className={`effect-row tone-${effect.tone}`}>
            <span className="fx-icon">{effect.icon}</span>
            <span>
              <span className="fx-name">{effect.name}</span><br />
              <span className="fx-time">{effect.detail}</span>
            </span>
          </div>
        ))}
      </div>

      {/* -------------------------------- minimap --------------------------------- */}
      <div className="hud-minimap ui-panel">
        <div className="minimap-coords">
          <span>X: {Math.round(position.x)}</span>
          <span>Y: {Math.round(position.y)}</span>
          <span>Z: {Math.round(position.z)}</span>
        </div>
        <div className="minimap-canvas">
          <canvas ref={minimapRef} />
          <span className="minimap-player" style={{ transform: `translate(-50%,-50%) rotate(${headingDeg}deg)` }}>▲</span>
        </div>
        <div className="minimap-footer">
          <span>Biome: {biome}</span>
          <span>{runtimeStatus.dimensionName ?? 'Overworld'}</span>
        </div>
      </div>

      {/* --------------------------------- quests --------------------------------- */}
      <div className="hud-quests ui-panel">
        <div className="ui-panel-title">Active Quests</div>
        <div className="quest-list">
          {objectives.slice(0, 5).map((objective) => (
            <div key={objective.id} className={`quest-row ${objective.complete ? 'complete' : ''}`}>
              <span className="q-icon">{objective.complete ? '✅' : '◆'}</span>
              <span>
                <div className="q-name">{objective.label}</div>
                <div className="q-prog">{objective.progress}</div>
              </span>
            </div>
          ))}
        </div>
        <button className="quest-hint hud-interactive" onClick={onOpenQuests} style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
          [Q] Open Quest Book
        </button>
      </div>

      {/* ---------------------------------- chat ---------------------------------- */}
      <div className="hud-chat ui-panel hud-interactive">
        <div className="chat-tabs">
          {CHAT_CHANNELS.map((channel) => (
            <button key={channel} className={`chat-tab ${chatChannel === channel ? 'active' : ''}`} onClick={() => setChatChannel(channel)}>
              {channel}
            </button>
          ))}
        </div>
        <div className="chat-log">
          {visibleChat.map((line) => (
            <div key={line.id} className={`chat-line ${line.channel.toLowerCase()}`}>
              <span className="ch-tag">[{line.channel}]</span>{' '}
              {line.author ? <strong>&lt;{line.author}&gt;</strong> : null} {line.text}
            </div>
          ))}
        </div>
        <div className="chat-entry">
          <input
            value={chatDraft}
            placeholder="Press T to chat..."
            onChange={(e) => setChatDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } }}
          />
        </div>
      </div>

      {/* -------------------------- vitals + hotbar (bottom) ---------------------- */}
      <div className="hud-bottom">
        <div className="vitals-icons">
          <PipRow icon="🛡️" value={survivalStats.stamina} max={100} />
        </div>
        <div className="vitals-icons">
          <PipRow icon="❤️" value={survivalStats.health} max={100} />
          <span className="lvl">{Math.max(1, Math.floor((runtimeStatus.authorityTicks ?? 0) / 60) + 1)}</span>
          <PipRow icon="🍗" value={survivalStats.food} max={100} />
        </div>
        <div className="hud-bar xp" style={{ width: 470, height: 10 }}><i style={{ width: `${xpPercent}%` }} /></div>
        <div className="vitals-bars">
          <div className="hud-bar stam"><i style={{ width: `${survivalStats.stamina}%` }} /><b>{Math.round(survivalStats.stamina)}/100</b></div>
          <div className="hud-bar xp"><i style={{ width: `${xpPercent}%` }} /><b>{xpPercent}%</b></div>
          <div className="hud-bar food"><i style={{ width: `${survivalStats.food}%` }} /><b>{Math.round(survivalStats.food)}/100</b></div>
        </div>
        <div className="hotbar-strip hud-interactive">
          {HOTBAR_BLOCKS.map((blockId, index) => {
            const count = getStackCount(inventory, blockId);
            const block = getBlock(blockId);
            return (
              <button
                key={blockId}
                className={`hot-slot ${selectedBlock === blockId ? 'selected' : ''}`}
                onClick={() => onSelectBlock(blockId)}
                title={block.name}
              >
                <span className="slot-num">{index + 1}</span>
                <span style={{
                  width: 26, height: 26, background: block.color,
                  boxShadow: `inset -8px 0 ${block.accentColor ?? block.color}, inset 0 6px rgba(255,255,255,.24)`,
                  border: '1px solid rgba(0,0,0,.6)',
                }} />
                {count > 0 && <span className="slot-count">{count}</span>}
              </button>
            );
          })}
          <button className="hot-slot hud-interactive" onClick={onOpenInventory} title="Open inventory">…</button>
        </div>
      </div>

      {/* ------------------------------ nav + abilities --------------------------- */}
      <div className="hud-nav">
        <button className="nav-btn" onClick={onOpenInventory} title="Inventory"><span className="nb-icon">🎒</span><span className="nb-key">U</span></button>
        <button className="nav-btn" onClick={onOpenGuide} title="Guide"><span className="nb-icon">📖</span><span className="nb-key">I</span></button>
        <button className="nav-btn" onClick={onOpenFriends} title="Friends"><span className="nb-icon">👥</span><span className="nb-key">K</span></button>
        <button className="nav-btn" onClick={onOpenSettings} title="Settings"><span className="nb-icon">⚙️</span><span className="nb-key">J</span></button>
      </div>

      <div className="hud-equipped ui-panel">
        <span className="eq-icon">🗡️</span>
        <span>
          <div className="eq-name">{getTool(selectedTool).name}</div>
          <div className="eq-dura">Equipped</div>
        </span>
      </div>

      <div className="hud-abilities">
        {HUD_ABILITIES.map((ability) => (
          <button
            key={ability.id}
            className={`ability-btn ${ability.id === 'flight' && flightEnabled ? 'active' : ''}`}
            title={`${ability.hint} [${ability.key}]`}
            onClick={() => onAbility?.(ability.key)}
          >
            <span className="ab-key">{ability.key}</span>
            <span className="ab-icon">{ability.icon}</span>
            <span className="ab-name">{ability.name}</span>
          </button>
        ))}
      </div>

      <div className="hud-crosshair" />
      {toast ? <div className="hud-toast">{toast}</div> : null}
    </div>
  );
}
