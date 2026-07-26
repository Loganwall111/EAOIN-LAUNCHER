/**
 * MenuScreen — shared shell for the themed sub-screens reached from the title
 * menu (Multiplayer, Mods, Options).
 *
 * Gives every screen the same furniture: a darkened themed backdrop, the EAOIN
 * eyebrow + big title, a back button, and a scrollable content area. Keeping
 * this in one place is what stops the three screens drifting apart visually.
 */
import { ReactNode, useEffect } from 'react';

export interface MenuScreenProps {
  title: string;
  subtitle?: string;
  backdrop: string;
  onBack: () => void;
  /** Optional right-aligned header content (filters, counters, actions). */
  actions?: ReactNode;
  children: ReactNode;
}

export default function MenuScreen({ title, subtitle, backdrop, onBack, actions, children }: MenuScreenProps) {
  // Escape always backs out, matching the rest of the game's menus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onBack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div className="eaoin-screen">
      <div className="screen-backdrop" style={{ backgroundImage: `url(${backdrop})` }} />

      <header className="screen-head">
        <button className="screen-back" onClick={onBack} aria-label="Back to title screen">‹ Back</button>
        <div className="screen-titles">
          <span className="screen-eyebrow">EAOIN</span>
          <h1 className="screen-title">{title}</h1>
          {subtitle ? <p className="screen-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="screen-actions">{actions}</div> : null}
      </header>

      <div className="screen-body">{children}</div>
    </div>
  );
}
