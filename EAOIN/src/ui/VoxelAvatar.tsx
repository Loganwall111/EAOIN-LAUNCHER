/**
 * VoxelAvatar — a pure-CSS blocky character used by the character creator,
 * the title-screen player card and the HUD portrait.
 *
 * Drawing it with divs (rather than a Babylon scene) keeps the menus cheap and
 * means the same appearance object renders identically at any size.
 */
import { CharacterAppearance } from './theme';

/** Hair silhouette variants, derived from the style index. */
function hairShape(style: number): { height: number; top: number; inset: number; radius: string } {
  const variants = [
    { height: 30, top: -4, inset: 8, radius: '4px 4px 0 0' },   // short crop
    { height: 40, top: -6, inset: 6, radius: '8px 8px 0 0' },   // rounded
    { height: 26, top: -3, inset: 10, radius: '2px' },          // buzz
    { height: 52, top: -6, inset: 4, radius: '10px 10px 0 0' }, // long
    { height: 36, top: -8, inset: 2, radius: '14px 14px 0 0' }, // afro-ish
  ];
  return variants[style % variants.length];
}

interface VoxelAvatarProps {
  appearance: CharacterAppearance;
  /** Y rotation in degrees for the turntable buttons. */
  rotation?: number;
  scale?: number;
}

export default function VoxelAvatar({ appearance, rotation = 0, scale = 1 }: VoxelAvatarProps) {
  const hair = hairShape(appearance.hairStyle);
  const shade = (hex: string, amount: number): string => {
    const n = parseInt(hex.replace('#', ''), 16);
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((n >> 16) & 255) * amount);
    const g = clamp(((n >> 8) & 255) * amount);
    const b = clamp((n & 255) * amount);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div
      className="voxel-avatar"
      style={{ transform: `scale(${scale}) rotateY(${rotation}deg)` }}
      aria-label={`${appearance.name} character preview`}
    >
      {/* legs */}
      <div className="va-leg l" style={{ background: appearance.pantsColor, boxShadow: `inset -6px 0 ${shade(appearance.pantsColor, 0.72)}` }} />
      <div className="va-leg r" style={{ background: shade(appearance.pantsColor, 0.88), boxShadow: `inset -6px 0 ${shade(appearance.pantsColor, 0.66)}` }} />
      {/* cape (rendered behind the torso) */}
      {appearance.cape && appearance.cape !== 'none' && (
        <div
          className="va-cape"
          style={{ background: capeColor(appearance.cape), opacity: 0.92 }}
          aria-hidden="true"
        />
      )}
      {/* arms */}
      <div className="va-arm l" style={{ background: appearance.shirtColor, boxShadow: `inset -5px 0 ${shade(appearance.shirtColor, 0.7)}` }} />
      <div className="va-arm r" style={{ background: shade(appearance.shirtColor, 0.9), boxShadow: `inset -5px 0 ${shade(appearance.shirtColor, 0.66)}` }} />
      {/* torso */}
      <div className="va-torso" style={{ background: appearance.shirtColor, boxShadow: `inset -12px 0 ${shade(appearance.shirtColor, 0.76)}, inset 0 10px ${shade(appearance.shirtColor, 1.12)}` }} />
      {/* head */}
      <div className="va-head" style={{ background: appearance.skinTone, boxShadow: `inset -12px 0 ${shade(appearance.skinTone, 0.82)}` }} />
      {appearance.facialHair > 0 && (
        <div
          style={{
            position: 'absolute', left: 40, top: 52, width: 52, height: 18,
            background: appearance.hairColor, opacity: 0.92,
            clipPath: appearance.facialHair % 2 === 0 ? 'polygon(0 0,100% 0,88% 100%,12% 100%)' : 'polygon(24% 0,76% 0,70% 100%,30% 100%)',
          }}
        />
      )}
      <div
        className="va-hair"
        style={{
          background: appearance.hairColor,
          height: hair.height,
          top: hair.top,
          left: 26 - hair.inset / 2,
          width: 80 + hair.inset,
          borderRadius: hair.radius,
          boxShadow: `inset -10px 0 ${shade(appearance.hairColor, 0.74)}`,
        }}
      />
      <div className="va-eye l" style={{ background: appearance.eyeColor }} />
      <div className="va-eye r" style={{ background: appearance.eyeColor }} />
    </div>
  );
}

/** Cape colour palette by style id. */
function capeColor(cape: string): string {
  switch (cape) {
    case 'classic': return 'linear-gradient(180deg,#4a9,#2a6)';
    case 'cosmic': return 'linear-gradient(180deg,#6a4dff,#2a1a6a)';
    case 'ember': return 'linear-gradient(180deg,#ff8a3a,#b83a1a)';
    case 'galaxy': return 'linear-gradient(180deg,#2a4dff,#7a1a8a)';
    case 'knight': return 'linear-gradient(180deg,#5a6a7a,#2a3a4a)';
    default: return '#333';
  }
}

/** Compact square portrait used in the HUD and title-screen player cards. */
export function AvatarPortrait({ appearance, size = 46 }: { appearance: CharacterAppearance; size?: number }) {
  const hair = hairShape(appearance.hairStyle);
  return (
    <div
      className="player-avatar"
      style={{ width: size, height: size, background: appearance.skinTone, position: 'relative', overflow: 'hidden' }}
      aria-hidden="true"
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${hair.height / 2.2}%`, background: appearance.hairColor }} />
      <div style={{ position: 'absolute', left: '24%', top: '52%', width: '13%', height: '13%', background: appearance.eyeColor }} />
      <div style={{ position: 'absolute', right: '24%', top: '52%', width: '13%', height: '13%', background: appearance.eyeColor }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '22%', background: appearance.shirtColor }} />
    </div>
  );
}

/** Tiny head swatch used inside the hair-style picker grid. */
export function MiniHead({ skinTone, hairColor, style }: { skinTone: string; hairColor: string; style: number }) {
  const hair = hairShape(style);
  return (
    <div className="mini-head">
      <div className="mh-face" style={{ background: skinTone }} />
      <div className="mh-hair" style={{ background: hairColor, height: `${hair.height}%`, borderRadius: hair.radius }} />
      <div className="mh-eye l" />
      <div className="mh-eye r" />
    </div>
  );
}
