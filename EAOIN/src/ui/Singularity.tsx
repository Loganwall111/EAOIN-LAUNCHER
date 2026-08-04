/**
 * Singularity — a REAL, ray-marched black hole simulator (2.0 Update Part 2).
 *
 * Unlike a flat 2D shader, this uses a WebGL fragment shader that ray-marches
 * light through the Schwarzschild metric with ADAPTIVE step sizes, so rays are
 * bent (gravitational lensing) up to 180° around the event horizon — producing
 * the "Interstellar" look where the accretion disk wraps over and under the
 * black sphere.
 *
 * Interaction:
 *   - Mouse DRAG to pan / rotate / orbit the camera in a real 3D viewport.
 *   - Scroll wheel + W/S + arrow keys to zoom in/out of the hole.
 *   - Two sliders: accretion-disk thickness and gravity strength.
 *   - Zoom all the way through the hole to begin the ARG journey into the
 *     hidden world (neural network → Minecraft planet → the house → the
 *     monitor → password → secret ending).
 */
import { useEffect, useRef, useState } from 'react';
import { ARG_FRAGMENTS, getARG } from '../arg/ARGStoryline';
import { getGodMode } from '../arg/GodMode';
import { getEndingTicket } from '../arg/EndingTicket';

const VERT = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 v_uv;
  uniform vec2 u_res;
  uniform float u_time;
  uniform vec3 u_camPos;
  uniform vec3 u_camTarget;
  uniform float u_diskThickness;
  uniform float u_gravity;   // 1.0 = natural Schwarzschild strength
  uniform float u_aspect;
  uniform int u_stage;       // 0=hole, 1=neural, 2=asteroids, 3=planet, 4=house, 5=monitor

  // ---- Fully customizable black-hole look (Black Hole Studio) ----
  uniform float u_diskInner;
  uniform float u_diskOuter;
  uniform vec3 u_diskCol;      // primary accretion-disk colour
  uniform vec3 u_diskCol2;     // secondary / inner-disk colour
  uniform float u_swirlSpeed;
  uniform float u_swirlAmt;
  uniform float u_glow;        // photon-ring / halo strength
  uniform vec3 u_glowCol;
  uniform float u_bloom;       // bright bloom lift
  uniform float u_starDensity;
  uniform vec3 u_starCol;
  uniform float u_nebulaAmt;
  uniform vec3 u_nebulaCol;
  uniform float u_showDisk;    // 0/1 toggles
  uniform float u_showGlow;
  uniform float u_showStars;
  uniform float u_showNebula;
  uniform float u_fovScale;

  // ---- Wacky toggles + fluid + motion (Black Hole Studio, Part 2) ----
  uniform vec2 u_pan;         // screen-space pan — drag moves the hole across the screen
  uniform float u_cycleSpeed; // animated colour cycling (colour-changing version)
  uniform float u_fluid;      // fluid-turbulence swirl amount
  uniform float u_breath;     // horizon "breathing" pulsation
  uniform float u_bright;     // brightness / luminescence multiplier
  uniform float u_invert;     // 0/1 colour invert
  uniform float u_mono;       // 0..1 monochrome
  uniform float u_rainbow;    // rainbow hue sweep
  uniform float u_mirror;     // 0/1 mirror the screen
  uniform float u_vhs;        // 0..1 VHS scanlines
  uniform float u_flicker;    // 0..1 random flicker
  uniform float u_twist;      // 0..1 radial screen swirl
  uniform float u_glitch;     // 0..1 glitch bands

  const float PI = 3.14159265359;
  const float RS = 1.0;            // Schwarzschild radius (unit)
  const int MAX_STEPS = 260;
  const float MAX_DIST = 90.0;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float hash1(float n){ return fract(sin(n)*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  // Fractal Brownian motion — flowing, fluid-like turbulence for the disk.
  float fbm(vec2 p){
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p*2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  // Rotate a colour's hue by h radians (keeps luminance steady).
  vec3 hueShift(vec3 col, float h){
    vec3 k = vec3(0.57735, 0.57735, 0.57735);
    float c = cos(h), s = sin(h);
    return col*c + cross(k, col)*s + k*dot(k, col)*(1.0-c);
  }

  // Shared final colour-grading: luminescence, cycling, rainbow, invert,
  // monochrome, VHS, flicker + a soft vignette. Applied to every stage.
  vec3 grade(vec3 col, vec2 uv, vec2 ndc){
    if (u_cycleSpeed > 0.001) col = hueShift(col, u_time * u_cycleSpeed);
    if (u_rainbow > 0.001) col = hueShift(col, u_rainbow * (uv.x*6.28318 + u_time*0.5));
    col *= u_bright;
    if (u_invert > 0.5) col = vec3(1.0) - col;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(lum), u_mono);
    float scan = 0.5 + 0.5*sin(uv.y*220.0 - u_time*70.0);
    col *= 1.0 - u_vhs * 0.18 * (1.0 - scan);
    col *= 1.0 - u_flicker * 0.2 * step(0.985, hash(vec2(floor(u_time*24.0), 1.0)));
    col *= 0.6 + 0.4*smoothstep(1.3, 0.15, length(ndc));
    return col;
  }

  // A starfield sampled in the ray's final (escaped) direction.
  vec3 starfield(vec3 dir){
    vec2 p = vec2(dir.z, dir.x) * 60.0 + dir.y * 30.0;
    float star = step(1.0 - u_starDensity, hash(floor(p)));
    vec3 col = u_starCol * star * 0.9 * u_showStars;
    float neb = noise(dir.xy * 3.0 + vec2(dir.z, dir.z));
    col += u_nebulaCol * neb * u_nebulaAmt * u_showNebula;
    col += vec3(0.02,0.04,0.09);
    return col;
  }

  // ---- SDF helpers for the journey worlds ----
  float sdSphere(vec3 p, float r){ return length(p)-r; }
  float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
  float sdPlane(vec3 p, float y){ return p.y - y; }
  float sdSegment(vec3 p, vec3 a, vec3 b, float r){
    vec3 pa = p-a, ba = b-a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa-ba*h) - r;
  }

  // Neural network: a glowing 3D lattice of nodes + synapses.
  float mapNeural(vec3 p, out int mat){
    float d = 1e9;
    mat = 0;
    // Nodes on a grid.
    vec3 cell = floor(p*0.7 + 0.5);
    vec3 local = p*0.7 - cell;
    float node = sdSphere(local, 0.22);
    // Random node sizes / glow.
    float rnd = hash(cell.xy + vec2(cell.z*7.3, cell.z*7.3));
    if (node < d) { d = node; mat = (rnd > 0.5) ? 1 : 2; }
    // Synapse segments along each axis between neighbours.
    vec3 c2 = cell + vec3(1,0,0);
    vec3 l2 = p*0.7 - c2;
    float seg = sdSegment(p*0.7, cell, c2, 0.04);
    if (seg < d) { d = seg; mat = 3; }
    return d / 0.7;
  }

  // Asteroid field: drifting rocks.
  float mapAsteroids(vec3 p, out int mat){
    float d = 1e9;
    mat = 0;
    for (int i = 0; i < 14; i++) {
      float hx = hash1(float(i)*3.1);
      float hy = hash1(float(i)*7.7);
      float hz = hash1(float(i)*13.3);
      float hs = 0.2 + hash1(float(i)*29.0)*0.5;
      vec3 c = vec3((hx-0.5)*26.0, (hy-0.5)*26.0, (hz-0.5)*26.0);
      c.y += sin(u_time*0.3 + hx*6.28)*2.0;
      float r = sdSphere(p-c, hs);
      if (r < d) { d = r; mat = 4; }
    }
    return d;
  }

  // Minecraft square planet: a big blocky cube with grass top + dirt sides.
  float mapPlanet(vec3 p, out int mat){
    float d = sdBox(p, vec3(3.2,3.2,3.2));
    mat = 5;
    // Blocky micro-relief on the surface.
    float surf = max(d, -0.02);
    vec3 q = p / max(1e-4, length(p)) * 3.2; // point on cube surface dir
    // colour decided later by which face; return distance with small bump
    return surf + (noise(q.xy*8.0 + vec2(q.z*3.0, q.z*3.0)) - 0.5)*0.04;
  }

  vec3 rotZ(vec3 p, float a){ float c=cos(a),s=sin(a); return vec3(c*p.x-s*p.y, s*p.x+c*p.y, p.z); }
  vec3 rotY(vec3 p, float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z, p.y, -s*p.x+c*p.z); }

  // The House: a little house on a ground plane with a glowing window.
  float mapHouse(vec3 p, out int mat){
    float g = sdPlane(p, -1.4);
    float body = sdBox(p - vec3(0,-0.7,0), vec3(1.5,0.7,1.1));
    // pyramid-ish roof
    vec3 rp = p - vec3(0,0.7,0);
    float roof2 = max(abs(rp.y - 0.4), length(vec2(abs(rp.x), abs(rp.z)) - 1.1) - 0.9);
    float d = min(body, roof2);
    mat = 6;
    // glowing window
    float win = sdBox(p - vec3(0.0, -0.6, 1.05), vec3(0.4,0.4,0.06));
    if (win < d) { d = win; mat = 7; }
    d = min(d, g);
    return d;
  }

  // The Monitor: a floating computer screen.
  float mapMonitor(vec3 p, out int mat){
    float body = sdBox(p, vec3(1.4,1.0,0.2));
    float screen = sdBox(p - vec3(0,0,0.05), vec3(1.2,0.82,0.02));
    mat = 8;
    if (screen < body) { mat = 9; return screen; }
    return body;
  }

  // Unified scene map for journey stages.
  float mapWorld(vec3 p, out int mat){
    if (u_stage == 1) return mapNeural(p, mat);
    if (u_stage == 2) return mapAsteroids(p, mat);
    if (u_stage == 3) return mapPlanet(p, mat);
    if (u_stage == 4) return mapHouse(p, mat);
    return mapMonitor(p, mat);
  }

  // Void interior: you are inside the black hole. Looking OUTWARD (radially
  // away from the centre — back the way you came) shows the outside universe
  // through the hole you fell through; looking INWARD shows the deeper void.
  vec3 renderVoid(vec3 ro, vec3 rd){
    vec3 outDir = normalize(ro);              // from centre toward the camera
    float outLook = clamp(dot(rd, outDir), 0.0, 1.0);
    float inLook = clamp(dot(rd, -outDir), 0.0, 1.0);
    vec3 col = vec3(0.004, 0.002, 0.008);
    // Looking back out → see the universe (stars) through the exit.
    col += starfield(rd) * outLook * 1.2;
    // The exit accretion ring hangs on the horizon of the outward direction.
    vec3 perp = rd - outDir * dot(rd, outDir);
    float ring = smoothstep(0.12, 0.02, abs(length(perp) - 0.35)) * outLook;
    col += vec3(1.0, 0.72, 0.38) * ring * 0.9;
    // Looking deeper → the glowing way to the next world.
    float deep = smoothstep(0.12, 0.02, abs(length(perp) - 0.30)) * inLook;
    col += vec3(0.6, 0.9, 1.0) * deep * 0.9;
    // Faint dust / motes drifting in the void.
    float motes = noise(rd.xy * 14.0 + u_time * 0.1);
    col += vec3(0.3,0.5,0.7) * motes * 0.05;
    return col;
  }

  vec3 calcNormal(vec3 p){
    int m;
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
      mapWorld(p+e.xyy, m)-mapWorld(p-e.xyy, m),
      mapWorld(p+e.yxy, m)-mapWorld(p-e.yxy, m),
      mapWorld(p+e.yyx, m)-mapWorld(p-e.yyx, m)));
  }

  vec3 colourMat(int mat, vec3 p, vec3 n, vec3 ro){
    if (mat == 1) return vec3(0.3,0.8,1.0);       // cyan node
    if (mat == 2) return vec3(1.0,0.35,0.7);      // pink node
    if (mat == 3) return vec3(0.4,0.9,1.0)*0.5;   // synapse
    if (mat == 4) return vec3(0.45,0.4,0.38);     // asteroid rock
    if (mat == 5) {
      // Minecraft planet: grass top, dirt/stone sides, blue bottom
      if (n.y > 0.6) return vec3(0.42,0.76,0.26);
      if (n.y < -0.6) return vec3(0.16,0.2,0.5);
      if (abs(n.x) > 0.8) return vec3(0.54,0.36,0.2);
      return vec3(0.55,0.55,0.6);
    }
    if (mat == 6) return vec3(0.65,0.45,0.25);    // wood house
    if (mat == 7) return vec3(1.0,0.85,0.4);      // glowing window
    if (mat == 8) return vec3(0.12,0.12,0.15);    // monitor frame
    return vec3(0.05,0.2,0.25);                   // screen
  }

  vec3 renderWorld(vec3 ro, vec3 rd){
    vec3 col = vec3(0.0);
    float t = 0.0;
    int mat = 0;
    bool hit = false;
    for (int i = 0; i < 90; i++) {
      vec3 p = ro + rd*t;
      int m;
      float d = mapWorld(p, m);
      if (d < 0.0015) { hit = true; mat = m; break; }
      t += d;
      if (t > 40.0) break;
    }
    if (hit) {
      vec3 p = ro + rd*t;
      vec3 n = calcNormal(p);
      vec3 base = colourMat(mat, p, n, ro);
      vec3 lightDir = normalize(vec3(0.4,0.9,0.3));
      float diff = max(dot(n, lightDir), 0.0);
      float amb = 0.3 + 0.3*n.y;
      col = base*(amb + diff*1.0);
      // glow on nodes/synapse/window/screen
      if (mat == 1 || mat == 2) col += vec3(0.3,0.8,1.0)*0.7;
      if (mat == 3) col += vec3(0.4,0.9,1.0);
      if (mat == 7) col += vec3(1.0,0.85,0.4)*0.9;
      if (mat == 9) {
        // screen glow + scanlines + "EAOIN" flicker
        float scan = 0.5 + 0.5*sin(p.x*60.0 - u_time*3.0);
        col = vec3(0.1,0.6,0.4)*scan + vec3(0.05,0.3,0.2);
      }
      // Minecraft planet: add animated drifting clouds + a soft atmosphere.
      if (mat == 5) {
        vec3 q = normalize(p) * 3.4;
        float cloud = noise(vec2(q.x*2.0 + u_time*0.12, q.z*2.0 - u_time*0.08));
        cloud = smoothstep(0.45, 0.8, cloud);
        col += vec3(1.0, 1.0, 0.95) * cloud * 0.5;
        // faint blue atmosphere halo on the edges.
        float atm = pow(clamp(1.0 - dot(n, normalize(ro - p)), 0.0, 1.0), 3.0);
        col += vec3(0.3,0.55,1.0) * atm * 0.6;
      }
      // Asteroid sparkle: warm rim glow.
      if (mat == 4) {
        float rim = pow(clamp(1.0 - dot(n, normalize(ro - p)), 0.0, 1.0), 2.0);
        col += vec3(1.0,0.7,0.4) * rim * 0.5;
      }
    } else {
      col = starfield(rd);
    }
    // Bloom lift so every world glows.
    col += col*col*0.35;
    return col;
  }

  void main(){
    vec2 uv = v_uv;
    // ---- Wacky screen-space tricks: mirror, twist swirl, glitch bands ----
    if (u_mirror > 0.5) uv.x = 1.0 - uv.x;
    vec2 uvC = uv - 0.5;                          // -0.5..0.5
    float rad = length(uvC) * 2.0;
    float tw = u_twist * rad * 1.2;
    float ctw = cos(tw), stw = sin(tw);
    uvC = vec2(ctw*uvC.x - stw*uvC.y, stw*uvC.x + ctw*uvC.y);
    // Drag moves the hole across the screen (screen-space pan).
    uvC += u_pan;
    // Glitch bands flicker random horizontal slices.
    uvC.x += (u_glitch * step(0.985, hash(vec2(floor(u_time*16.0), floor(uvC.y*48.0)))) - 0.5*u_glitch) * 0.1;
    uv = uvC + 0.5;
    vec2 ndc = uvC * vec2(u_aspect, 1.0);

    // Build a right-handed camera basis from eye→target.
    vec3 fwd = normalize(u_camTarget - u_camPos);
    vec3 right = normalize(cross(fwd, vec3(0.0,1.0,0.0)));
    vec3 up = cross(right, fwd);
    float fov = 1.35 * u_fovScale; // ~1/tan(fov/2); bigger = wider
    vec3 dir = normalize(ndc.x*right + ndc.y*up + fwd*fov);

    vec3 col;
    // ---- Void interior (stage 6): inside the black hole ----
    if (u_stage == 6) {
      col = renderVoid(u_camPos, dir);
    }
    // ---- Journey worlds: render a distinct scene per stage ----
    else if (u_stage >= 1) {
      col = renderWorld(u_camPos, dir);
    }
    // ---- Black hole: ray-march with gravitational lensing ----
    else {
      vec3 pos = u_camPos;
      vec3 ray = dir;
      col = vec3(0.0);
      bool escaped = false;
      float t = 0.0;
      for (int i = 0; i < MAX_STEPS; i++) {
        float r = length(pos);
        // Horizon "breathes" — pulses when the breath toggle is on.
        float h = RS * u_gravity * (1.0 + u_breath * 0.35 * sin(u_time * 2.0));

        float stepLen = clamp((r - h) * 0.4, 0.012, 1.4);
        if (r < h * 1.25) stepLen = 0.01;

        // Gravitational deflection: bend the ray toward the hole ~ 1/r^2.
        vec3 gAcc = -h * 0.8 / max(r*r, 1e-4) * (pos / max(r, 1e-4));
        ray = normalize(ray + gAcc * stepLen * 0.5);

        // Accretion disk with extra glow (fluid turbulence mixes in).
        float diskRad = length(pos.xz);
        float y = pos.y;
        if (abs(y) < u_diskThickness && diskRad > u_diskInner && diskRad < u_diskOuter) {
          float innerT = 1.0 - (diskRad - u_diskInner)/max(u_diskOuter - u_diskInner, 1e-4);
          float swirl = 0.5 + 0.5*noise(vec2(atan(pos.z,pos.x)*4.0, diskRad*1.2) + u_time*u_swirlSpeed);
          float flow = fbm(pos.xz*0.7 + vec2(u_time*0.3, u_time*0.18));
          swirl = mix(swirl, 0.5 + 0.5*flow, u_fluid);
          float edge = smoothstep(0.0, 1.0, innerT);
          vec3 diskCol = u_diskCol*edge + u_diskCol2*u_swirlAmt;
          float thickFade = 1.0 - abs(y)/max(u_diskThickness, 1e-4);
          col += diskCol * swirl * thickFade * (0.6 + innerT*0.8) * 0.7 * u_showDisk;
        }

        // Photon-ring / bloom halo around the horizon for extra glow.
        float rglow = max(r - h, 0.0);
        col += u_glowCol * exp(-rglow*8.0) * u_glow * u_showGlow;

        pos += ray * stepLen;
        t += stepLen;

        if (r < h) {
          col += vec3(1.0,0.95,0.85) * smoothstep(h, h*1.5, r) * 0.35;
          col *= 0.0;
          escaped = false;
          break;
        }
        if (t > MAX_DIST) { escaped = true; break; }
      }

      if (escaped || t >= MAX_DIST) {
        col += starfield(ray);
      }
      // Glow bloom / lift so the hole reads bright and luminous.
      col += col*col*u_bloom;
    }

    col = grade(col, uv, ndc);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** The ARG note hidden inside the singularity journey. */
const SINGULARITY_NOTE = [
  'You are close now.',
  'The key is EAOIN — four letters worn into the world.',
  'Fragments hide in every dimension. Find them, assemble the key,',
  'and the house inside the planet will open its monitor.',
  '',
  '— the Cosmic Girl',
];

/** Deep-journey stages: zoom through the hole and past each layer. */
const JOURNEY_STAGES = [
  { id: 'neural', title: 'Neural Network', desc: 'Connections of brains pulse as you fall through the singularity.', zoom: 0.35 },
  { id: 'asteroids', title: 'Asteroid Field', desc: 'Dust and rock scream past the lens.', zoom: 0.5 },
  { id: 'planet', title: 'The Square Planet', desc: 'A Minecraft world, blocky and alive, hangs below.', zoom: 0.68 },
  { id: 'house', title: 'The House', desc: 'At the very beginning of the world — a single house.', zoom: 0.82 },
  { id: 'monitor', title: 'The Monitor', desc: 'A password prompt glows. Enter the key to continue.', zoom: 0.96 },
] as const;

interface Camera {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** The order of areas you travel through: black hole → void → neural → … → monitor. */
const STAGE_ORDER = [0, 6, 1, 2, 3, 4, 5] as const;

/**
 * How deep you must be before flying toward the centre (while looking STRAIGHT
 * into it) advances to the next area. Making this small means entering the
 * black hole doesn't snap you to the void/next world — you have to fly really
 * deep and look directly into the centre to fall through.
 */
export const PORTAL_IN_RADIUS = 0.55;
/** Radius at which flying to the centre and looking away retreats a stage. */
export const PORTAL_BACK_RADIUS = 0.6;
/** How directly you must be looking at the centre to go deeper (near-straight). */
export const LOOK_IN = 0.7;
/** How directly you must be looking away to go back. */
export const LOOK_OUT = -0.5;

/** Advance to the next area in the journey order. */
export function nextStageOf(stage: number): number {
  const i = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return stage;
  return STAGE_ORDER[i + 1];
}

/** Retreat to the previous area in the journey order. */
export function prevStageOf(stage: number): number {
  const i = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  if (i <= 0) return stage;
  return STAGE_ORDER[i - 1];
}

/**
 * Portal decision: 1 = advance deeper, -1 = retreat, 0 = stay.
 * Only happens near the centre AND while looking into (advance) or away (retreat)
 * from it — so moving sideways / up / down never pops you to the next area.
 */
export function portalTransition(dist: number, lookDot: number): number {
  if (dist < PORTAL_IN_RADIUS && lookDot > LOOK_IN) return 1;
  if (dist < PORTAL_BACK_RADIUS && lookDot < LOOK_OUT) return -1;
  return 0;
}

/**
 * A comfortable spawn for each area so you start facing the world. The void is
 * a special case: you spawn just inside the hole looking toward the centre so
 * you can turn around and see the universe back out.
 */
export function viewDistForStage(stage: number): number {
  switch (stage) {
    case 1: return 9;   // neural lattice
    case 2: return 13;  // asteroid field
    case 3: return 8;   // Minecraft planet (planet is big — pull back)
    case 4: return 6;   // house
    case 5: return 5;   // monitor
    default: return 4;  // black hole external
  }
}

function spawnForStage(stage: number): Camera {
  if (stage === 6) return { x: 0, y: 0, z: -9, yaw: 0, pitch: 0 }; // void — far out, look back at the hole
  const d = viewDistForStage(stage);
  return { x: 0, y: d * 0.25, z: -d, yaw: 0, pitch: 0.2 };
}

/** Every knobbly bit of the black hole you can tune in the Studio. */
export interface BlackHoleOpts {
  diskThickness: number;
  diskInner: number;
  diskOuter: number;
  gravity: number;
  swirlSpeed: number;
  swirlAmt: number;
  glow: number;
  bloom: number;
  starDensity: number;
  nebulaAmt: number;
  fov: number;
  camSpeed: number;
  diskCol: string;
  diskCol2: string;
  glowCol: string;
  starCol: string;
  nebulaCol: string;
  showDisk: boolean;
  showGlow: boolean;
  showStars: boolean;
  showNebula: boolean;
  resScale: number; // render scale × devicePixelRatio (higher = sharper)
  // Wacky / fluid / motion (Part 2)
  cycleSpeed: number;  // animated colour cycling (0 = off)
  fluid: number;       // fluid-turbulence swirl 0..1
  breath: number;      // horizon breathing 0..1
  bright: number;      // brightness / luminescence multiplier
  invert: boolean;     // colour invert
  mono: boolean;       // monochrome
  rainbow: number;     // rainbow sweep 0..1
  mirror: boolean;     // mirror the screen
  vhs: number;         // VHS scanlines 0..1
  flicker: number;     // random flicker 0..1
  twist: number;       // radial screen swirl 0..1
  glitch: number;      // glitch bands 0..1
}

const DEFAULT_OPTS: BlackHoleOpts = {
  diskThickness: 0.35,
  diskInner: 2.6,
  diskOuter: 6.0,
  gravity: 1.0,
  swirlSpeed: 0.6,
  swirlAmt: 1.0,
  glow: 0.35,
  bloom: 0.4,
  starDensity: 0.98,
  nebulaAmt: 0.25,
  fov: 1.0,
  camSpeed: 2.6,
  diskCol: '#ff9d4d',
  diskCol2: '#993d1f',
  glowCol: '#ffd9a0',
  starCol: '#b3d9ff',
  nebulaCol: '#3a1066',
  showDisk: true,
  showGlow: true,
  showStars: true,
  showNebula: true,
  resScale: 1.5,
  cycleSpeed: 0,
  fluid: 0,
  breath: 0,
  bright: 1,
  invert: false,
  mono: false,
  rainbow: 0,
  mirror: false,
  vhs: 0,
  flicker: 0,
  twist: 0,
  glitch: 0,
};

/** Preset looks for the black hole — one click applies a full mood. */
export interface BlackHolePreset { id: string; label: string; emoji: string; opts: Partial<BlackHoleOpts>; }

/** The original signature looks — always pinned at the top of the library. */
const FEATURED_PRESETS: BlackHolePreset[] = [
  { id: 'classic', label: 'Classic', emoji: '🕳', opts: { diskCol: '#ff9d4d', diskCol2: '#993d1f', glowCol: '#ffd9a0', starCol: '#b3d9ff', nebulaCol: '#3a1066', gravity: 1.0, diskThickness: 0.35, glow: 0.35, bloom: 0.4, swirlAmt: 1.0 } },
  { id: 'interstellar', label: 'Interstellar', emoji: '🌌', opts: { diskCol: '#ff9d4d', diskCol2: '#c0392b', glowCol: '#ffe7b0', starCol: '#ffffff', nebulaCol: '#141a38', gravity: 1.0, diskThickness: 0.2, glow: 0.5, bloom: 0.5, swirlSpeed: 0.7, swirlAmt: 1.0 } },
  { id: 'gargantua', label: 'Gargantua', emoji: '🔥', opts: { diskCol: '#ffb86b', diskCol2: '#7a2a1a', glowCol: '#ffe7b0', starCol: '#cfd8ff', nebulaCol: '#101c40', gravity: 1.25, diskThickness: 0.16, glow: 0.6, bloom: 0.5, swirlSpeed: 0.5 } },
  { id: 'nebula', label: 'Nebula', emoji: '🪐', opts: { diskCol: '#7f6bff', diskCol2: '#ff4d9a', glowCol: '#d9a8ff', starCol: '#e6e6ff', nebulaCol: '#3a1a5a', gravity: 1.0, diskThickness: 0.3, glow: 0.7, bloom: 0.7, nebulaAmt: 0.5, swirlAmt: 1.2 } },
  { id: 'void', label: 'Void', emoji: '⚫', opts: { diskCol: '#4dffc4', diskCol2: '#0a3d33', glowCol: '#9fffd8', starCol: '#ffffff', nebulaCol: '#05121a', gravity: 1.0, diskThickness: 0.12, glow: 0.4, bloom: 0.3, starDensity: 0.5, nebulaAmt: 0.15 } },
  { id: 'blood', label: 'Blood', emoji: '🔴', opts: { diskCol: '#ff4d4d', diskCol2: '#5a0000', glowCol: '#ffb0a0', starCol: '#ffe0e0', nebulaCol: '#2a0505', gravity: 0.9, diskThickness: 0.28, glow: 0.5, bloom: 0.5 } },
  { id: 'emerald', label: 'Emerald', emoji: '💚', opts: { diskCol: '#4dffb0', diskCol2: '#005a2e', glowCol: '#b0ffdd', starCol: '#e0fff0', nebulaCol: '#05201a', gravity: 1.0, diskThickness: 0.3, glow: 0.5, bloom: 0.5 } },
  { id: 'sunrise', label: 'Sunrise', emoji: '🌅', opts: { diskCol: '#ffd14d', diskCol2: '#ff5a3c', glowCol: '#fff3c0', starCol: '#ffffff', nebulaCol: '#3a2026', gravity: 0.95, diskThickness: 0.25, glow: 0.55, bloom: 0.55 } },
];

/** Rotate a hex colour's hue by `deg` degrees (exact RGB hue rotation). */
function rotRGB(hex: string, deg: number): string {
  const [r, g, b] = hexToRgb(hex);
  const rad = (deg * Math.PI) / 180;
  const k = 1 / Math.sqrt(3);
  const c = Math.cos(rad), s = Math.sin(rad);
  const dotk = (r + g + b) * k;
  const cx = k * b - k * g, cy = k * r - k * b, cz = k * g - k * r;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const nr = clamp01(r * c + cx * s + k * dotk * (1 - c));
  const ng = clamp01(g * c + cy * s + k * dotk * (1 - c));
  const nb = clamp01(b * c + cz * s + k * dotk * (1 - c));
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

/** 12 hue colour-names used to name each generated variant. */
const HUE_NAMES = [
  { name: 'Scarlet', angle: 0 }, { name: 'Ember', angle: 30 }, { name: 'Solar', angle: 60 },
  { name: 'Verdant', angle: 110 }, { name: 'Jade', angle: 150 }, { name: 'Cyan', angle: 180 },
  { name: 'Azure', angle: 210 }, { name: 'Cobalt', angle: 240 }, { name: 'Violet', angle: 275 },
  { name: 'Magenta', angle: 300 }, { name: 'Rose', angle: 330 }, { name: 'Crimson', angle: 15 },
];

/** Personality families — each spawns a full hue family of black holes. */
const THEMES: { name: string; emoji: string; off: number; diskCol: string; diskCol2: string; glowCol: string; starCol: string; nebulaCol: string; extra?: Partial<BlackHoleOpts> }[] = [
  { name: 'Flare', emoji: '☀️', off: 0, diskCol: '#ff9d4d', diskCol2: '#993d1f', glowCol: '#ffd9a0', starCol: '#ffffff', nebulaCol: '#3a1066', extra: { bloom: 0.55, glow: 0.5 } },
  { name: 'Vortex', emoji: '🌀', off: 40, diskCol: '#7f6bff', diskCol2: '#ff4d9a', glowCol: '#d9a8ff', starCol: '#e6e6ff', nebulaCol: '#141a38', extra: { swirlSpeed: 1.2, swirlAmt: 1.3, bloom: 0.7 } },
  { name: 'Ember', emoji: '🔥', off: 0, diskCol: '#ff4d4d', diskCol2: '#5a0000', glowCol: '#ffb0a0', starCol: '#ffe0e0', nebulaCol: '#2a0505', extra: { glow: 0.5, bloom: 0.5 } },
  { name: 'Jade', emoji: '💎', off: 130, diskCol: '#4dffb0', diskCol2: '#005a2e', glowCol: '#b0ffdd', starCol: '#e0fff0', nebulaCol: '#05201a' },
  { name: 'Solar', emoji: '🌅', off: 55, diskCol: '#ffd14d', diskCol2: '#ff5a3c', glowCol: '#fff3c0', starCol: '#ffffff', nebulaCol: '#3a2026' },
  { name: 'Abyss', emoji: '🕳', off: 170, diskCol: '#4dffc4', diskCol2: '#0a3d33', glowCol: '#9fffd8', starCol: '#ffffff', nebulaCol: '#05121a', extra: { starDensity: 0.5, nebulaAmt: 0.15 } },
  { name: 'Serpent', emoji: '🐍', off: 90, diskCol: '#b0ff4d', diskCol2: '#3c5a00', glowCol: '#e0ffb0', starCol: '#f0ffe0', nebulaCol: '#1a2005', extra: { fluid: 0.4, swirlSpeed: 0.9 } },
  { name: 'Ghost', emoji: '👻', off: 250, diskCol: '#c9c4ff', diskCol2: '#5a4d9a', glowCol: '#e6e0ff', starCol: '#f2f0ff', nebulaCol: '#16122e', extra: { glow: 0.6, bloom: 0.55 } },
  { name: 'Photon', emoji: '✨', off: 200, diskCol: '#4dd9ff', diskCol2: '#005a99', glowCol: '#b0f2ff', starCol: '#e6fbff', nebulaCol: '#051f2a', extra: { glow: 0.55 } },
  { name: 'Tide', emoji: '🌊', off: 215, diskCol: '#4d7fff', diskCol2: '#0a1f5a', glowCol: '#b0c9ff', starCol: '#e6edff', nebulaCol: '#050f2a', extra: { fluid: 0.6, swirlSpeed: 0.6 } },
  { name: 'Comet', emoji: '☄️', off: 20, diskCol: '#ffd9b0', diskCol2: '#7a4d1f', glowCol: '#ffe6cc', starCol: '#ffffff', nebulaCol: '#2a1a0a', extra: { glow: 0.6, bloom: 0.6 } },
  { name: 'Eclipse', emoji: '🌑', off: 270, diskCol: '#a8a8b8', diskCol2: '#33334a', glowCol: '#e0e0ee', starCol: '#ffffff', nebulaCol: '#0a0a14', extra: { nebulaAmt: 0.3 } },
];

/** Wacky / colour-changing / fluid black-hole presets. */
const WACKY_PRESETS: BlackHolePreset[] = [
  { id: 'pulse', label: 'Pulse', emoji: '💫', opts: { diskCol: '#ff9d4d', diskCol2: '#c0392b', cycleSpeed: 1.6 } },
  { id: 'rainbow', label: 'Rainbow', emoji: '🌈', opts: { diskCol: '#ff4d4d', diskCol2: '#4dff4d', glowCol: '#4d4dff', rainbow: 1, cycleSpeed: 0.8 } },
  { id: 'liquid', label: 'Liquid', emoji: '💧', opts: { diskCol: '#4dd9ff', diskCol2: '#005a99', fluid: 1, swirlSpeed: 0.4, glow: 0.5 } },
  { id: 'breathe', label: 'Breathe', emoji: '🫧', opts: { diskCol: '#4dffc4', diskCol2: '#0a3d33', breath: 1, glow: 0.5 } },
  { id: 'mono', label: 'Monochrome', emoji: '⬛', opts: { diskCol: '#c9c9d6', diskCol2: '#66667a', mono: true, starCol: '#ffffff' } },
  { id: 'negative', label: 'Negative', emoji: '🔄', opts: { diskCol: '#ff9d4d', diskCol2: '#c0392b', invert: true, bright: 1.2 } },
  { id: 'mirror', label: 'Mirror', emoji: '🪞', opts: { diskCol: '#7f6bff', diskCol2: '#ff4d9a', mirror: true } },
  { id: 'vhs', label: 'VHS', emoji: '📼', opts: { diskCol: '#ff5a3c', diskCol2: '#993d1f', vhs: 1, glitch: 0.3 } },
  { id: 'glitch', label: 'Glitch', emoji: '📡', opts: { diskCol: '#4dd9ff', diskCol2: '#ff4d4d', glitch: 1, flicker: 0.6 } },
  { id: 'twister', label: 'Twister', emoji: '🌪', opts: { diskCol: '#b0ff4d', diskCol2: '#005a99', twist: 1, swirlSpeed: 1.5 } },
  { id: 'neon', label: 'Neon', emoji: '🟢', opts: { diskCol: '#39ff88', diskCol2: '#00c8ff', glowCol: '#b0ffdd', bright: 1.4, bloom: 1.2, cycleSpeed: 0.6, nebulaAmt: 0.6 } },
  { id: 'chaos', label: 'Chaos', emoji: '🎇', opts: { diskCol: '#ff4d4d', diskCol2: '#4d4dff', flicker: 1, glitch: 0.5, cycleSpeed: 2.2, fluid: 0.5, vhs: 0.4 } },
];

function buildPresetLibrary(): BlackHolePreset[] {
  const generated: BlackHolePreset[] = [];
  for (const theme of THEMES) {
    for (const h of HUE_NAMES) {
      const deg = (h.angle + theme.off) % 360;
      generated.push({
        id: `bh_${theme.name.toLowerCase()}_${h.name.toLowerCase()}`,
        label: `${h.name} ${theme.name}`,
        emoji: theme.emoji,
        opts: {
          diskCol: rotRGB(theme.diskCol, deg),
          diskCol2: rotRGB(theme.diskCol2, deg),
          glowCol: rotRGB(theme.glowCol, deg),
          starCol: rotRGB(theme.starCol, deg),
          nebulaCol: rotRGB(theme.nebulaCol, deg),
          ...theme.extra,
        },
      });
    }
  }
  return [...FEATURED_PRESETS, ...generated, ...WACKY_PRESETS];
}

/** The full black-hole library: 8 featured + 144 generated + 12 wacky = 164. */
export const BLACK_HOLE_PRESETS: BlackHolePreset[] = buildPresetLibrary();

/** A single slider/toggle/colour control entry rendered inside the Studio panels. */
export interface StudioControl {
  key: keyof BlackHoleOpts;
  label: string;
  kind: 'slider' | 'color' | 'toggle';
  min?: number;
  max?: number;
  step?: number;
}

/** The "tons of bars" on the left — every knob the black hole can feel. */
export const STUDIO_TUNES: StudioControl[] = [
  { key: 'diskThickness', label: 'Disk thickness', kind: 'slider', min: 0.04, max: 0.9, step: 0.01 },
  { key: 'diskInner', label: 'Disk inner radius', kind: 'slider', min: 0.5, max: 4.5, step: 0.1 },
  { key: 'diskOuter', label: 'Disk outer radius', kind: 'slider', min: 3, max: 9, step: 0.1 },
  { key: 'gravity', label: 'Gravity strength', kind: 'slider', min: 0.2, max: 2.4, step: 0.05 },
  { key: 'swirlSpeed', label: 'Swirl speed', kind: 'slider', min: 0, max: 3, step: 0.05 },
  { key: 'swirlAmt', label: 'Swirl amount', kind: 'slider', min: 0, max: 2.5, step: 0.05 },
  { key: 'glow', label: 'Photon glow', kind: 'slider', min: 0, max: 1.5, step: 0.01 },
  { key: 'bloom', label: 'Bloom', kind: 'slider', min: 0, max: 1.5, step: 0.01 },
  { key: 'starDensity', label: 'Star density', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'nebulaAmt', label: 'Nebula glow', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'fov', label: 'Field of view', kind: 'slider', min: 0.5, max: 2, step: 0.05 },
  { key: 'camSpeed', label: 'Flight speed', kind: 'slider', min: 1, max: 8, step: 0.1 },
];

/** Wacky & fluid knobs — colour-changing, fluid sim, luminescence, glitch. */
export const STUDIO_WACKY: StudioControl[] = [
  { key: 'cycleSpeed', label: 'Colour cycle', kind: 'slider', min: 0, max: 3, step: 0.05 },
  { key: 'fluid', label: 'Fluid swirl', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'breath', label: 'Breathing', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'bright', label: 'Luminescence', kind: 'slider', min: 0.2, max: 2.4, step: 0.05 },
  { key: 'rainbow', label: 'Rainbow', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'vhs', label: 'VHS scanlines', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'flicker', label: 'Flicker', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'twist', label: 'Screen swirl', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'glitch', label: 'Glitch', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'invert', label: 'Invert', kind: 'toggle' },
  { key: 'mono', label: 'Monochrome', kind: 'toggle' },
  { key: 'mirror', label: 'Mirror', kind: 'toggle' },
];

/** Parse '#rrggbb' into [r,g,b] in 0..1. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---- Throw / Grab items physics --------------------------------------------

/** A thing you can throw into the black hole and watch get spaghettified. */
interface Item {
  id: number;
  emoji: string;
  color: string;
  size: number;
  x: number; y: number;   // screen-space position (canvas CSS px)
  vx: number; vy: number; // velocity (px/s)
  grabbed: boolean;
  stretch: number;        // spaghettification stretch
  kind: 'item' | 'particle';
  life?: number;          // particle lifetime (s)
}

/** Random junk you can grab and fling into the hole — fruit, rockets, more. */
const ITEM_TYPES: { e: string; c: string }[] = [
  { e: '🍎', c: '#ff5252' }, { e: '🍌', c: '#ffd54f' }, { e: '🍉', c: '#69f0ae' },
  { e: '🍊', c: '#ffab40' }, { e: '🍇', c: '#b388ff' }, { e: '🍑', c: '#ff8a80' },
  { e: '🍓', c: '#ff5252' }, { e: '🍍', c: '#ffca28' }, { e: '🥕', c: '#ff7043' },
  { e: '🚀', c: '#ff9d4d' }, { e: '🪨', c: '#b0bec5' }, { e: '🪐', c: '#ffd54f' },
  { e: '💎', c: '#4dd9ff' }, { e: '⚙️', c: '#cfd8dc' }, { e: '🧀', c: '#ffe082' },
  { e: '🥚', c: '#fff59d' }, { e: '🍦', c: '#f48fb1' }, { e: '🔥', c: '#ff5252' },
  { e: '⛏️', c: '#a1887f' }, { e: '🍩', c: '#ffcc80' }, { e: '🌍', c: '#69f0ae' },
  { e: '🛰️', c: '#9fa8da' }, { e: '🦴', c: '#efebe9' }, { e: '🎂', c: '#f8bbd0' },
];

/** Spawn one item into the physics sim. */
function makeItem(id: number, x: number, y: number, vx: number, vy: number, emoji?: string): Item {
  const t = emoji ? { e: emoji, c: '#c4a8ff' } : ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  return { id, emoji: t.e, color: t.c, size: 20 + Math.random() * 12, x, y, vx, vy, grabbed: false, stretch: 1, kind: 'item' };
}

export default function Singularity({ onBack, onExit }: { onBack?: () => void; onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [journey, setJourney] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [password, setPassword] = useState('');
  const [secretEnding, setSecretEnding] = useState(false);
  const [fragments, setFragments] = useState(() => getARG().getState().collected);
  const [argMsg, setArgMsg] = useState<string | null>(null);
  const [opts, setOpts] = useState<BlackHoleOpts>(DEFAULT_OPTS);
  const optsRef = useRef(DEFAULT_OPTS);
  optsRef.current = opts;
  const [tuneOpen, setTuneOpen] = useState(true);      // left studio panel
  const [presetOpen, setPresetOpen] = useState(true);  // right studio panel
  const [dragMode, setDragMode] = useState<'look' | 'move'>('look');
  const dragModeRef = useRef<'look' | 'move'>('look');
  dragModeRef.current = dragMode;

  const camRef = useRef<Camera>({ x: 0, y: 0, z: -4, yaw: 0, pitch: 0.2 });
  const stageRef = useRef(0);
  const setStageIdxProxy = useRef<(s: number) => void>(() => {});
  /** Tracks held movement keys (WASD / arrows / Space / Shift). */
  const keysRef = useRef<Set<string>>(new Set());
  /** Accumulates scroll input so the render loop can apply it. */
  const scrollAccumRef = useRef(0);
  /** Screen-space pan offset — dragging in "move" mode slides the hole around. */
  const panRef = useRef({ x: 0, y: 0 });

  // Throw / Grab items physics
  const [itemsMode, setItemsMode] = useState(false);
  const itemsModeRef = useRef(false);
  itemsModeRef.current = itemsMode;
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<Item[]>([]);
  const itemIdRef = useRef(1);
  const aimRef = useRef({ active: false, sx: 0, sy: 0, cx: 0, cy: 0 });
  const grabRef = useRef<{ idx: number; lx: number; ly: number }>({ idx: -1, lx: 0, ly: 0 });

  const patchOpts = (patch: Partial<BlackHoleOpts>) => setOpts((o) => ({ ...o, ...patch }));
  const applyPreset = (id: string) => {
    const p = BLACK_HOLE_PRESETS.find((x) => x.id === id);
    if (p) setOpts((o) => ({ ...o, ...p.opts }));
  };
  const applyRandomPreset = () => {
    const p = BLACK_HOLE_PRESETS[Math.floor(Math.random() * BLACK_HOLE_PRESETS.length)];
    if (p) setOpts((o) => ({ ...o, ...p.opts }));
  };
  const resetView = () => {
    panRef.current = { x: 0, y: 0 };
    const s = spawnForStage(stageRef.current);
    Object.assign(camRef.current, s);
  };

  const spawnItem = (x: number, y: number, vx: number, vy: number, emoji?: string) => {
    const it = makeItem(itemIdRef.current++, x, y, vx, vy, emoji);
    itemsRef.current.push(it);
  };
  const spawnItemRef = useRef(spawnItem);
  spawnItemRef.current = spawnItem;

  const spawnRandomItem = () => {
    const w = window.innerWidth, h = window.innerHeight;
    const cx = w / 2 + panRef.current.x * w;
    const cy = h / 2 + panRef.current.y * h;
    const ang = Math.random() * Math.PI * 2;
    const r = 130 + Math.random() * 190;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    // tangential + random kick so they swing around the hole like meteors
    const vx = -Math.sin(ang) * 55 + (Math.random() - 0.5) * 80;
    const vy = Math.cos(ang) * 55 + (Math.random() - 0.5) * 80;
    spawnItemRef.current(x, y, vx, vy);
  };
  const clearItems = () => { itemsRef.current = []; };

  const collectFragment = (dimension: string) => {
    const frag = getARG().collect(dimension);
    if (frag) {
      setFragments(getARG().getState().collected);
      setArgMsg(`🔎 Fragment found: ${frag.emoji} ${frag.title} — "${frag.text}"`);
    } else {
      setArgMsg('This fragment is already yours.');
    }
    window.setTimeout(() => setArgMsg(null), 4000);
  };

  // --- Camera INPUT effect (always runs, independent of WebGL) ------------
  // Free-fly 3D camera: WASD / arrows move forward/back/strafe, Space/Shift
  // move up/down, scroll flies forward/back, and dragging LOOKS around in any
  // direction. The stage only changes when you fly into the centre and look
  // into it (deeper) or look away (back) — moving sideways/up/down never pops
  // you to the next area.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drag = { down: false, lastX: 0, lastY: 0 };
    const pt = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const findItem = (x: number, y: number, rad: number): number => {
      const its = itemsRef.current;
      for (let i = its.length - 1; i >= 0; i--) {
        const it = its[i];
        if (it.kind === 'item' && Math.hypot(it.x - x, it.y - y) < rad) return i;
      }
      return -1;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (itemsModeRef.current) {
        const p = pt(e);
        const i = findItem(p.x, p.y, 46);
        if (i >= 0) {
          const it = itemsRef.current[i];
          it.grabbed = true;
          grabRef.current = { idx: i, lx: p.x, ly: p.y };
        } else {
          aimRef.current = { active: true, sx: p.x, sy: p.y, cx: p.x, cy: p.y };
        }
        return;
      }
      drag.down = true; drag.lastX = e.clientX; drag.lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (itemsModeRef.current) {
        const p = pt(e);
        const g = grabRef.current;
        if (g.idx >= 0 && g.idx < itemsRef.current.length) {
          const it = itemsRef.current[g.idx];
          const dt = 1 / 60;
          it.vx = (p.x - g.lx) / dt; it.vy = (p.y - g.ly) / dt;
          it.x = p.x; it.y = p.y;
          g.lx = p.x; g.ly = p.y;
        } else if (aimRef.current.active) {
          aimRef.current.cx = p.x; aimRef.current.cy = p.y;
        }
        return;
      }
      if (!drag.down) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX; drag.lastY = e.clientY;
      if (dragModeRef.current === 'move') {
        // Move the black hole across the screen (screen-space pan).
        panRef.current.x = Math.max(-1.0, Math.min(1.0, panRef.current.x + (dx / Math.max(1, window.innerWidth)) * 1.0));
        panRef.current.y = Math.max(-0.7, Math.min(0.7, panRef.current.y - (dy / Math.max(1, window.innerHeight)) * 1.0));
        return;
      }
      const c = camRef.current;
      c.yaw -= dx * 0.006;
      c.pitch = Math.max(-1.35, Math.min(1.35, c.pitch + dy * 0.006));
    };
    const onPointerUp = (e: PointerEvent) => {
      if (itemsModeRef.current) {
        const p = pt(e);
        const g = grabRef.current;
        if (g.idx >= 0 && g.idx < itemsRef.current.length) {
          const it = itemsRef.current[g.idx];
          it.grabbed = false;
          grabRef.current = { idx: -1, lx: 0, ly: 0 };
        } else if (aimRef.current.active) {
          const dx = p.x - aimRef.current.sx;
          const dy = p.y - aimRef.current.sy;
          spawnItemRef.current(aimRef.current.sx, aimRef.current.sy, dx * 8, dy * 8);
          aimRef.current.active = false;
        }
        return;
      }
      drag.down = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollAccumRef.current += e.deltaY * 0.02;
    };
    const keyOf = (k: string) => k.toLowerCase();
    const onKeyDown = (e: KeyboardEvent) => keysRef.current.add(keyOf(e.key));
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(keyOf(e.key));
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('[Singularity] shader compile:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const prog = gl.createProgram();
    const vert = compile(gl.VERTEX_SHADER, VERT);
    const frag = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag || !prog) return;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[Singularity] shader link failed:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {
      res: gl.getUniformLocation(prog, 'u_res'),
      time: gl.getUniformLocation(prog, 'u_time'),
      camPos: gl.getUniformLocation(prog, 'u_camPos'),
      camTarget: gl.getUniformLocation(prog, 'u_camTarget'),
      diskThickness: gl.getUniformLocation(prog, 'u_diskThickness'),
      gravity: gl.getUniformLocation(prog, 'u_gravity'),
      aspect: gl.getUniformLocation(prog, 'u_aspect'),
      stage: gl.getUniformLocation(prog, 'u_stage'),
      diskInner: gl.getUniformLocation(prog, 'u_diskInner'),
      diskOuter: gl.getUniformLocation(prog, 'u_diskOuter'),
      diskCol: gl.getUniformLocation(prog, 'u_diskCol'),
      diskCol2: gl.getUniformLocation(prog, 'u_diskCol2'),
      swirlSpeed: gl.getUniformLocation(prog, 'u_swirlSpeed'),
      swirlAmt: gl.getUniformLocation(prog, 'u_swirlAmt'),
      glow: gl.getUniformLocation(prog, 'u_glow'),
      glowCol: gl.getUniformLocation(prog, 'u_glowCol'),
      bloom: gl.getUniformLocation(prog, 'u_bloom'),
      starDensity: gl.getUniformLocation(prog, 'u_starDensity'),
      starCol: gl.getUniformLocation(prog, 'u_starCol'),
      nebulaAmt: gl.getUniformLocation(prog, 'u_nebulaAmt'),
      nebulaCol: gl.getUniformLocation(prog, 'u_nebulaCol'),
      showDisk: gl.getUniformLocation(prog, 'u_showDisk'),
      showGlow: gl.getUniformLocation(prog, 'u_showGlow'),
      showStars: gl.getUniformLocation(prog, 'u_showStars'),
      showNebula: gl.getUniformLocation(prog, 'u_showNebula'),
      fovScale: gl.getUniformLocation(prog, 'u_fovScale'),
      pan: gl.getUniformLocation(prog, 'u_pan'),
      cycleSpeed: gl.getUniformLocation(prog, 'u_cycleSpeed'),
      fluid: gl.getUniformLocation(prog, 'u_fluid'),
      breath: gl.getUniformLocation(prog, 'u_breath'),
      bright: gl.getUniformLocation(prog, 'u_bright'),
      invert: gl.getUniformLocation(prog, 'u_invert'),
      mono: gl.getUniformLocation(prog, 'u_mono'),
      rainbow: gl.getUniformLocation(prog, 'u_rainbow'),
      mirror: gl.getUniformLocation(prog, 'u_mirror'),
      vhs: gl.getUniformLocation(prog, 'u_vhs'),
      flicker: gl.getUniformLocation(prog, 'u_flicker'),
      twist: gl.getUniformLocation(prog, 'u_twist'),
      glitch: gl.getUniformLocation(prog, 'u_glitch'),
    };

    // Render at a higher resolution than CSS size (devicePixelRatio × resScale)
    // so the ray-march is sharp instead of pixelated. Cheap to keep per-frame.
    const resize = () => {
      const scale = optsRef.current.resScale;
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      gl.canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr * scale));
      gl.canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr * scale));
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = performance.now();
    const start = performance.now();
    const render = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const c = camRef.current;
      const stage = stageRef.current;

      // Build the free-fly look basis from yaw/pitch.
      const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
      const fwd = { x: sy * cp, y: sp, z: cy * cp };          // forward
      const right = { x: cy, y: 0, z: -sy };                    // right
      const up = { x: -sy * sp, y: cp, z: -cy * sp };           // world-up-adjusted

      // Movement (units/sec) — speed is user-tunable.
      const speed = optsRef.current.camSpeed;
      const k = keysRef.current;
      const f = (k.has('w') ? 1 : 0) - (k.has('s') ? 1 : 0);
      const r = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
      const v = (k.has(' ') ? 1 : 0) - (k.has('shift') ? 1 : 0);
      c.x += (fwd.x * f + right.x * r) * speed * dt;
      c.y += (fwd.y * f + up.y * v) * speed * dt;
      c.z += (fwd.z * f + right.z * r + up.z * v) * speed * dt;
      // Scroll flies forward/back. Scrolling UP (deltaY < 0) flies TOWARD the
      // hole (zoom in), scrolling DOWN flies away — not inverted.
      if (Math.abs(scrollAccumRef.current) > 0.0001) {
        const s = -scrollAccumRef.current * 3;
        c.x += fwd.x * s; c.y += fwd.y * s; c.z += fwd.z * s;
        scrollAccumRef.current = 0;
      }

      // Portal transition: only when near the centre AND looking into/away.
      const dist = Math.hypot(c.x, c.y, c.z);
      let lookDot = 0;
      if (dist > 1e-4) lookDot = (fwd.x * -c.x + fwd.y * -c.y + fwd.z * -c.z) / dist;
      const dir = portalTransition(dist, lookDot);
      if (dir !== 0) {
        const next = dir === 1 ? nextStageOf(stage) : prevStageOf(stage);
        if (next !== stage) {
          const s = spawnForStage(next);
          c.x = s.x; c.y = s.y; c.z = s.z; c.yaw = s.yaw; c.pitch = s.pitch;
          stageRef.current = next;
          setStageIdxProxy.current(next);
        }
      }

      // Camera eye + free-look target (pos + forward), so you can look around.
      const eye = new Float32Array([c.x, c.y, c.z]);
      const target = new Float32Array([c.x + fwd.x, c.y + fwd.y, c.z + fwd.z]);
      const o = optsRef.current;
      // Keep the drawing buffer at the user's chosen sharpness (DPI × scale).
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      const wantW = Math.max(1, Math.floor(canvas.clientWidth * dpr * o.resScale));
      const wantH = Math.max(1, Math.floor(canvas.clientHeight * dpr * o.resScale));
      if (gl.canvas.width !== wantW || gl.canvas.height !== wantH) {
        gl.canvas.width = wantW; gl.canvas.height = wantH;
        gl.viewport(0, 0, wantW, wantH);
      }
      const [dr, dg, db] = hexToRgb(o.diskCol);
      const [d2r, d2g, d2b] = hexToRgb(o.diskCol2);
      const [gr, gg, gb] = hexToRgb(o.glowCol);
      const [sr, sg, sb] = hexToRgb(o.starCol);
      const [nr, ng, nb] = hexToRgb(o.nebulaCol);
      gl.useProgram(prog);
      gl.uniform2f(U.res, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(U.time, t);
      gl.uniform3f(U.camPos, eye[0], eye[1], eye[2]);
      gl.uniform3f(U.camTarget, target[0], target[1], target[2]);
      gl.uniform1f(U.diskThickness, o.diskThickness);
      gl.uniform1f(U.gravity, o.gravity);
      gl.uniform1f(U.aspect, gl.canvas.width / Math.max(1, gl.canvas.height));
      gl.uniform1i(U.stage, stageRef.current);
      gl.uniform1f(U.diskInner, o.diskInner);
      gl.uniform1f(U.diskOuter, o.diskOuter);
      gl.uniform3f(U.diskCol, dr, dg, db);
      gl.uniform3f(U.diskCol2, d2r, d2g, d2b);
      gl.uniform1f(U.swirlSpeed, o.swirlSpeed);
      gl.uniform1f(U.swirlAmt, o.swirlAmt);
      gl.uniform1f(U.glow, o.glow);
      gl.uniform3f(U.glowCol, gr, gg, gb);
      gl.uniform1f(U.bloom, o.bloom);
      gl.uniform1f(U.starDensity, o.starDensity);
      gl.uniform3f(U.starCol, sr, sg, sb);
      gl.uniform1f(U.nebulaAmt, o.nebulaAmt);
      gl.uniform3f(U.nebulaCol, nr, ng, nb);
      gl.uniform1f(U.showDisk, o.showDisk ? 1 : 0);
      gl.uniform1f(U.showGlow, o.showGlow ? 1 : 0);
      gl.uniform1f(U.showStars, o.showStars ? 1 : 0);
      gl.uniform1f(U.showNebula, o.showNebula ? 1 : 0);
      gl.uniform1f(U.fovScale, o.fov);
      gl.uniform2f(U.pan, panRef.current.x, panRef.current.y);
      gl.uniform1f(U.cycleSpeed, o.cycleSpeed);
      gl.uniform1f(U.fluid, o.fluid);
      gl.uniform1f(U.breath, o.breath);
      gl.uniform1f(U.bright, o.bright);
      gl.uniform1f(U.invert, o.invert ? 1 : 0);
      gl.uniform1f(U.mono, o.mono ? 1 : 0);
      gl.uniform1f(U.rainbow, o.rainbow);
      gl.uniform1f(U.mirror, o.mirror ? 1 : 0);
      gl.uniform1f(U.vhs, o.vhs);
      gl.uniform1f(U.flicker, o.flicker);
      gl.uniform1f(U.twist, o.twist);
      gl.uniform1f(U.glitch, o.glitch);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };
    render();

    const cleanup = () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
    (window as any).__singularityCleanup = cleanup;

    return cleanup;
  }, []);

  // --- Throw / Grab items physics loop (2D overlay above the shader) -------
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const GRAV = 3.6e6;        // px^3/s^2 pull toward the hole
    const SWALLOW = 46;        // px — event-horizon screen radius
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const bw = Math.floor(w * dpr), bh = Math.floor(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const hx = w / 2 + panRef.current.x * w;
      const hy = h / 2 + panRef.current.y * h;

      const items = itemsRef.current;
      // Physics update
      for (const it of items) {
        if (it.kind !== 'item') continue;
        if (it.grabbed) continue;
        const dx = hx - it.x, dy = hy - it.y;
        const r = Math.hypot(dx, dy) || 1;
        if (r < SWALLOW) {  // ripped apart at the event horizon
          it.kind = 'particle';
          it.life = 0.6;
          it.stretch = 1;
          it.vx = (dx / r) * 320 + (Math.random() - 0.5) * 220;
          it.vy = (dy / r) * 320 + (Math.random() - 0.5) * 220;
          continue;
        }
        const a = GRAV / (r * r + 60 * 60);
        it.vx += (dx / r) * a * dt;
        it.vy += (dy / r) * a * dt;
        it.vx *= 0.999; it.vy *= 0.999;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        // spaghettification: stretch grows sharply as you near the hole
        it.stretch = Math.min(20, 1 + 4e4 / Math.pow(Math.max(r, 24), 1.6));
      }
      for (const it of items) {
        if (it.kind === 'particle' && it.life !== undefined) {
          it.life -= dt;
          it.x += it.vx * dt; it.y += it.vy * dt;
        }
      }
      itemsRef.current = items.filter((it) => !(it.kind === 'particle' && (it.life ?? 0) <= 0));

      // Aim preview line (throw direction)
      const aim = aimRef.current;
      if (aim.active) {
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(aim.sx, aim.sy);
        ctx.lineTo(aim.cx, aim.cy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw items + particles
      for (const it of itemsRef.current) {
        if (it.kind === 'particle') {
          ctx.globalAlpha = Math.max(0, Math.min(1, (it.life ?? 0) * 2));
          ctx.fillStyle = it.color;
          ctx.beginPath(); ctx.arc(it.x, it.y, 6, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        // meteor trail along velocity
        const sp = Math.hypot(it.vx, it.vy);
        if (sp > 20) {
          const grad = ctx.createLinearGradient(it.x, it.y, it.x - it.vx * 0.06, it.y - it.vy * 0.06);
          grad.addColorStop(0, it.color);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(it.x, it.y);
          ctx.lineTo(it.x - it.vx * 0.06, it.y - it.vy * 0.06);
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
        // spaghettified emoji — stretched along the radial direction
        const dx = hx - it.x, dy = hy - it.y;
        const ang = Math.atan2(dy, dx);
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(ang + Math.PI / 2);   // local +Y points radially inward
        ctx.scale(1, it.stretch);
        ctx.font = `${it.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.emoji, 0, 0);
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  // Free-fly journey: stage is driven by flying through the centre portal while
  // looking into it (deeper) or away (back). Moving sideways/up/down explores
  // freely within the current area.
  const isJourney = stageIdx !== 0;

  // Bridge so the render-loop's portal transition can update React state.
  setStageIdxProxy.current = (stage: number) => {
    setStageIdx(stage);
    setJourney(stage !== 0);
  };

  const currentStage = stageIdx === 6
    ? { id: 'void', title: 'The Void', desc: 'Inside the hole. Look around — back out you see the universe; the way deeper glows ahead.' }
    : JOURNEY_STAGES[Math.max(0, Math.min(stageIdx - 1, JOURNEY_STAGES.length - 1))];

  const submitPassword = () => {
    const answer = password.trim().toLowerCase();
    const correct = answer === 'eaoin' || answer === '32646';
    if (correct) {
      setSecretEnding(true);
      setNoteOpen(true);
      getGodMode().unlock();
      getEndingTicket().grant();
    }
  };

  return (
    <div className={`singularity ${journey ? 'journey' : ''}`}>
      <canvas ref={canvasRef} className="singularity-canvas" />
      <canvas ref={overlayRef} className="singularity-items-canvas" aria-hidden="true" />
      <div className="singularity-vignette" />

      <div className="singularity-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">SINGULARITY</div>
          <h1 className="screen-title">🕳 The Black Hole</h1>
        </div>
        <button className="singularity-x" onClick={onExit ?? onBack} aria-label="Exit Singularity">✕</button>
      </div>

      <div className="singularity-hint">
        {isJourney
          ? `Inside: ${currentStage.title} — fly freely • turn back to look out through the hole • dive STRAIGHT into the centre to go deeper`
          : 'WASD/arrows move • Space/Shift up/down • scroll flies • drag to look • dive DEEP into the centre and look straight into it to fall through'}
      </div>

      {/* LEFT STUDIO — tons of tiny tunable bars (X to hide for a clean view) */}
      {tuneOpen && (
        <div className="singularity-panel left">
          <div className="singularity-panel-head">
            <span>🎚 Black Hole Tune</span>
            <button className="singularity-panel-x" onClick={() => setTuneOpen(false)} aria-label="Close tune panel">✕</button>
          </div>
          <div className="singularity-panel-body">
            <div className="singularity-studio-sec">Shape & Light</div>
            {STUDIO_TUNES.map((ctrl) => (
              <label className="singularity-slider" key={ctrl.key}>
                <span>{ctrl.label}</span>
                <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step}
                  value={opts[ctrl.key] as number}
                  onChange={(e) => patchOpts({ [ctrl.key]: Number(e.target.value) } as Partial<BlackHoleOpts>)} />
                <b>{(opts[ctrl.key] as number).toFixed(2)}</b>
              </label>
            ))}
            <div className="singularity-studio-sec">Wacky & Fluid</div>
            {STUDIO_WACKY.map((ctrl) => (
              ctrl.kind === 'toggle' ? (
                <label className="singularity-wacky-toggle" key={ctrl.key}>
                  <input type="checkbox" checked={opts[ctrl.key] as boolean}
                    onChange={(e) => patchOpts({ [ctrl.key]: e.target.checked } as Partial<BlackHoleOpts>)} />
                  <span>{ctrl.label}</span>
                </label>
              ) : (
                <label className="singularity-slider" key={ctrl.key}>
                  <span>{ctrl.label}</span>
                  <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step}
                    value={opts[ctrl.key] as number}
                    onChange={(e) => patchOpts({ [ctrl.key]: Number(e.target.value) } as Partial<BlackHoleOpts>)} />
                  <b>{(opts[ctrl.key] as number).toFixed(2)}</b>
                </label>
              )
            ))}
          </div>
        </div>
      )}
      {!tuneOpen && (
        <button className="singularity-float left" onClick={() => setTuneOpen(true)} aria-label="Open tune panel">🎚</button>
      )}

      {/* RIGHT STUDIO — presets, colours, toggles & quality (X to hide) */}
      {presetOpen && (
        <div className="singularity-panel right">
          <div className="singularity-panel-head">
            <span>🎛 Black Hole Studio</span>
            <button className="singularity-panel-x" onClick={() => setPresetOpen(false)} aria-label="Close studio panel">✕</button>
          </div>
          <div className="singularity-panel-body">
            <div className="singularity-studio-sec">Mouse</div>
            <div className="singularity-mode-row">
              <button className={`singularity-mode-btn ${dragMode === 'look' ? 'active' : ''}`}
                onClick={() => setDragMode('look')}>🔭 Look</button>
              <button className={`singularity-mode-btn ${dragMode === 'move' ? 'active' : ''}`}
                onClick={() => setDragMode('move')}>🖐 Move hole</button>
              <button className="singularity-mode-btn" onClick={resetView} title="Reset camera & hole">↺ Reset</button>
            </div>
            <p className="singularity-studio-note">Drag to {dragMode === 'move' ? 'slide the black hole around the screen' : 'look around freely'}.</p>

            <div className="singularity-studio-sec">Throw / Grab items</div>
            <div className="singularity-mode-row">
              <button className={`singularity-mode-btn ${itemsMode ? 'active' : ''}`}
                onClick={() => setItemsMode((v) => !v)}>🎯 Grab / Throw</button>
              <button className="singularity-mode-btn" onClick={spawnRandomItem}>🎲 Spawn</button>
              <button className="singularity-mode-btn" onClick={clearItems}>🗑 Clear</button>
            </div>
            <p className="singularity-studio-note">
              {itemsMode
                ? 'Drag on empty space to throw a random item • click an item to grab it, then fling it. Watch them spaghettify & rip apart in the hole.'
                : 'Turn on to grab & throw items (fruit, rockets, rocks…) into the black hole.'}
            </p>

            <div className="singularity-studio-sec">Presets · {BLACK_HOLE_PRESETS.length}</div>
            <button className="singularity-preset-random" onClick={applyRandomPreset}>🎲 Random black hole</button>
            <div className="singularity-preset-scroll">
              <div className="singularity-preset-grid">
                {BLACK_HOLE_PRESETS.map((p) => (
                  <button key={p.id}
                    className={`singularity-preset ${opts.diskCol === p.opts.diskCol ? 'active' : ''}`}
                    onClick={() => applyPreset(p.id)}>
                    <span className="singularity-preset-emoji">{p.emoji}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="singularity-studio-sec">Colours</div>
            {[
              { key: 'diskCol', label: 'Disk colour' },
              { key: 'diskCol2', label: 'Inner disk' },
              { key: 'glowCol', label: 'Photon glow' },
              { key: 'starCol', label: 'Stars' },
              { key: 'nebulaCol', label: 'Nebula' },
            ].map((c) => (
              <label className="singularity-color" key={c.key}>
                <span>{c.label}</span>
                <input type="color" value={opts[c.key as 'diskCol']}
                  onChange={(e) => patchOpts({ [c.key]: e.target.value } as Partial<BlackHoleOpts>)} />
              </label>
            ))}

            <div className="singularity-studio-sec">Show</div>
            <div className="singularity-toggle-row">
              <label><input type="checkbox" checked={opts.showDisk} onChange={(e) => patchOpts({ showDisk: e.target.checked })} /> Disk</label>
              <label><input type="checkbox" checked={opts.showGlow} onChange={(e) => patchOpts({ showGlow: e.target.checked })} /> Glow</label>
              <label><input type="checkbox" checked={opts.showStars} onChange={(e) => patchOpts({ showStars: e.target.checked })} /> Stars</label>
              <label><input type="checkbox" checked={opts.showNebula} onChange={(e) => patchOpts({ showNebula: e.target.checked })} /> Nebula</label>
            </div>

            <div className="singularity-studio-sec">Quality</div>
            <label className="singularity-slider">
              <span>Sharpness (non-pixelated)</span>
              <input type="range" min={0.5} max={3} step={0.25} value={opts.resScale}
                onChange={(e) => patchOpts({ resScale: Number(e.target.value) })} />
              <b>{opts.resScale.toFixed(2)}×</b>
            </label>
            <p className="singularity-studio-note">Higher = sharper but heavier on the GPU.</p>
          </div>
        </div>
      )}
      {!presetOpen && (
        <button className="singularity-float right" onClick={() => setPresetOpen(true)} aria-label="Open studio panel">🎛</button>
      )}

      {/* Journey depth HUD (no buttons — purely physical zoom) */}
      {isJourney && (
        <div className="singularity-stage">
          <div className="singularity-stage-title">{currentStage.title}</div>
          <div className="singularity-stage-desc">{currentStage.desc}</div>
          <div className="singularity-stage-track">
            {JOURNEY_STAGES.map((s, i) => <span key={s.id} className={i < stageIdx ? 'on' : ''} title={s.title} />)}
          </div>

          {stageIdx >= 5 && (
            <div className="singularity-monitor" onClick={(e) => e.stopPropagation()}>
              <div className="singularity-monitor-head">🖥 EAOIN TERMINAL — ENTER PASSWORD</div>
              <p className="singularity-monitor-hint">The key. The four letters worn into the world. Enter it to reach the other side.</p>
              <div className="singularity-monitor-row">
                <input className="singularity-monitor-input" value={password}
                  onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
                  placeholder="password" />
                <button className="singularity-monitor-go" onClick={submitPassword}>Enter</button>
              </div>
              {secretEnding && <p className="singularity-monitor-ok">✓ Access granted.</p>}
            </div>
          )}
        </div>
      )}

      <div className="singularity-arg">
        <div className="singularity-arg-head">🧬 ARG — Recover the Key</div>
        <div className="singularity-arg-progress">
          <div className="singularity-arg-bar"><div className="singularity-arg-fill" style={{ width: `${Math.round((fragments.length / ARG_FRAGMENTS.length) * 100)}%` }} /></div>
          <span>{fragments.length}/{ARG_FRAGMENTS.length} fragments</span>
        </div>
        <div className="singularity-arg-glyphs">
          {ARG_FRAGMENTS.map((f) => (
            <button key={f.id} className={`singularity-glyph ${fragments.includes(f.id) ? 'found' : ''}`}
              onClick={() => collectFragment(f.id)} title={f.title}>
              {fragments.includes(f.id) ? f.glyph : f.emoji}
            </button>
          ))}
        </div>
        <p className="singularity-arg-hint">Click a fragment to recover it. Gather all {ARG_FRAGMENTS.length} to complete the key.</p>
        {argMsg && <p className="singularity-arg-msg">{argMsg}</p>}
        {getARG().isKeyComplete() && <p className="singularity-arg-key">🔑 The key is <b>EAOIN</b> — enter it to unlock the secret ending.</p>}
      </div>

      {noteOpen && (
        <div className="singularity-note" onClick={() => setNoteOpen(false)}>
          <div className="singularity-note-card" onClick={(e) => e.stopPropagation()}>
            <div className="singularity-note-head">{secretEnding ? '💫 THE COSMIC GIRL RETURNS' : '📜 A Note'}</div>
            {secretEnding ? (
              <>
                <p>You have recovered every fragment, assembled the key, and crossed to the other side of the planet.</p>
                <p>The Cosmic Girl returns. She was never the monster — she was the one who sacrificed herself to it, and sent her son to a world named EAOIN so he could grow up.</p>
                <p>Her message is a song, and her gift is <b>God Mode</b> — the power to build and dream anything, all at once.</p>
                <p className="singularity-note-key">🎁 <b>GOD MODE UNLOCKED</b></p>
                <div className="singularity-ticket">
                  <div className="singularity-ticket-head">🎟 ENDING TICKET</div>
                  <div className="singularity-ticket-code">{getEndingTicket().get().read ? 'READ' : getEndingTicket().get().code}</div>
                  <div className="singularity-ticket-foot">Keep these numbers — they are the last of the key.</div>
                </div>
              </>
            ) : SINGULARITY_NOTE.map((line, i) => <p key={i} className={line === '' ? 'spacer' : ''}>{line}</p>)}
            <button className="singularity-note-close" onClick={() => setNoteOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
