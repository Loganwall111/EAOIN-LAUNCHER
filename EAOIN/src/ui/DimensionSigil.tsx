/**
 * DimensionSigil — real vector artwork for each dimension.
 *
 * Replaces the placeholder emoji (🌍 🔥 🌌 …) that were standing in for icons
 * across the dimension menu, portal UI and world cards. Each sigil is a small
 * inline SVG built from the dimension's own palette, so it scales cleanly at
 * any size, matches the game's art direction, and renders identically on every
 * platform — unlike emoji, which change shape per OS and font.
 */

export interface DimensionSigilProps {
  id: string;
  size?: number;
  className?: string;
}

interface SigilTheme {
  /** Background disc gradient stops. */
  bg: [string, string];
  /** Primary glyph colour. */
  fg: string;
  /** Secondary accent colour. */
  accent: string;
  /** Which glyph shape to draw. */
  glyph:
    | 'world'
    | 'flame'
    | 'void'
    | 'ice'
    | 'volcano'
    | 'crystal'
    | 'cloud'
    | 'shadow'
    | 'star'
    | 'wave'
    | 'tree'
    | 'mushroom'
    | 'storm'
    | 'moon'
    | 'sun'
    | 'ringed'
    | 'alien'
    | 'chaos'
    | 'dream'
    | 'toxic'
    | 'pillar'
    | 'fossil'
    | 'gear'
    | 'spirit'
    | 'leaf'
    | 'skull'
    | 'blackhole';
}

const THEMES: Record<string, SigilTheme> = {
  overworld:            { bg: ['#3f7fb5', '#1d4470'], fg: '#7ed957', accent: '#c8e8ff', glyph: 'world' },
  nether:               { bg: ['#7a1c12', '#2a0806'], fg: '#ff7a3a', accent: '#ffd08a', glyph: 'flame' },
  end:                  { bg: ['#2a1a3a', '#0a040f'], fg: '#d8d0a8', accent: '#b08ad8', glyph: 'void' },
  frozen_wasteland:     { bg: ['#4a7fb5', '#122a4a'], fg: '#e8f6ff', accent: '#a8d8f8', glyph: 'ice' },
  volcanic_realm:       { bg: ['#6a2010', '#1a0604'], fg: '#ff9a3a', accent: '#ffd06a', glyph: 'volcano' },
  crystal_realm:        { bg: ['#2a4a7a', '#0a1a3a'], fg: '#7ee8ff', accent: '#d8f4ff', glyph: 'crystal' },
  sky_kingdom:          { bg: ['#5aa0e0', '#1a5a9a'], fg: '#ffffff', accent: '#d8f0ff', glyph: 'cloud' },
  shadow_realm:         { bg: ['#241a2e', '#08060c'], fg: '#8a5ab8', accent: '#c8a0e8', glyph: 'shadow' },
  astral_plane:         { bg: ['#2a1a5a', '#0a0620'], fg: '#b088ff', accent: '#f0e0ff', glyph: 'star' },
  ocean_world:          { bg: ['#1a5a9a', '#04203f'], fg: '#7ed8ff', accent: '#c8f0ff', glyph: 'wave' },
  giant_forest:         { bg: ['#2a5a2a', '#0a2a12'], fg: '#8ada5a', accent: '#d8f0a8', glyph: 'tree' },
  mushroom_kingdom:     { bg: ['#5a2a5a', '#200a24'], fg: '#f0a8d8', accent: '#ffe0f0', glyph: 'mushroom' },
  storm_dimension:      { bg: ['#2a3444', '#0a1018'], fg: '#8ad8ff', accent: '#fff0a8', glyph: 'storm' },
  moon:                 { bg: ['#22262e', '#080a0e'], fg: '#e0e4ec', accent: '#a0a8b8', glyph: 'moon' },
  sun:                  { bg: ['#a85a0a', '#4a1e02'], fg: '#ffd23a', accent: '#fff0a8', glyph: 'sun' },
  gas_giant:            { bg: ['#7a5a2a', '#2a1a08'], fg: '#e8c07a', accent: '#fff0c8', glyph: 'ringed' },
  alien_worlds:         { bg: ['#4a1a5a', '#140420'], fg: '#8aff6a', accent: '#d8ffc8', glyph: 'alien' },
  chaos_dimension:      { bg: ['#5a0a3a', '#1a0210'], fg: '#ff4a8a', accent: '#6affc8', glyph: 'chaos' },
  dream_realm:          { bg: ['#5a5ac8', '#1a1a5a'], fg: '#ffc8e8', accent: '#fff8d8', glyph: 'dream' },
  toxic_wasteland:      { bg: ['#3a4a12', '#101804'], fg: '#c8f03a', accent: '#e8ff8a', glyph: 'toxic' },
  ancient_civilization: { bg: ['#7a6a3a', '#2a2210'], fg: '#e8d8a8', accent: '#fff4d8', glyph: 'pillar' },
  prehistoric_world:    { bg: ['#4a5a2a', '#161e0a'], fg: '#d8c88a', accent: '#f0e8c0', glyph: 'fossil' },
  machine_dimension:    { bg: ['#2a3a4a', '#0a1218'], fg: '#8ad8ff', accent: '#d8f0ff', glyph: 'gear' },
  spirit_realm:         { bg: ['#1a4a4a', '#041818'], fg: '#7affd8', accent: '#d8fff0', glyph: 'spirit' },
  nature_dimension:     { bg: ['#2a6a3a', '#0a2412'], fg: '#a8e85a', accent: '#e0ffc0', glyph: 'leaf' },
  undead_realm:         { bg: ['#2a2a2a', '#0a0a0a'], fg: '#c8c8b8', accent: '#8aff8a', glyph: 'skull' },
  cosmic_void:          { bg: ['#12081f', '#000000'], fg: '#c8a0ff', accent: '#ffd88a', glyph: 'blackhole' },
};

