/**
 * HorizonOS File Explorer — a real windowed file browser.
 *
 * A left sidebar of quick locations, a toolbar (back / up), an address bar and
 * a navigable folder tree. Opening a text document shows it in a built-in
 * "viewer" pane, so every item really takes you somewhere.
 */
import { useMemo, useState } from 'react';

export interface OSNode {
  name: string;
  kind: 'folder' | 'file';
  children?: OSNode[];
  ext?: 'txt' | 'md' | 'key' | 'png' | 'exe';
  content?: string;
}

/** The fake but cohesive filesystem HorizonOS ships with. */
const ROOT: OSNode = {
  name: 'This PC',
  kind: 'folder',
  children: [
    {
      name: 'Documents', kind: 'folder', children: [
        { name: 'README.txt', kind: 'file', ext: 'txt', content: 'Welcome to HorizonOS.\n\nDouble-click a file to open it.\nDouble-click a folder to step inside.\nEverything here goes somewhere — nothing is a dead end.\n\n— HorizonOS' },
        { name: 'HorizonOS Manual.md', kind: 'file', ext: 'md', content: '# HorizonOS Field Manual\n\n* Drag windows by their title bars.\n* Click the Wi-Fi tray icon at the bottom-right to join networks.\n* The Games hub has built-in shooters and card games.\n* The Nebula Browser can load real pages and download extensions.' },
        { name: 'Server Codes.txt', kind: 'file', ext: 'txt', content: 'EVENT SERVER CODES\n\nOris Survival   ->  ORIS-2026\nPsychedelics    ->  MOON-PSY\nHidden Chest    ->  Try the Psychedelics moon\n\nHorizonOS Admin : Logan1234' },
        { name: 'Lore Notes.txt', kind: 'file', ext: 'txt', content: 'EAOIN LORE\n\nChorus is not a plant. It is a signal.\nThe Cosmic Girl is the last fragment of the narrator.\nThe Backrooms were never meant to be reachable.\nEvery dimension is a room in a house never finished.' },
        { name: 'Reports', kind: 'folder', children: [
          { name: 'Server Census.txt', kind: 'file', ext: 'txt', content: 'SERVER CENSUS\n\nNebula Prime     : 12,481 players\nEmber Hollows    : 8,902 players\nCorrupted Lands  : 5,677 players\n\nThe Humorous     : 2,431 players (and rising)' },
          { name: 'The Humorous.txt', kind: 'file', ext: 'txt', content: 'DIMENSION FILE: THE HUMOROUS\n\nBiome: comedic floating isles & crystal spires.\nCreatures: giggle-sprites, pun golems, jesting frogs.\nDanger: sometimes the terrain laughs back.\nCargo: punchlines, punchcards and Shard motes.' },
        ] },
      ],
    },
    {
      name: 'Pictures', kind: 'folder', children: [
        { name: 'cosmic_girl.png', kind: 'file', ext: 'png', content: 'The Cosmic Girl — last fragment of the narrator. She is still watching.' },
        { name: 'onblockaway_logo.png', kind: 'file', ext: 'png', content: 'The ONEBLOCKAWAY STUDIO crest. It reads backwards in mirrors on a blood moon.' },
        { name: 'wallpaper.png', kind: 'file', ext: 'png', content: 'The desktop wallpaper. Zoom in. The far mountain is not a mountain.' },
      ],
    },
    {
      name: 'Downloads', kind: 'folder', children: [
        { name: 'nebula-browser-ext-pack.ex', kind: 'file', ext: 'exe', content: 'Extension pack — install from inside the Nebula Browser.' },
        { name: 'shader-pack.vpk', kind: 'file', ext: 'exe', content: 'Ray-traced shader pack. Requires Experimental mode.' },
        { name: 'world_backup.eaoin', kind: 'file', ext: 'exe', content: 'A full world backup. Size: 42 MB. Never compress the grass texture.' },
      ],
    },
    {
      name: 'Games', kind: 'folder', children: [
        { name: 'Arena Shooter.lnk', kind: 'file', ext: 'exe', content: 'Quick link — open the Games hub and play Arena Shooter.' },
        { name: 'Memory Cards.lnk', kind: 'file', ext: 'exe', content: 'Quick link — open the Games hub and play Memory Cards.' },
        { name: 'Score Table.txt', kind: 'file', ext: 'txt', content: 'HIGH SCORES\n\nArena Shooter  : 44\nMemory Cards   : 10 pairs\n\nBeat them. The OS is watching.' },
      ],
    },
    {
      name: 'System', kind: 'folder', children: [
        { name: 'drivers.txt', kind: 'file', ext: 'txt', content: 'HorizonOS drivers report:\n\nNetworking .......... OK\nAudio ............... OK\nShader scheduler .... OK\nReality anchor ...... WARNING\n\nThe reality anchor occasionally drifts. This is normal. Probably.' },
        { name: 'bin', kind: 'folder', children: [
          { name: 'eaoin-engine.exe', kind: 'file', ext: 'exe', content: 'The game engine. It is always running. Even now.' },
          { name: 'uninstall.exe', kind: 'file', ext: 'exe', content: 'You cannot uninstall the world you are standing in.' },
        ] },
      ],
    },
  ],
};

