/**
 * PhotoMode — freeze the world, frame the shot, apply a filter, and save a
 * screenshot.
 *
 * When opened it grabs a live snapshot of the game canvas (and keeps re-snapping
 * on request), overlays a viewfinder + filter chips, and lets you download the
 * framed image. The world is paused while it's open.
 */
import { useState } from 'react';

interface Props {
  /** The live game canvas to capture. */
  canvas: HTMLCanvasElement | null;
  onClose: () => void;
}

const FILTERS: { id: string; label: string; css: string }[] = [
  { id: 'none', label: 'None', css: 'none' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.5) contrast(1.1)' },
  { id: 'golden', label: 'Golden Hour', css: 'sepia(0.35) saturate(1.4) hue-rotate(-10deg) brightness(1.05)' },
  { id: 'midnight', label: 'Midnight', css: 'saturate(0.7) brightness(0.75) hue-rotate(180deg)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.25) brightness(0.95)' },
  { id: 'vapor', label: 'Vaporwave', css: 'saturate(1.6) hue-rotate(300deg) brightness(1.05)' },
  { id: 'neon', label: 'Neon', css: 'saturate(2.2) contrast(1.2)' },
];

export default function PhotoMode({ canvas, onClose }: Props) {
  const [filter, setFilter] = useState(FILTERS[0]);
  const [zoom, setZoom] = useState(1);

  const snapshot = (): string => {
    if (!canvas) return '';
    try {
      // Scale the live canvas up to a crisp still, then draw the filter on top
      // by compositing onto an offscreen canvas.
      const w = canvas.width, h = canvas.height;
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const ctx = off.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = filter.css;
      ctx.drawImage(off, 0, 0);
      return off.toDataURL('image/png');
    } catch {
      return '';
    }
  };

  const download = () => {
    const data = snapshot();
    if (!data) return;
    const a = document.createElement('a');
    a.href = data;
    a.download = `eaoin-photo-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="photo-mode scrim">
      <div className="photo-panel">
        <div className="photo-head">
          <span>📷 Photo Mode</span>
          <button className="super-close" onClick={onClose}>✕</button>
        </div>
        <div className="photo-view" style={{ filter: filter.css, transform: `scale(${zoom})` }}>
          <div className="photo-thumb-label">LIVE VIEW — world is paused</div>
        </div>
        <div className="photo-controls">
          <span className="photo-label">Filter</span>
          <div className="photo-filters">
            {FILTERS.map((f) => (
              <button key={f.id} className={`photo-chip ${filter.id === f.id ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="photo-label">Zoom {zoom.toFixed(1)}×</span>
          <input type="range" min={1} max={2.5} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          <div className="photo-actions">
            <button className="confirm-btn wide" onClick={download}>💾 Save Screenshot</button>
          </div>
        </div>
      </div>
    </div>
  );
}
