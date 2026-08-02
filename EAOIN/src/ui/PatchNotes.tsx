/**
 * PatchNotes — a collapsible changelog panel.
 *
 * Used by the launcher (full list) and the in-game main menu (latest entry).
 */
import { useState } from 'react';
import { PATCHES, PatchEntry } from '../launcher/PatchNotes';

export function PatchNotesList({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState<PatchEntry | null>(null);
  return (
    <div className={`patch-notes ${compact ? 'compact' : ''}`}>
      {PATCHES.slice(0, compact ? 1 : PATCHES.length).map((p) => (
        <div className="patch-entry" key={p.version}>
          <button className="patch-head" onClick={() => setOpen(open?.version === p.version ? null : p)}>
            <span className="patch-version">{p.version}</span>
            <span className="patch-title">{p.title}</span>
            <span className="patch-label">{p.label}</span>
            <span className="patch-date">{p.date}</span>
          </button>
          {open?.version === p.version && (
            <ul className="patch-body">
              {p.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