const FILE_ICON: Record<string, string> = {
  txt: '📄', md: '📝', key: '🗝️', png: '🖼️', exe: '⚙️',
};
const FOLDER_ICON = '📁';

export default function FileExplorer() {
  const [history, setHistory] = useState<OSNode[]>([]);
  const [current, setCurrent] = useState<OSNode>(ROOT);
  const [openFile, setOpenFile] = useState<OSNode | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [path, setPath] = useState<string>('C:\\This PC');

  const canBack = history.length > 0;

  const navigateTo = (node: OSNode, from: OSNode) => {
    if (node.kind !== 'folder') return;
    setHistory((h) => [...h, from]);
    setCurrent(node);
    setSelected(null);
    setPath((p) => `${p}\\${node.name}`);
  };

  const goUp = () => {
    if (history.length === 0) return;
    setCurrent(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setSelected(null);
  };

  const pathParts = useMemo(() => path.split('\\').filter(Boolean), [path]);

  const children = current.children ?? [];
  const folders = children.filter((c) => c.kind === 'folder');
  const files = children.filter((c) => c.kind === 'file');

  return (
    <div className="fxplorer">
      {/* Toolbar */}
      <div className="fxp-toolbar">
        <button className="fxp-tool" disabled={!canBack} onClick={() => setHistory((h) => [...h])} title="Back (use sidebar)">
          ↩
        </button>
        <button className="fxp-tool" disabled={!canBack} onClick={goUp} title="Up one level">⬆</button>
        <button className="fxp-tool" onClick={() => { setHistory([]); setCurrent(ROOT); setPath('C:\\This PC'); setOpenFile(null); }} title="Home">🏠</button>
        <div className="fxp-address">
          <span>📌</span> {path}
        </div>
      </div>

      <div className="fxp-main">
        {/* Sidebar */}
        <div className="fxp-sidebar">
          {['Quick access', 'This PC', 'Documents', 'Downloads', 'Pictures', 'Games', 'System'].map((item) => (
            <button
              key={item}
              className={`fxp-side-item ${item === 'This PC' ? 'active' : ''}`}
              onClick={() => {
                const node = item === 'This PC' ? ROOT : ROOT.children?.find((c) => c.name === item && c.kind === 'folder');
                if (node) { setHistory([]); setCurrent(node); setPath(`C:\\This PC\\${item === 'This PC' ? '' : item}`); setOpenFile(null); }
              }}
            >
              {item === 'This PC' ? '💻' : item === 'Documents' ? '📄' : item === 'Downloads' ? '⬇' : item === 'Pictures' ? '🖼' : item === 'Games' ? '🎮' : item === 'System' ? '⚙' : '★'} {item}
            </button>
          ))}
        </div>

        {/* Breadcrumbs + content */}
        <div className="fxp-content">
          <div className="fxp-crumbs">
            {pathParts.map((part, i) => (
              <span key={i}>{i > 0 && <span className="fxp-crumb-sep">›</span>}<span className="fxp-crumb">{part}</span></span>
            ))}
          </div>

          {openFile ? (
            <div className="fxp-docviewer">
              <div className="fxp-doc-head">
                <span>{FILE_ICON[openFile.ext ?? 'txt']} {openFile.name}</span>
                <button className="fxp-tool" onClick={() => setOpenFile(null)}>✕ Close</button>
              </div>
              <pre className="fxp-doc-body">
                {openFile.ext === 'png' || openFile.ext === 'exe'
                  ? `[${openFile.ext?.toUpperCase()}] ${openFile.content}`
                  : openFile.content}
              </pre>
            </div>
          ) : (
            <div className="fxp-grid">
              {folders.map((f) => (
                <button key={f.name} className={`fxp-cell ${selected === f.name ? 'sel' : ''}`}
                  onClick={() => setSelected(f.name)}
                  onDoubleClick={() => navigateTo(f, current)}>
                  <span className="fxp-cell-icon">{FOLDER_ICON}</span>
                  <span className="fxp-cell-name">{f.name}</span>
                </button>
              ))}
              {files.map((f) => (
                <button key={f.name} className={`fxp-cell ${selected === f.name ? 'sel' : ''}`}
                  onClick={() => setSelected(f.name)}
                  onDoubleClick={() => setOpenFile(f)}>
                  <span className="fxp-cell-icon">{FILE_ICON[f.ext ?? 'txt'] ?? '📄'}</span>
                  <span className="fxp-cell-name">{f.name}</span>
                </button>
              ))}
              {children.length === 0 && <p className="fxp-empty">This folder is empty.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="fxp-status">
        <span>{folders.length} folder{(folders.length === 1 ? '' : 's')} • {files.length} file{(files.length === 1 ? '' : 's')}</span>
        <span>HorizonOS File System</span>
      </div>
    </div>
  );
}
