/**
 * MultiplayerScreen — themed server browser + social panel.
 *
 * Reads the real ServerBrowser registry rather than mock rows, so the counts,
 * pings and feature flags shown here reflect the actual data the game ships.
 */
import { useMemo, useState } from 'react';
import { ALL_SERVERS, DEMO_FRIENDS, DEMO_GUILDS, DEMO_NATIONS, ServerEntry } from '../networking/ServerBrowser';
import { UI_ASSETS } from './theme';
import MenuScreen from './MenuScreen';

export interface MultiplayerScreenProps {
  onBack: () => void;
  onJoin: (server: ServerEntry) => void;
}

type Tab = 'servers' | 'friends' | 'guilds';

const REGIONS = ['ALL', 'NA', 'EU', 'AS', 'AU', 'SA', 'AF', 'OC'] as const;

function pingClass(ping: number): string {
  if (ping < 60) return 'good';
  if (ping < 140) return 'ok';
  return 'bad';
}

function statusLabel(status: string): string {
  if (status === 'in_game') return 'In game';
  if (status === 'dnd') return 'Do not disturb';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function MultiplayerScreen({ onBack, onJoin }: MultiplayerScreenProps) {
  const [tab, setTab] = useState<Tab>('servers');
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('ALL');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(ALL_SERVERS[0]?.id ?? null);

  const servers = useMemo(() => {
    const text = query.trim().toLowerCase();
    return ALL_SERVERS.filter((server) => {
      if (region !== 'ALL' && server.region !== region) return false;
      if (!text) return true;
      return server.name.toLowerCase().includes(text) || server.type.toLowerCase().includes(text);
    });
  }, [region, query]);

  const active = servers.find((s) => s.id === selected) ?? servers[0] ?? null;
  const onlinePlayers = ALL_SERVERS.reduce((sum, s) => sum + s.players, 0);

  return (
    <MenuScreen
      title="Multiplayer"
      subtitle={`${ALL_SERVERS.length} servers • ${onlinePlayers.toLocaleString()} players online`}
      backdrop={UI_ASSETS.bgMultiplayer}
      onBack={onBack}
      actions={
        <div className="seg-group">
          {(['servers', 'friends', 'guilds'] as Tab[]).map((id) => (
            <button key={id} className={`seg ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {id === 'servers' ? 'Servers' : id === 'friends' ? 'Friends' : 'Guilds'}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'servers' && (
        <div className="split-2">
          <section className="ui-panel list-pane">
            <div className="ui-panel-title">Server Browser</div>
            <div className="filter-row">
              <input
                className="ui-input"
                placeholder="Search servers…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search servers"
              />
              <div className="chip-row">
                {REGIONS.map((r) => (
                  <button key={r} className={`chip ${region === r ? 'active' : ''}`} onClick={() => setRegion(r)}>{r}</button>
                ))}
              </div>
            </div>
            <div className="scroll-list">
              {servers.length === 0 && <p className="empty-note">No servers match those filters.</p>}
              {servers.map((server) => (
                <button
                  key={server.id}
                  className={`row-card ${active?.id === server.id ? 'selected' : ''}`}
                  onClick={() => setSelected(server.id)}
                >
                  <span className="rc-main">
                    <strong>{server.name}</strong>
                    <small>{server.type} • {server.region} • v{server.version}</small>
                  </span>
                  <span className="rc-side">
                    <em className={`ping ${pingClass(server.ping)}`}>{server.ping}ms</em>
                    <small>{server.players}/{server.maxPlayers}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <aside className="ui-panel detail-pane">
            <div className="ui-panel-title">Details</div>
            {active ? (
              <div className="detail-body">
                <h3 className="detail-name">{active.name}</h3>
                <p className="detail-addr">{active.ip}:{active.port}</p>
                <div className="stat-grid">
                  <div><span>Players</span><strong>{active.players}/{active.maxPlayers}</strong></div>
                  <div><span>Ping</span><strong className={`ping ${pingClass(active.ping)}`}>{active.ping}ms</strong></div>
                  <div><span>Region</span><strong>{active.region}</strong></div>
                  <div><span>Version</span><strong>{active.version}</strong></div>
                </div>
                <p className="option-group-label" style={{ marginTop: 16 }}>Features</p>
                <div className="chip-row">
                  {active.hasAntiCheat && <span className="chip static">Anti-cheat</span>}
                  {active.hasVoiceChat && <span className="chip static">Voice</span>}
                  {active.hasCrossPlay && <span className="chip static">Cross-play</span>}
                  {active.hasGuilds && <span className="chip static">Guilds</span>}
                  {active.hasEconomy && <span className="chip static">Economy</span>}
                  {active.hasLandClaim && <span className="chip static">Land claim</span>}
                  {active.hasGovernments && <span className="chip static">Governments</span>}
                  {active.hasDiplomacy && <span className="chip static">Diplomacy</span>}
                </div>
                <button className="confirm-btn wide" onClick={() => onJoin(active)}>Join Server</button>
              </div>
            ) : (
              <p className="empty-note">Select a server to see details.</p>
            )}
          </aside>
        </div>
      )}

      {tab === 'friends' && (
        <section className="ui-panel">
          <div className="ui-panel-title">Friends — {DEMO_FRIENDS.filter((f) => f.status !== 'offline').length} online</div>
          <div className="scroll-list">
            {DEMO_FRIENDS.map((friend) => (
              <div key={friend.id} className="row-card static">
                <span className="rc-main">
                  <strong>{friend.avatar} {friend.name}</strong>
                  <small>Level {friend.level} • {friend.lastSeen}</small>
                </span>
                <span className="rc-side">
                  <em className={`status-dot ${friend.status}`}>{statusLabel(friend.status)}</em>
                  {friend.server ? <small>{friend.server}</small> : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'guilds' && (
        <div className="split-2">
          <section className="ui-panel">
            <div className="ui-panel-title">Guilds</div>
            <div className="scroll-list">
              {DEMO_GUILDS.map((guild) => (
                <div key={guild.id} className="row-card static">
                  <span className="rc-main">
                    <strong>{guild.name}</strong>
                    <small>{guild.members} members</small>
                  </span>
                  <span className="rc-side"><em>Lv {guild.level}</em></span>
                </div>
              ))}
            </div>
          </section>
          <section className="ui-panel">
            <div className="ui-panel-title">Nations</div>
            <div className="scroll-list">
              {DEMO_NATIONS.map((nation) => (
                <div key={nation.id} className="row-card static">
                  <span className="rc-main">
                    <strong>{nation.emoji} {nation.name}</strong>
                    <small>{nation.leader} • {nation.population.toLocaleString()} citizens</small>
                  </span>
                  <span className="rc-side"><em>{nation.territory}</em></span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </MenuScreen>
  );
}