const FALLBACK: SigilTheme = THEMES.overworld;

/** Draw the glyph for a theme. Kept as plain paths so it stays crisp at 24px. */
function Glyph({ theme }: { theme: SigilTheme }) {
  const { fg, accent, glyph } = theme;
  switch (glyph) {
    case 'world':
      return (
        <>
          <circle cx="32" cy="32" r="17" fill={fg} opacity="0.95" />
          <path d="M15 30h34M18 38h28M22 23h20" stroke={accent} strokeWidth="2.4" opacity="0.55" strokeLinecap="round" />
          <ellipse cx="32" cy="32" rx="8" ry="17" fill="none" stroke={accent} strokeWidth="2" opacity="0.5" />
        </>
      );
    case 'flame':
      return (
        <path
          d="M32 14c5 8-3 11 1 16 3-2 4-6 4-6 5 6 6 12 3 17-3 5-9 7-14 5s-8-8-6-14c1-4 5-7 6-11 1-3 2-5 6-7z"
          fill={fg}
        />
      );
    case 'void':
      return (
        <>
          <circle cx="32" cy="32" r="16" fill="none" stroke={fg} strokeWidth="3" />
          <circle cx="32" cy="32" r="6" fill={accent} />
          <path d="M32 10v8M32 46v8M10 32h8M46 32h8" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    case 'ice':
      return (
        <>
          <path d="M32 12v40M15 22l34 20M49 22L15 42" stroke={fg} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M32 20l-5 5M32 20l5 5M32 44l-5-5M32 44l5-5" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    case 'volcano':
      return (
        <>
          <path d="M14 48l12-24h12l12 24z" fill={fg} />
          <path d="M26 24h12l-3 6h-6z" fill={accent} />
          <circle cx="32" cy="18" r="3" fill={accent} />
        </>
      );
    case 'crystal':
      return (
        <>
          <path d="M32 12l12 14-12 26-12-26z" fill={fg} opacity="0.9" />
          <path d="M32 12v40M20 26h24" stroke={accent} strokeWidth="1.8" opacity="0.7" />
        </>
      );
    case 'cloud':
      return (
        <>
          <ellipse cx="26" cy="34" rx="12" ry="9" fill={fg} />
          <ellipse cx="38" cy="31" rx="10" ry="8" fill={fg} />
          <ellipse cx="32" cy="27" rx="9" ry="7" fill={accent} opacity="0.85" />
        </>
      );
    case 'shadow':
      return (
        <>
          <circle cx="32" cy="32" r="16" fill={fg} opacity="0.5" />
          <circle cx="32" cy="32" r="10" fill="#000" />
          <circle cx="27" cy="29" r="2.6" fill={accent} />
          <circle cx="37" cy="29" r="2.6" fill={accent} />
        </>
      );
    case 'star':
      return (
        <path
          d="M32 11l6 15 16 1-12 10 4 16-14-9-14 9 4-16-12-10 16-1z"
          fill={fg}
          stroke={accent}
          strokeWidth="1.4"
        />
      );
    case 'wave':
      return (
        <>
          <path d="M10 28c6-6 12-6 18 0s12 6 18 0 8-4 8-4" fill="none" stroke={fg} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M10 38c6-6 12-6 18 0s12 6 18 0 8-4 8-4" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.75" />
          <path d="M10 48c6-6 12-6 18 0s12 6 18 0" fill="none" stroke={fg} strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
        </>
      );
    case 'tree':
      return (
        <>
          <rect x="29" y="34" width="6" height="18" rx="1.5" fill={accent} />
          <circle cx="32" cy="26" r="14" fill={fg} />
          <circle cx="24" cy="31" r="8" fill={fg} opacity="0.85" />
          <circle cx="40" cy="31" r="8" fill={fg} opacity="0.85" />
        </>
      );
    case 'mushroom':
      return (
        <>
          <rect x="28" y="32" width="8" height="20" rx="2" fill={accent} />
          <path d="M12 33a20 14 0 0140 0z" fill={fg} />
          <circle cx="24" cy="26" r="3" fill={accent} />
          <circle cx="38" cy="24" r="3.6" fill={accent} />
        </>
      );
    case 'storm':
      return (
        <>
          <ellipse cx="30" cy="26" rx="16" ry="9" fill={fg} opacity="0.55" />
          <path d="M32 26l-8 14h7l-4 12 14-17h-8l5-9z" fill={accent} />
        </>
      );
    case 'moon':
      return (
        <>
          <circle cx="32" cy="32" r="16" fill={fg} />
          <circle cx="26" cy="27" r="4" fill={accent} opacity="0.6" />
          <circle cx="38" cy="36" r="5" fill={accent} opacity="0.5" />
          <circle cx="35" cy="22" r="2.4" fill={accent} opacity="0.5" />
        </>
      );
    case 'sun':
      return (
        <>
          <circle cx="32" cy="32" r="11" fill={fg} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={32 + Math.cos(a) * 15}
                y1={32 + Math.sin(a) * 15}
                x2={32 + Math.cos(a) * 21}
                y2={32 + Math.sin(a) * 21}
                stroke={accent}
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
        </>
      );
    case 'ringed':
      return (
        <>
          <circle cx="32" cy="30" r="12" fill={fg} />
          <ellipse cx="32" cy="32" rx="22" ry="6" fill="none" stroke={accent} strokeWidth="3" />
          <ellipse cx="32" cy="32" rx="17" ry="4" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.7" />
        </>
      );
    case 'alien':
      return (
        <>
          <ellipse cx="32" cy="30" rx="13" ry="16" fill={fg} />
          <ellipse cx="26" cy="28" rx="4" ry="6" fill="#0a0a0a" transform="rotate(-18 26 28)" />
          <ellipse cx="38" cy="28" rx="4" ry="6" fill="#0a0a0a" transform="rotate(18 38 28)" />
        </>
      );
    case 'chaos':
      return (
        <>
          <path d="M32 10l7 14 15-3-9 12 9 12-15-3-7 14-7-14-15 3 9-12-9-12 15 3z" fill={fg} />
          <circle cx="32" cy="33" r="5" fill={accent} />
        </>
      );
    case 'dream':
      return (
        <>
          <path d="M40 12a17 17 0 106 22 14 14 0 01-6-22z" fill={fg} />
          <circle cx="22" cy="20" r="2.2" fill={accent} />
          <circle cx="46" cy="44" r="2.6" fill={accent} />
          <circle cx="16" cy="40" r="1.8" fill={accent} />
        </>
      );
    case 'toxic':
      return (
        <>
          <circle cx="32" cy="32" r="16" fill="none" stroke={fg} strokeWidth="3" />
          {[0, 120, 240].map((deg) => (
            <path
              key={deg}
              d="M32 32l9-14a16 16 0 00-18 0z"
              fill={fg}
              transform={`rotate(${deg} 32 32)`}
            />
          ))}
          <circle cx="32" cy="32" r="4" fill={accent} />
        </>
      );
    case 'pillar':
      return (
        <>
          <rect x="14" y="46" width="36" height="6" rx="1.5" fill={fg} />
          <rect x="16" y="14" width="32" height="6" rx="1.5" fill={fg} />
          <rect x="21" y="20" width="6" height="26" fill={accent} />
          <rect x="37" y="20" width="6" height="26" fill={accent} />
        </>
      );
    case 'fossil':
      return (
        <>
          <path d="M14 40c6-16 30-16 36 0" fill="none" stroke={fg} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M20 34v12M28 30v16M36 30v16M44 34v12" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'gear':
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * 360;
            return <rect key={i} x="29.5" y="9" width="5" height="10" rx="1" fill={fg} transform={`rotate(${a} 32 32)`} />;
          })}
          <circle cx="32" cy="32" r="13" fill={fg} />
          <circle cx="32" cy="32" r="6" fill={accent} />
        </>
      );
    case 'spirit':
      return (
        <>
          <path d="M32 12c9 0 15 7 15 16v24l-6-5-5 5-4-5-4 5-5-5-6 5V28c0-9 6-16 15-16z" fill={fg} opacity="0.9" />
          <circle cx="27" cy="28" r="2.6" fill="#04201c" />
          <circle cx="37" cy="28" r="2.6" fill="#04201c" />
        </>
      );
    case 'leaf':
      return (
        <>
          <path d="M48 14C28 14 16 26 16 42c0 4 1 7 2 9C34 51 50 38 48 14z" fill={fg} />
          <path d="M46 16C36 28 28 38 20 50" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    case 'skull':
      return (
        <>
          <path d="M32 12c11 0 18 8 18 18 0 7-4 11-4 15v5H18v-5c0-4-4-8-4-15 0-10 7-18 18-18z" fill={fg} />
          <circle cx="25" cy="30" r="4.6" fill="#0a0a0a" />
          <circle cx="39" cy="30" r="4.6" fill="#0a0a0a" />
          <path d="M28 42h8" stroke="#0a0a0a" strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    case 'blackhole':
      return (
        <>
          <ellipse cx="32" cy="32" rx="24" ry="7" fill="none" stroke={accent} strokeWidth="3.2" opacity="0.85" />
          <ellipse cx="32" cy="32" rx="17" ry="5" fill="none" stroke={fg} strokeWidth="2.2" opacity="0.6" />
          <circle cx="32" cy="32" r="9" fill="#000" stroke={accent} strokeWidth="1.6" />
        </>
      );
    default:
      return <circle cx="32" cy="32" r="15" fill={fg} />;
  }
}

export default function DimensionSigil({ id, size = 44, className }: DimensionSigilProps) {
  const theme = THEMES[id] ?? FALLBACK;
  const gid = `dsig-${id}`;
  return (
    <svg
      className={`dimension-sigil ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${id} dimension emblem`}
    >
      <defs>
        <radialGradient id={gid} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor={theme.bg[0]} />
          <stop offset="100%" stopColor={theme.bg[1]} />
        </radialGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="9" fill={`url(#${gid})`} stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
      <Glyph theme={theme} />
    </svg>
  );
}
