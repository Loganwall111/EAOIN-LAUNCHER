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

  // ---- Backgrounds (the scene the black hole sits in) + more hole tuning ----
  uniform int u_bgIndex;       // which background generator to draw
  uniform float u_bgHue;       // palette hue for sub-variants
  uniform float u_bgSpeed;     // background animation speed
  uniform float u_size;        // horizon SIZE multiplier — make it massive
  uniform float u_diskBright;  // accretion-disk brightness
  uniform float u_ringW;       // photon-ring width
  uniform float u_lens;        // gravitational lensing strength
  // ---- Extra VFX (Part 4) ----
  uniform float u_spiral;      // photon spiral filaments 0..1
  uniform float u_flare;       // lens-flare brightness 0..1
  uniform float u_particles;   // drifting dust particles 0..1
  uniform float u_warp;        // radial warp streaks 0..1
  uniform float u_ringBands;   // extra photon-ring bands 0..1
  uniform float u_vignette;    // 0..1 vignette strength
  uniform float u_density;     // 0..1 world geometry density/scale

  // ---- Journey worlds: which scene + palette to render ----
  uniform int u_worldKind;     // which world generator to draw (0..15)
  uniform float u_worldHue;    // world palette hue 0..1
  uniform float u_worldParam;  // per-world variation parameter
  uniform float u_worldScale;  // world scale multiplier

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
    col *= (1.0 - u_vignette) + u_vignette * (0.6 + 0.4*smoothstep(1.3, 0.15, length(ndc)));
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

  // Jellyfish ocean: a glowing cluster of drifting bells + tentacles over a floor.
  float mapJellyfish(vec3 p, out int mat){
    mat = 1;
    float d = p.y + 3.2 + noise(p.xz*0.4 + u_worldParam)*0.4;
    for (int i = 0; i < 5; i++) {
      vec3 c = vec3(0.0, 0.0, float(i)*4.0 - 8.0);
      c.y = 1.0 + 0.6*sin(u_time*0.8 + float(i) + u_worldParam);
      d = min(d, sdSphere(p - c, 0.8));
      d = min(d, sdSegment(p, c, c + vec3(0.0,-3.0,0.0), 0.05));
    }
    return d;
  }

  // Psychedelic tunnel: warping, breathing blobs that change colour.
  float mapPsychedelic(vec3 p, out int mat){
    mat = 1;
    vec3 g = p*0.8;
    vec3 cell = floor(g);
    vec3 l = fract(g) - 0.5;
    float blob = sdSphere(l, 0.3 + 0.15*sin(u_time*2.0 + dot(cell, vec3(1.0,2.0,3.0)) + u_worldParam));
    return blob/0.8;
  }

  // Blood stream: a GIANT floating tube (a blood vessel) with red cells
  // drifting through plasma inside — not a grid. The tube walls curve around
  // you so you feel like you're floating inside an artery.
  float mapBlood(vec3 p, out int mat){
    mat = 1;
    // A long cylindrical vessel along the Z axis, radius ~6.
    float rad = length(p.xy);
    float wall = 6.0 - rad;                 // inner surface of the tube
    // Dense red cells drifting through the plasma.
    // NOTE: start the accumulator at a large value — starting at 0.0 made
    // min(0, sd) collapse to 0 everywhere, so the whole vessel rendered blank.
    float n = 1e9;
    for (int i = 0; i < 3; i++) {
      vec3 c = vec3(
        sin(float(i)*2.1 + p.z*0.25 + u_time*0.2)*1.5,
        cos(float(i)*1.7 + p.z*0.2 + u_time*0.15)*1.5,
        p.z);
      n = min(n, sdSphere(p - c, 0.5));
    }
    return min(wall, n);
  }

  // Neuron forest: somas connected by dendrite segments.
  float mapNeurons(vec3 p, out int mat){
    mat = 1;
    vec3 g = p*0.7;
    vec3 cell = floor(g);
    vec3 l = fract(g) - 0.5;
    float d = sdSphere(l, 0.3);
    float rnd = hash(cell.xy + vec2(cell.z*3.7, cell.z*3.7));
    if (rnd > 0.5) {
      d = min(d, sdSegment(g, cell, cell + vec3(1,0,0), 0.03));
    }
    return d/0.7;
  }

  // Earth mountains: blocky, minecraft-style terrain — a ground plane studded
  // with chunky voxel hills and peaks (cubes, not smooth spheres).
  float mapMountains(vec3 p, out int mat){
    mat = 1;
    float ground = p.y - 1.0;
    float n = noise(p.xz*0.12 + u_worldParam);
    float h = n * 5.0;
    // Blocky hills: quantise to voxel steps for a minecraft look.
    float hills = p.y - (1.0 + floor(h*2.0)*0.5);
    float d = min(ground, hills);
    // A few big blocky peaks.
    for (int i = 0; i < 4; i++) {
      float hx = hash1(float(i)*2.1);
      float hz = hash1(float(i)*7.3);
      vec3 c = vec3((hx-0.5)*10.0, 3.0 + hx*5.0, (hz-0.5)*10.0);
      d = min(d, sdBox(p - c, vec3(1.5 + hx*1.5, 2.0 + hx*3.0, 1.5 + hx*1.5)));
    }
    return d;
  }

  // Sky city: towers rising from a ground grid.
  float mapCity(vec3 p, out int mat){
    mat = 1;
    vec3 g = floor(p*0.5);
    vec3 l = fract(p*0.5)-0.5;
    float h = 0.5 + hash(g.xy + vec2(g.z*3.7, g.z*3.7))*1.5;
    float b = sdBox(l - vec3(0.0, h*0.5-0.5, 0.0), vec3(0.35, h*0.5, 0.35));
    return min(b, p.y + 0.5)/0.5;
  }

  // Crystal cave: glowing shards in a cavern.
  float mapCrystal(vec3 p, out int mat){
    mat = 1;
    float d = p.y + 2.0;
    vec3 g = floor(p*0.7);
    vec3 l = fract(p*0.7)-0.5;
    float shard = sdSphere(l, 0.4 + 0.1*sin(u_time + u_worldParam))*0.6;
    return min(d, shard)/0.7;
  }

  // Lava tunnels: a bubbling lava floor with a rising magma sphere.
  float mapLava(vec3 p, out int mat){
    mat = 1;
    float ground = p.y + 2.0 + noise(p.xz*0.3 + u_worldParam)*0.4;
    float bubble = sdSphere(p - vec3(0.0, 1.2, 0.0), 0.9);
    return min(ground, bubble);
  }

  // Ice cavern: icy floor studded with columns.
  float mapIce(vec3 p, out int mat){
    mat = 1;
    float ground = p.y + 2.5;
    vec3 g = floor(p*0.4);
    vec3 l = fract(p*0.4)-0.5;
    float col = sdBox(l - vec3(0.0, 1.0, 0.0), vec3(0.3, 1.5, 0.3));
    return min(ground, col)/0.4;
  }

  // Mushroom grove: glowing mushroom caps on stems.
  float mapMushroom(vec3 p, out int mat){
    mat = 1;
    float d = p.y + 2.0;
    vec3 g = floor(p*0.5);
    vec3 l = fract(p*0.5)-0.5;
    vec3 base = g + vec3(0.0,0.6,0.0);
    float stem = sdSegment(p*0.5, g, base, 0.12);
    float cap = sdSphere(p*0.5 - base, 0.4);
    return min(d, min(stem, cap))/0.5;
  }

  // Candy land: lollipops and sweets on a frosting floor.
  float mapCandy(vec3 p, out int mat){
    mat = 1;
    float d = p.y + 2.0;
    vec3 g = floor(p*0.5);
    vec3 l = fract(p*0.5)-0.5;
    float lolli = sdSphere(l - vec3(0.0,0.6,0.0), 0.35);
    float stick = sdSegment(p*0.5, g, g + vec3(0.0,1.2,0.0), 0.05);
    return min(d, min(lolli, stick))/0.5;
  }

  // Infinite hallway: a long tunnel that repeats, with pillars on both sides.
  float mapHallway(vec3 p, out int mat){
    mat = 1;
    float ground = p.y + 2.5;
    float wall = 4.0 - abs(p.x);
    float z = mod(p.z, 8.0) - 4.0;
    vec3 g = floor(p*0.4);
    vec3 l = fract(p*0.4)-0.5;
    float pillar = sdBox(l - vec3(3.2, 0.5, 0.0), vec3(0.4, 1.5, 0.4));
    return min(min(ground, wall), pillar)/0.4;
  }

  // Endless desert: rolling blocky sand dunes under a hot sky.
  float mapDesert(vec3 p, out int mat){
    mat = 1;
    float d = p.y - (noise(p.xz*0.1 + u_worldParam)*3.0 + 1.0);
    vec3 g = floor(p*0.5);
    vec3 l = fract(p*0.5)-0.5;
    float cactus = sdBox(l - vec3(0.0,0.6,0.0), vec3(0.3,0.8,0.3));
    return min(d, cactus)/0.5;
  }

  // Volcano: a great cone with a glowing crater rim.
  float mapVolcano(vec3 p, out int mat){
    mat = 1;
    vec3 q = p;
    float r = length(q.xz);
    float cone = r*0.9 - (q.y - 2.0);
    float crater = length(q.xz - vec2(0.0,0.0)) - (q.y - 2.0)*0.5 - 1.5;
    return min(cone, crater);
  }

  // Jungle: a dense canopy of tall blocky trees over a leaf floor.
  float mapJungle(vec3 p, out int mat){
    mat = 1;
    float ground = p.y + 1.5;
    vec3 g = floor(p*0.3);
    vec3 l = fract(p*0.3)-0.5;
    float trunk = sdSegment(p*0.3, g, g + vec3(0.0,2.0,0.0), 0.2);
    float leaf = sdSphere(p*0.3 - (g + vec3(0.0,2.0,0.0)), 0.7);
    return min(ground, min(trunk, leaf))/0.3;
  }

  // Clockwork: interlocking gears and machinery filling space.
  float mapClockwork(vec3 p, out int mat){
    mat = 1;
    vec3 g = floor(p*0.5);
    vec3 l = fract(p*0.5)-0.5;
    float gear = sdBox(l, vec3(0.4, 0.12, 0.4));
    float cog = sdBox(l, vec3(0.12, 0.3, 0.12));
    return min(gear, cog)/0.5;
  }

  // Cloud tops: soft fluffy cloud towers floating in a bright sky.
  float mapCloud(vec3 p, out int mat){
    mat = 1;
    float n = noise(p.xz*0.15 + u_worldParam);
    float d = p.y - (2.0 + n*4.0);
    vec3 g = floor(p*0.4);
    vec3 l = fract(p*0.4)-0.5;
    float puff = sdSphere(l, 0.5 + noise(l.xy+vec2(0.0,0.0))*0.4);
    return min(d, puff)/0.4;
  }

  // Temple: a grand stone temple with columns and a stepped roof.
  float mapTemple(vec3 p, out int mat){
    mat = 1;
    float ground = p.y + 2.0;
    float roof = abs(p.y - 4.0) - 1.2;
    vec3 g = floor(p*0.5);
    vec3 l = fract(p*0.5)-0.5;
    float column = sdBox(l - vec3(0.0,1.0,0.0), vec3(0.35,1.5,0.35));
    return min(min(ground, roof), column)/0.5;
  }

  // Unified scene map — picks the generator for the current journey world.
  float mapWorld(vec3 p, out int mat){
    // u_density scales geometry density (0.5 = sparse, 2 = packed).
    p /= max(0.3, u_density);
    if (u_worldKind == 0) return mapNeural(p, mat);
    if (u_worldKind == 1) return mapAsteroids(p, mat);
    if (u_worldKind == 2) return mapPlanet(p, mat);
    if (u_worldKind == 3) return mapHouse(p, mat);
    if (u_worldKind == 4) return mapMonitor(p, mat);
    if (u_worldKind == 5) return mapJellyfish(p, mat);
    if (u_worldKind == 6) return mapPsychedelic(p, mat);
    if (u_worldKind == 7) return mapBlood(p, mat);
    if (u_worldKind == 8) return mapNeurons(p, mat);
    if (u_worldKind == 9) return mapMountains(p, mat);
    if (u_worldKind == 10) return mapCity(p, mat);
    if (u_worldKind == 11) return mapCrystal(p, mat);
    if (u_worldKind == 12) return mapLava(p, mat);
    if (u_worldKind == 13) return mapIce(p, mat);
    if (u_worldKind == 14) return mapMushroom(p, mat);
    if (u_worldKind == 15) return mapCandy(p, mat);
    if (u_worldKind == 16) return mapHallway(p, mat);
    if (u_worldKind == 17) return mapDesert(p, mat);
    if (u_worldKind == 18) return mapVolcano(p, mat);
    if (u_worldKind == 19) return mapJungle(p, mat);
    if (u_worldKind == 20) return mapClockwork(p, mat);
    if (u_worldKind == 21) return mapCloud(p, mat);
    return mapTemple(p, mat);
  }

  // ------------------------------------------------------------------
  // Background generators — the stunning scene the black hole sits in.
  // Each takes the escaped ray direction and draws a backdrop (deep space,
  // galaxy, nebula, psychedelic, mountains, city, blood cells, brain,
  // cosmos, grid, fire, ice, lava, rainbow). u_bgHue recolours any of them.
  // ------------------------------------------------------------------
  float bgTerrain(vec2 p){
    float h = 0.0; float a = 0.5; vec2 q = p;
    for (int i = 0; i < 4; i++) { h += a * fbm(q); q = q*1.7 + vec2(3.1, 1.7); a *= 0.5; }
    return h;
  }
  vec3 bgDeepSpace(vec3 d, float t){
    vec2 p = vec2(d.z, d.x)*60.0 + d.y*30.0;
    float star = step(1.0 - u_starDensity, hash(floor(p)));
    vec3 col = u_starCol * star * 0.9;
    float neb = fbm(p*0.35 + vec2(t*0.03*u_bgSpeed, t*0.02*u_bgSpeed));
    col += u_nebulaCol * neb * u_nebulaAmt * 1.2;
    col += vec3(0.015, 0.03, 0.08);
    return col;
  }
  vec3 bgGalaxy(vec3 d, float t){
    vec2 p = vec2(d.x, d.y)*40.0;
    float ang = atan(p.y, p.x);
    float r = length(p);
    float arm = 0.5 + 0.5*sin(ang*3.0 - r*0.5 - t*0.1*u_bgSpeed);
    vec3 col = u_nebulaCol * smoothstep(1.0, 0.2, r) * (0.3 + 0.7*arm);
    col += u_starCol * step(0.98, hash(floor(p*8.0))) * 0.7;
    return col + vec3(0.01, 0.01, 0.03);
  }
  vec3 bgNebula(vec3 d, float t){
    vec2 p = d.xy*6.0;
    float n = fbm(p + vec2(t*0.04*u_bgSpeed, 0.0));
    float n2 = fbm(p*1.6 - vec2(0.0, t*0.03*u_bgSpeed));
    vec3 col = mix(u_starCol*0.3, u_nebulaCol, n);
    col += u_starCol * 0.3 * n2;
    return col + vec3(0.02, 0.02, 0.05);
  }
  vec3 bgPsychedelic(vec3 d, float t){
    vec2 p = d.xy*3.0;
    float n = fbm(p*2.0 + t*0.25*u_bgSpeed);
    float m = fbm(p*3.0 - t*0.3*u_bgSpeed);
    vec3 a = hueShift(u_nebulaCol, n*6.28318 + t*0.2*u_bgSpeed);
    vec3 b = hueShift(u_diskCol2, m*6.28318);
    return a*(0.4+0.6*n) + b*(0.3+0.4*m);
  }
  vec3 bgMountains(vec3 d, float t){
    vec3 sky = mix(vec3(0.08,0.12,0.3), vec3(0.5,0.6,0.95), smoothstep(-0.3,0.6,d.y));
    if (d.y < 0.0) {
      vec2 p = vec2(atan(d.z, d.x), d.y*40.0)*3.0;
      float m = bgTerrain(p + vec2(t*0.02*u_bgSpeed, 0.0));
      vec3 rock = mix(vec3(0.12,0.2,0.16), vec3(0.9,0.95,1.0), smoothstep(0.55,0.8,m));
      return rock*smoothstep(-0.6,0.0,d.y) + sky*0.25;
    }
    return sky;
  }
  vec3 bgCity(vec3 d, float t){
    vec3 sky = mix(vec3(0.02,0.03,0.12), vec3(0.3,0.15,0.4), smoothstep(-0.4,0.5,d.y));
    if (d.y > 0.0) return sky + vec3(1.0,0.8,0.5)*pow(max(0.0,d.y),3.0)*0.3;
    vec2 p = vec2(d.x, d.z);
    float col = floor(p.x*4.0);
    float h = (0.2 + 0.5*fbm(vec2(col, 1.0))) * 2.0;
    float row = 1.0 - smoothstep(0.0, 1.0, -d.y/h);
    vec3 bcol = mix(vec3(0.05,0.06,0.12), vec3(0.9,0.7,0.3), step(0.5, hash(vec2(col, 3.0)))*0.6);
    return mix(sky, bcol, row) + vec3(1.0,0.9,0.5)*step(0.9, hash(vec2(col,7.0)))*0.5*row;
  }
  vec3 bgBlood(vec3 d, float t){
    vec3 col = vec3(0.35,0.02,0.03);
    vec3 p = d*10.0 + vec3(0.0, 0.0, t*0.1*u_bgSpeed);
    vec3 c = floor(p); vec3 lp = fract(p)-0.5;
    float cell = smoothstep(0.0, -0.1, sdSphere(lp, 0.35));
    col = mix(col, vec3(0.85,0.08,0.1), cell);
    float nuc = smoothstep(0.0, -0.06, sdSphere(lp, 0.12));
    col = mix(col, vec3(0.5,0.02,0.06), nuc*cell);
    return col;
  }
  vec3 bgBrain(vec3 d, float t){
    vec3 col = vec3(0.08,0.06,0.12);
    vec3 p = d*8.0;
    vec3 c = floor(p); vec3 lp = fract(p)-0.5;
    float cell = smoothstep(0.0,-0.2, sdSphere(lp,0.28));
    col = mix(col, vec3(0.9,0.7,1.0), cell*0.5);
    float rnd = hash(c.xy + vec2(c.z*3.7, c.z*3.7));
    if (rnd > 0.5) {
      float seg = sdSegment(p, c, c+vec3(1,0,0), 0.02);
      col = mix(col, vec3(0.4,0.9,1.0), smoothstep(0.0,-0.05,seg)*0.6);
    }
    return col;
  }
  vec3 bgCosmos(vec3 d, float t){
    vec2 p = vec2(d.z,d.x)*20.0;
    float r = length(p);
    vec3 col = u_nebulaCol*0.5*(0.4+0.6*fbm(p*0.5 + t*0.02*u_bgSpeed));
    col += vec3(1.0,0.8,0.6)*exp(-r*0.6)*0.5;
    col += u_starCol*step(0.985, hash(floor(p*10.0)))*0.8;
    return col;
  }
  vec3 bgGrid(vec3 d, float t){
    if (d.y > 0.0) return vec3(0.01,0.01,0.02);
    vec2 p = d.xz / max(abs(d.y), 1e-4) * 3.0;
    vec2 g = abs(fract(p)-0.5);
    float line = smoothstep(0.02, 0.0, min(g.x, g.y));
    vec3 col = mix(vec3(0.02,0.02,0.05), u_diskCol2, line);
    float pulse = 0.5+0.5*sin(t*2.0*u_bgSpeed);
    return col*(0.4+0.3*pulse);
  }
  vec3 bgFire(vec3 d, float t){
    float n = fbm(d.xy*4.0 + vec2(0.0, t*0.6*u_bgSpeed));
    vec3 col = mix(vec3(0.1,0.0,0.0), vec3(1.0,0.5,0.05), n);
    col += vec3(1.0,0.9,0.4)*pow(n,4.0)*0.8;
    return col;
  }
  vec3 bgIce(vec3 d, float t){
    vec3 sky = mix(vec3(0.02,0.05,0.15), vec3(0.3,0.7,0.9), smoothstep(-0.3,0.5,d.y));
    float a = fbm(vec2(d.x, d.y)*3.0 + t*0.1*u_bgSpeed);
    sky += vec3(0.2,1.0,0.6)*smoothstep(0.5,0.9,a)*0.4;
    if (d.y < 0.0) {
      float m = bgTerrain(vec2(atan(d.z, d.x), d.y*40.0)*3.0);
      return mix(vec3(0.4,0.6,0.8), vec3(0.95,1.0,1.0), smoothstep(0.5,0.8,m));
    }
    return sky;
  }
  vec3 bgLava(vec3 d, float t){
    float n = fbm(d.xy*3.0 + t*0.1*u_bgSpeed);
    vec3 col = mix(vec3(0.05,0.01,0.0), vec3(1.0,0.3,0.02), smoothstep(0.4,0.9,n));
    col += vec3(1.0,0.8,0.3)*step(0.85,n)*0.6;
    return col;
  }
  vec3 bgRainbow(vec3 d, float t){
    vec2 p = d.xy*3.0;
    float n = fbm(p + t*0.2*u_bgSpeed);
    vec3 col = hueShift(u_nebulaCol*0.6 + vec3(0.1), n*6.28318 + t*0.3*u_bgSpeed);
    return col*(0.4+0.6*n);
  }
  // Pick the active background generator, then recolor by palette hue.
  vec3 renderBackground(vec3 d, float t){
    vec3 col;
    if (u_bgIndex == 0) col = bgDeepSpace(d,t);
    else if (u_bgIndex == 1) col = bgGalaxy(d,t);
    else if (u_bgIndex == 2) col = bgNebula(d,t);
    else if (u_bgIndex == 3) col = bgPsychedelic(d,t);
    else if (u_bgIndex == 4) col = bgMountains(d,t);
    else if (u_bgIndex == 5) col = bgCity(d,t);
    else if (u_bgIndex == 6) col = bgBlood(d,t);
    else if (u_bgIndex == 7) col = bgBrain(d,t);
    else if (u_bgIndex == 8) col = bgCosmos(d,t);
    else if (u_bgIndex == 9) col = bgGrid(d,t);
    else if (u_bgIndex == 10) col = bgFire(d,t);
    else if (u_bgIndex == 11) col = bgIce(d,t);
    else if (u_bgIndex == 12) col = bgLava(d,t);
    else col = bgRainbow(d,t);
    return hueShift(col, u_bgHue);
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
    col += renderBackground(rd, u_time) * outLook * 1.2;
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
    // Newer worlds use the world palette, hue-rotated per journey world.
    if (u_worldKind == 5) return hueShift(vec3(0.3,0.85,0.9), u_worldHue*6.28318);
    if (u_worldKind == 6) return hueShift(vec3(0.95,0.3,0.9), u_worldHue*6.28318);
    if (u_worldKind == 7) return hueShift(vec3(0.9,0.2,0.25), u_worldHue*6.28318);
    if (u_worldKind == 8) return hueShift(vec3(0.5,0.7,1.0), u_worldHue*6.28318);
    if (u_worldKind == 9) return hueShift(vec3(0.4,0.6,0.3), u_worldHue*6.28318);
    if (u_worldKind == 10) return hueShift(vec3(0.3,0.35,0.55), u_worldHue*6.28318);
    if (u_worldKind == 11) return hueShift(vec3(0.4,0.9,1.0), u_worldHue*6.28318);
    if (u_worldKind == 12) return hueShift(vec3(1.0,0.4,0.1), u_worldHue*6.28318);
    if (u_worldKind == 13) return hueShift(vec3(0.6,0.9,1.0), u_worldHue*6.28318);
    if (u_worldKind == 14) return hueShift(vec3(0.9,0.5,0.3), u_worldHue*6.28318);
    if (u_worldKind == 15) return hueShift(vec3(1.0,0.6,0.8), u_worldHue*6.28318);
    if (u_worldKind == 16) return hueShift(vec3(0.6,0.7,0.8), u_worldHue*6.28318);
    if (u_worldKind == 17) return hueShift(vec3(0.85,0.75,0.5), u_worldHue*6.28318);
    if (u_worldKind == 18) return hueShift(vec3(0.55,0.35,0.2), u_worldHue*6.28318);
    if (u_worldKind == 19) return hueShift(vec3(0.2,0.6,0.25), u_worldHue*6.28318);
    if (u_worldKind == 20) return hueShift(vec3(0.75,0.6,0.35), u_worldHue*6.28318);
    if (u_worldKind == 21) return hueShift(vec3(0.95,0.95,1.0), u_worldHue*6.28318);
    if (u_worldKind == 22) return hueShift(vec3(0.8,0.75,0.6), u_worldHue*6.28318);
    // Original worlds keep their material-based colours.
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
      // glow on nodes/synapse/window/screen (only for the matching world)
      if (u_worldKind == 0) {
        if (mat == 1 || mat == 2) col += vec3(0.3,0.8,1.0)*0.7;
        if (mat == 3) col += vec3(0.4,0.9,1.0);
      }
      if (u_worldKind == 3 && mat == 7) col += vec3(1.0,0.85,0.4)*0.9;
      if (u_worldKind == 4 && mat == 9) {
        // screen glow + scanlines + "EAOIN" flicker
        float scan = 0.5 + 0.5*sin(p.x*60.0 - u_time*3.0);
        col = vec3(0.1,0.6,0.4)*scan + vec3(0.05,0.3,0.2);
      }
      // Minecraft planet: add animated drifting clouds + a soft atmosphere.
      if (u_worldKind == 2 && mat == 5) {
        vec3 q = normalize(p) * 3.4;
        float cloud = noise(vec2(q.x*2.0 + u_time*0.12, q.z*2.0 - u_time*0.08));
        cloud = smoothstep(0.45, 0.8, cloud);
        col += vec3(1.0, 1.0, 0.95) * cloud * 0.5;
        // faint blue atmosphere halo on the edges.
        float atm = pow(clamp(1.0 - dot(n, normalize(ro - p)), 0.0, 1.0), 3.0);
        col += vec3(0.3,0.55,1.0) * atm * 0.6;
      }
      // Asteroid sparkle: warm rim glow.
      if (u_worldKind == 1 && mat == 4) {
        float rim = pow(clamp(1.0 - dot(n, normalize(ro - p)), 0.0, 1.0), 2.0);
        col += vec3(1.0,0.7,0.4) * rim * 0.5;
      }
    } else {
      col = renderBackground(rd, u_time);
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
        // u_size lets you make the hole absolutely massive.
        float h = RS * u_size * u_gravity * (1.0 + u_breath * 0.35 * sin(u_time * 2.0));

        float stepLen = clamp((r - h) * 0.4, 0.012, 1.4);
        if (r < h * 1.25) stepLen = 0.01;

        // Gravitational deflection: bend the ray toward the hole ~ 1/r^2.
        // u_lens scales how hard space bends around the hole.
        vec3 gAcc = -h * 0.8 * u_lens / max(r*r, 1e-4) * (pos / max(r, 1e-4));
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
          col += diskCol * swirl * thickFade * (0.6 + innerT*0.8) * 0.7 * u_showDisk * u_diskBright;
          // Photon spiral filaments — bright light threads wrapped around the disk.
          if (u_spiral > 0.001) {
            float ang = atan(pos.z, pos.x);
            float thread = noise(vec2(ang*8.0 - diskRad*2.0 - u_time*1.5*u_swirlSpeed, diskRad*0.8));
            thread = smoothstep(0.62, 0.9, thread);
            col += u_diskCol * thread * u_spiral * thickFade * edge * 1.6;
          }
        }

        // Photon-ring / bloom halo around the horizon for extra glow.
        // u_ringW tunes how wide the ring halo spreads; u_ringBands adds layers.
        float rglow = max(r - h, 0.0);
        float ringBase = exp(-rglow * (8.0 * u_ringW));
        col += u_glowCol * ringBase * u_glow * u_showGlow;
        if (u_ringBands > 0.001) {
          float band = 0.5 + 0.5*cos(rglow * 3.0 - u_time*2.0);
          col += u_glowCol * ringBase * band * u_ringBands * u_glow * 1.4;
        }

        // Warp streaks — radial light trails accelerating into the hole.
        if (u_warp > 0.001) {
          float ang = atan(pos.y, diskRad);
          float streak = noise(vec2(ang*40.0 - u_time*8.0*u_warp, diskRad*1.5));
          float rterm = exp(-rglow*3.0);
          col += u_starCol * smoothstep(0.8, 0.98, streak) * rterm * u_warp * 1.8;
        }

        // Drifting dust particles orbiting the hole.
        if (u_particles > 0.001) {
          float ang = atan(pos.z, pos.x) + u_time*0.5;
          vec2 op = vec2(diskRad*1.7, pos.y*3.0);
          float dust = step(0.985, noise(op + vec2(ang*3.0, 0.0)));
          col += vec3(1.0,0.9,0.7) * dust * u_particles * 0.8;
        }

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
        col += renderBackground(ray, u_time);
      }
      // Lens flare — a starburst halo straight out from the hole.
      if (u_flare > 0.001) {
        vec3 d2 = normalize(ray);
        float diskDot = abs(d2.y);
        float spike = pow(max(0.0, 1.0 - abs(atan(d2.x, d2.z))*0.8), 6.0)
                    + pow(max(0.0, 1.0 - abs(d2.y)*2.0), 3.0);
        col += u_glowCol * spike * u_flare * 0.8 * smoothstep(1.0, 0.3, diskDot);
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
/** A journey world — a distinct free-roam place rendered by the shader. */
export interface WorldDef {
  id: string;
  title: string;
  emoji: string;
  kind: number;   // shader generator index (u_worldKind)
  hue: number;    // palette hue 0..1
  param: number;  // per-world variation
  dist: number;   // comfortable framing distance
}

/** Every generator, and the distinct places it can become via hue/param variants. */
const WORLD_BASES: { kind: number; name: string; emoji: string; dist: number }[] = [
  { kind: 0, name: 'Neural Network', emoji: '🧠', dist: 9 },
  { kind: 1, name: 'Asteroid Field', emoji: '☄️', dist: 13 },
  { kind: 2, name: 'The Square Planet', emoji: '🟩', dist: 8 },
  { kind: 5, name: 'Jellyfish Ocean', emoji: '🪼', dist: 6 },
  { kind: 6, name: 'Psychedelic Tunnel', emoji: '🌈', dist: 6 },
  { kind: 7, name: 'Blood Stream', emoji: '🩸', dist: 6 },
  { kind: 8, name: 'Neuron Forest', emoji: '🧬', dist: 7 },
  { kind: 9, name: 'Earth Mountains', emoji: '🏔️', dist: 8 },
  { kind: 10, name: 'Sky City', emoji: '🌆', dist: 8 },
  { kind: 11, name: 'Crystal Cave', emoji: '💎', dist: 6 },
  { kind: 12, name: 'Lava Tunnels', emoji: '🌋', dist: 6 },
  { kind: 13, name: 'Ice Cavern', emoji: '🧊', dist: 6 },
  { kind: 14, name: 'Mushroom Grove', emoji: '🍄', dist: 6 },
  { kind: 15, name: 'Candy Land', emoji: '🍭', dist: 6 },
  { kind: 16, name: 'Infinite Hallway', emoji: '🛣️', dist: 6 },
  { kind: 17, name: 'Endless Desert', emoji: '🏜️', dist: 8 },
  { kind: 18, name: 'Great Volcano', emoji: '🌋', dist: 7 },
  { kind: 19, name: 'Deep Jungle', emoji: '🌴', dist: 7 },
  { kind: 20, name: 'Clockwork Core', emoji: '⚙️', dist: 6 },
  { kind: 21, name: 'Cloud Kingdom', emoji: '☁️', dist: 6 },
  { kind: 22, name: 'Stone Temple', emoji: '🏛️', dist: 6 },
];

/** Sub-variants — each base becomes several distinct rooms (not just colours:
 *  the param reshapes the geometry too, so every phase feels like its own area). */
const WORLD_VARIANTS: { suffix: string; hue: number; param: number }[] = [
  { suffix: '', hue: 0, param: 0 },
  { suffix: ' Aurora', hue: 0.06, param: 1 },
  { suffix: ' Neon', hue: 0.62, param: 2 },
  { suffix: ' Ember', hue: 0.04, param: 3 },
  { suffix: ' Azure', hue: 0.56, param: 4 },
  { suffix: ' Deep', hue: 0.32, param: 5 },
  { suffix: ' Storm', hue: 0.68, param: 6 },
];

function buildWorlds(): WorldDef[] {
  const out: WorldDef[] = [];
  for (const b of WORLD_BASES) {
    for (const v of WORLD_VARIANTS) {
      const slug = b.name.toLowerCase().replace(/[^a-z]/g, '');
      const vslug = v.suffix.toLowerCase().replace(/[^a-z]/g, '');
      out.push({
        id: `w_${slug}${vslug}`,
        title: b.name + v.suffix,
        emoji: b.emoji,
        kind: b.kind,
        hue: v.hue,
        param: v.param,
        dist: b.dist,
      });
    }
  }
  // The final two worlds are where the passcode lives.
  out.push({ id: 'house', title: 'The House', emoji: '🏠', kind: 3, hue: 0, param: 0, dist: 6 });
  out.push({ id: 'monitor', title: 'The Monitor', emoji: '🖥️', kind: 4, hue: 0, param: 0, dist: 5 });
  return out;
}

/** 70 generated places + The House + The Monitor = 72 journey worlds. */
export const JOURNEY_WORLDS: WorldDef[] = buildWorlds();

/** World stages start here so they never collide with the void stage (6). */
export const WORLD_START = 100;
/** The final stage — where the passcode appears. */
export const MONITOR_STAGE = WORLD_START + JOURNEY_WORLDS.length - 1;

interface Camera {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** The order you travel: black hole → void → 72 worlds → … → the monitor. */
const STAGE_ORDER = [0, 6, ...JOURNEY_WORLDS.map((_, i) => WORLD_START + i)] as const;

/**
 * How deep you must be before flying toward the centre (while looking STRAIGHT
 * into it) advances to the next area. Making this small means entering the
 * black hole doesn't snap you to the void/next world — you have to fly really
 * deep and look directly into the centre to fall through.
 */
export const PORTAL_IN_RADIUS = 0.55;
/** Radius at which flying to the centre and looking away retreats a stage. */
export const PORTAL_BACK_RADIUS = 0.45;
/** How directly you must be looking at the centre to go deeper (near-straight). */
export const LOOK_IN = 0.6;
/** How directly you must be looking away to go back. */
export const LOOK_OUT = -0.5;
/** Minimum seconds between transitions so you can't bounce in and out. */
export const PORTAL_COOLDOWN = 0.9;

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
  if (stage === 0) return 4;      // black hole external
  if (stage === 6) return 5;      // void interior
  if (stage >= WORLD_START) {
    const w = JOURNEY_WORLDS[stage - WORLD_START];
    return w ? w.dist : 4;
  }
  return 4;
}

/** The WorldDef for a given stage (or null if not a journey world). */
export function worldForStage(stage: number): WorldDef | null {
  if (stage < WORLD_START) return null;
  return JOURNEY_WORLDS[stage - WORLD_START] ?? null;
}

function spawnForStage(stage: number): Camera {
  if (stage === 6) return { x: 0, y: 0, z: -5, yaw: 0, pitch: 0 }; // void — deep inside; turn around to see out
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
  // Backgrounds + massive-hole tuning (Part 3)
  bgIndex: number;     // which background the black hole sits in
  bgHue: number;       // background palette hue (sub-variants)
  bgSpeed: number;     // background animation speed
  holeSize: number;    // horizon SIZE multiplier — crank it to go massive
  diskBright: number;  // accretion-disk brightness
  ringW: number;       // photon-ring width
  lens: number;        // gravitational lensing strength
  // Input direction fixes (configurable)
  zoomInvert: boolean; // false = scroll up zooms in
  lookInvert: boolean; // false = drag right looks right
  // Extra VFX (Part 4)
  spiral: number;      // photon spiral filaments 0..1
  flare: number;       // lens-flare brightness 0..1
  particles: number;   // drifting dust particles 0..1
  warp: number;        // radial warp streaks 0..1
  ringBands: number;   // extra photon-ring bands 0..1
  vignette: number;    // vignette strength 0..1
  density: number;     // world geometry density 0.3..2
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
  bgIndex: 0,
  bgHue: 0,
  bgSpeed: 1,
  holeSize: 1,
  diskBright: 1,
  ringW: 1,
  lens: 1,
  zoomInvert: false,
  lookInvert: false,
  spiral: 0,
  flare: 0,
  particles: 0,
  warp: 0,
  ringBands: 0,
  vignette: 1,
  density: 1,
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

// ---- Backgrounds (the stunning scene the black hole sits in) --------------

export interface BackgroundDef { id: string; label: string; emoji: string; index: number; hue: number; }

/** The base generator each background is drawn from. */
const BG_GENERATORS: { name: string; emoji: string; index: number; hue: number }[] = [
  { name: 'Deep Space', emoji: '🌌', index: 0, hue: 0 },
  { name: 'Galaxy', emoji: '🌀', index: 1, hue: 0 },
  { name: 'Nebula', emoji: '☁️', index: 2, hue: 0 },
  { name: 'Psychedelic', emoji: '🌈', index: 3, hue: 0 },
  { name: 'Mountains', emoji: '🏔️', index: 4, hue: 0 },
  { name: 'City', emoji: '🌃', index: 5, hue: 0 },
  { name: 'Blood Cells', emoji: '🩸', index: 6, hue: 0 },
  { name: 'Brain', emoji: '🧠', index: 7, hue: 0 },
  { name: 'Cosmos', emoji: '🌠', index: 8, hue: 0 },
  { name: 'Grid', emoji: '🔲', index: 9, hue: 0 },
  { name: 'Fire', emoji: '🔥', index: 10, hue: 0 },
  { name: 'Ice', emoji: '❄️', index: 11, hue: 0 },
  { name: 'Lava', emoji: '🌋', index: 12, hue: 0 },
  { name: 'Rainbow', emoji: '🎨', index: 13, hue: 0 },
];

/** Named hue variants — each base generator becomes several backgrounds. */
const BG_VARIANTS: { label: string; hue: number }[] = [
  { label: '', hue: 0 },
  { label: ' Aurora', hue: 40 },
  { label: ' Neon', hue: 200 },
  { label: ' Ember', hue: 55 },
];

function buildBackgrounds(): BackgroundDef[] {
  const out: BackgroundDef[] = [];
  for (const gen of BG_GENERATORS) {
    for (const v of BG_VARIANTS) {
      out.push({ id: `bg_${gen.name.toLowerCase().replace(/[^a-z]/g, '')}${v.label.toLowerCase().replace(/[^a-z]/g, '')}`, label: gen.name + v.label, emoji: gen.emoji, index: gen.index, hue: (gen.hue + v.hue) % 360 });
    }
  }
  return out;
}

/** 56 selectable backgrounds — each is a generator + a hue sub-variant. */
export const BLACK_HOLE_BACKGROUNDS: BackgroundDef[] = buildBackgrounds();

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
  { key: 'holeSize', label: 'Hole size (go massive)', kind: 'slider', min: 0.3, max: 4, step: 0.05 },
  { key: 'diskBright', label: 'Disk brightness', kind: 'slider', min: 0, max: 3, step: 0.05 },
  { key: 'ringW', label: 'Photon ring width', kind: 'slider', min: 0.3, max: 3, step: 0.05 },
  { key: 'lens', label: 'Lensing strength', kind: 'slider', min: 0, max: 2.5, step: 0.05 },
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
  { key: 'zoomInvert', label: 'Invert zoom', kind: 'toggle' },
  { key: 'lookInvert', label: 'Invert look', kind: 'toggle' },
  { key: 'spiral', label: 'Photon spirals', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'flare', label: 'Lens flare', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'particles', label: 'Dust particles', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'warp', label: 'Warp streaks', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'ringBands', label: 'Ring bands', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'vignette', label: 'Vignette', kind: 'slider', min: 0, max: 1, step: 0.01 },
  { key: 'density', label: 'World density', kind: 'slider', min: 0.3, max: 2, step: 0.05 },
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
  const [bgGalleryOpen, setBgGalleryOpen] = useState(false); // backgrounds panel
  const [customizeOpen, setCustomizeOpen] = useState(false); // top Customize bar
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
  /** Timestamp of the last portal transition — prevents instant bounce-back. */
  const lastTransitionRef = useRef(0);
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
      c.yaw += dx * 0.006 * (optsRef.current.lookInvert ? -1 : 1);
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
      // Slow accumulation so one notch moves the camera just a little — you can
      // zoom into the hole and stop at each area instead of flying to the end.
      // zoomInvert (false by default) means scroll UP = zoom IN.
      const sign = optsRef.current.zoomInvert ? 1 : -1;
      scrollAccumRef.current += e.deltaY * 0.006 * sign;
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
      bgIndex: gl.getUniformLocation(prog, 'u_bgIndex'),
      bgHue: gl.getUniformLocation(prog, 'u_bgHue'),
      bgSpeed: gl.getUniformLocation(prog, 'u_bgSpeed'),
      size: gl.getUniformLocation(prog, 'u_size'),
      diskBright: gl.getUniformLocation(prog, 'u_diskBright'),
      ringW: gl.getUniformLocation(prog, 'u_ringW'),
      lens: gl.getUniformLocation(prog, 'u_lens'),
      spiral: gl.getUniformLocation(prog, 'u_spiral'),
      flare: gl.getUniformLocation(prog, 'u_flare'),
      particles: gl.getUniformLocation(prog, 'u_particles'),
      warp: gl.getUniformLocation(prog, 'u_warp'),
      ringBands: gl.getUniformLocation(prog, 'u_ringBands'),
      vignette: gl.getUniformLocation(prog, 'u_vignette'),
      density: gl.getUniformLocation(prog, 'u_density'),
      worldKind: gl.getUniformLocation(prog, 'u_worldKind'),
      worldHue: gl.getUniformLocation(prog, 'u_worldHue'),
      worldParam: gl.getUniformLocation(prog, 'u_worldParam'),
      worldScale: gl.getUniformLocation(prog, 'u_worldScale'),
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
      // Scroll flies forward/back. The wheel handler already bakes in the
      // direction, so we just move along the forward axis by the accumulated
      // amount (slow, so zooming into the hole stops at each area).
      if (Math.abs(scrollAccumRef.current) > 0.0001) {
        const s = scrollAccumRef.current * 2.0;
        c.x += fwd.x * s; c.y += fwd.y * s; c.z += fwd.z * s;
        scrollAccumRef.current = 0;
      }

      // Portal transition: only when near the centre AND looking into/away,
      // and never immediately after a transition (cooldown prevents bouncing
      // back out as soon as you arrive).
      const dist = Math.hypot(c.x, c.y, c.z);
      let lookDot = 0;
      if (dist > 1e-4) lookDot = (fwd.x * -c.x + fwd.y * -c.y + fwd.z * -c.z) / dist;
      const nowMs = performance.now();
      const dir = portalTransition(dist, lookDot);
      if (dir !== 0 && nowMs - lastTransitionRef.current > PORTAL_COOLDOWN * 1000) {
        const next = dir === 1 ? nextStageOf(stage) : prevStageOf(stage);
        if (next !== stage) {
          lastTransitionRef.current = nowMs;
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
      gl.uniform1i(U.bgIndex, o.bgIndex);
      gl.uniform1f(U.bgHue, (o.bgHue * Math.PI) / 180);
      gl.uniform1f(U.bgSpeed, o.bgSpeed);
      gl.uniform1f(U.size, o.holeSize);
      gl.uniform1f(U.diskBright, o.diskBright);
      gl.uniform1f(U.ringW, o.ringW);
      gl.uniform1f(U.lens, o.lens);
      gl.uniform1f(U.spiral, o.spiral);
      gl.uniform1f(U.flare, o.flare);
      gl.uniform1f(U.particles, o.particles);
      gl.uniform1f(U.warp, o.warp);
      gl.uniform1f(U.ringBands, o.ringBands);
      gl.uniform1f(U.vignette, o.vignette);
      gl.uniform1f(U.density, o.density);
      // Journey world scene: which generator, hue, param and scale to render.
      const world = worldForStage(stageRef.current);
      if (world) {
        gl.uniform1i(U.worldKind, world.kind);
        gl.uniform1f(U.worldHue, world.hue);
        gl.uniform1f(U.worldParam, world.param);
        gl.uniform1f(U.worldScale, 1);
      } else {
        gl.uniform1i(U.worldKind, 0);
        gl.uniform1f(U.worldHue, 0);
        gl.uniform1f(U.worldParam, 0);
        gl.uniform1f(U.worldScale, 1);
      }
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

  // --- Make the studio panels draggable by grabbing their header bar --------
  useEffect(() => {
    const ctx = { active: false, el: null as HTMLDivElement | null, sx: 0, sy: 0, ox: 0, oy: 0 };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('button')) return; // let buttons work (✕, modes, etc.)
      const head = t.closest('.singularity-panel-head');
      if (!head) return;
      const panel = head.closest('.singularity-panel') as HTMLDivElement | null;
      if (!panel) return;
      ctx.active = true;
      ctx.el = panel;
      ctx.sx = e.clientX; ctx.sy = e.clientY;
      ctx.ox = panel.offsetLeft; ctx.oy = panel.offsetTop;
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!ctx.active || !ctx.el) return;
      ctx.el.style.left = `${Math.max(0, ctx.ox + e.clientX - ctx.sx)}px`;
      ctx.el.style.top = `${Math.max(0, ctx.oy + e.clientY - ctx.sy)}px`;
    };
    const onUp = () => { ctx.active = false; ctx.el = null; };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const selectBackground = (b: BackgroundDef) => {
    setOpts((o) => ({ ...o, bgIndex: b.index, bgHue: b.hue }));
  };

  // Free-fly journey: stage is driven by flying through the centre portal while
  // looking into it (deeper) or away (back). Moving sideways/up/down explores
  // freely within the current area.
  const isJourney = stageIdx !== 0;

  // Bridge so the render-loop's portal transition can update React state.
  setStageIdxProxy.current = (stage: number) => {
    setStageIdx(stage);
    setJourney(stage !== 0);
  };

  const world = worldForStage(stageIdx);
  const currentStage = stageIdx === 6
    ? { id: 'void', title: 'The Void', emoji: '🕳️', desc: 'Inside the hole. Look around — back out you see the universe; the way deeper glows ahead.' }
    : world
      ? { id: world.id, title: world.title, emoji: world.emoji, desc: 'A place inside the singularity. Roam it freely — dive STRAIGHT into the centre to fall to the next phase.' }
      : { id: 'hole', title: 'The Black Hole', emoji: '🕳️', desc: '' };
  const phase = stageIdx === 6 ? 1 : stageIdx >= WORLD_START ? stageIdx - WORLD_START + 1 : 0;

  /** "Next" — jump straight to the next world without zooming all the way in. */
  const goNext = () => {
    const next = nextStageOf(stageRef.current);
    if (next === stageRef.current) return;
    lastTransitionRef.current = performance.now();
    const s = spawnForStage(next);
    const c = camRef.current;
    c.x = s.x; c.y = s.y; c.z = s.z; c.yaw = s.yaw; c.pitch = s.pitch;
    stageRef.current = next;
    setStageIdxProxy.current(next);
  };
  /** "Prev" — step back a world. */
  const goPrev = () => {
    const prev = prevStageOf(stageRef.current);
    if (prev === stageRef.current) return;
    lastTransitionRef.current = performance.now();
    const s = spawnForStage(prev);
    const c = camRef.current;
    c.x = s.x; c.y = s.y; c.z = s.z; c.yaw = s.yaw; c.pitch = s.pitch;
    stageRef.current = prev;
    setStageIdxProxy.current(prev);
  };

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

      {/* Top CUSTOMIZE bar — a hub with thousands of knobs */}
      <div className="singularity-topbar">
        <button className={`singularity-topbar-btn ${customizeOpen ? 'active' : ''}`}
          onClick={() => setCustomizeOpen((v) => !v)}>⚙️ Customize</button>
        <button className="singularity-topbar-btn" onClick={() => { setBgGalleryOpen((v) => !v); setCustomizeOpen(false); }}>
          🖼 Backgrounds</button>
        <button className="singularity-topbar-btn" onClick={() => { setPresetOpen((v) => !v); setCustomizeOpen(false); }}>🎛 Hole look</button>
        <button className="singularity-topbar-btn" onClick={() => { setTuneOpen((v) => !v); setCustomizeOpen(false); }}>🎚 Tune</button>
        <button className="singularity-topbar-btn" onClick={() => { setItemsMode((v) => !v); setCustomizeOpen(false); }}>🎯 Items</button>
        <button className="singularity-topbar-btn" onClick={resetView}>↺ Reset</button>
      </div>
      {customizeOpen && (
        <div className="singularity-customize-menu">
          <div className="singularity-studio-sec">Quick configure</div>
          <div className="singularity-mode-row">
            <button className="singularity-mode-btn" onClick={() => { setBgGalleryOpen(true); setCustomizeOpen(false); }}>🖼 Pick a background</button>
            <button className="singularity-mode-btn" onClick={() => { setPresetOpen(true); setCustomizeOpen(false); }}>🎛 Hole presets & colours</button>
            <button className="singularity-mode-btn" onClick={() => { setTuneOpen(true); setCustomizeOpen(false); }}>🎚 Tune bars</button>
            <button className="singularity-mode-btn" onClick={() => { setItemsMode(true); setCustomizeOpen(false); }}>🎯 Grab / throw</button>
          </div>
          <div className="singularity-studio-sec">Wacky & fluid (left panel)</div>
          <div className="singularity-toggle-row">
            {STUDIO_WACKY.filter((c) => c.kind === 'toggle').map((c) => (
              <label key={c.key}><input type="checkbox" checked={opts[c.key] as boolean}
                onChange={(e) => patchOpts({ [c.key]: e.target.checked } as Partial<BlackHoleOpts>)} /> {c.label}</label>
            ))}
          </div>
        </div>
      )}

      <div className="singularity-hint">
        {isJourney
          ? `Inside: ${currentStage.title} — roam freely • dive STRAIGHT into the centre to fall to the next phase (${phase}/${JOURNEY_WORLDS.length})`
          : 'WASD/arrows move • Space/Shift up/down • scroll flies • drag to look • dive DEEP into the centre and look straight into it to fall through'}
      </div>

      {/* Quick travel — jump to the next/prev world without zooming. */}
      <div className="singularity-quicktravel">
        <button className="singularity-qbtn prev" onClick={goPrev} disabled={stageIdx === 0} aria-label="Previous phase">◀</button>
        <button className="singularity-qbtn next" onClick={goNext} disabled={stageIdx === MONITOR_STAGE} aria-label="Next phase">Next ▶</button>
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
      {!bgGalleryOpen && (
        <button className="singularity-float bg" onClick={() => setBgGalleryOpen(true)} aria-label="Open backgrounds">🖼</button>
      )}

      {/* BACKGROUND GALLERY — 50+ scenes the black hole sits in */}
      {bgGalleryOpen && (
        <div className="singularity-panel bg">
          <div className="singularity-panel-head">
            <span>🖼 Backgrounds · {BLACK_HOLE_BACKGROUNDS.length}</span>
            <button className="singularity-panel-x" onClick={() => setBgGalleryOpen(false)} aria-label="Close backgrounds">✕</button>
          </div>
          <div className="singularity-panel-body">
            <div className="singularity-studio-sec">Where the hole sits</div>
            <div className="singularity-preset-scroll">
              <div className="singularity-bg-grid">
                {BLACK_HOLE_BACKGROUNDS.map((b) => (
                  <button key={b.id}
                    className={`singularity-bg-chip ${opts.bgIndex === b.index && Math.round(opts.bgHue) === b.hue ? 'active' : ''}`}
                    onClick={() => selectBackground(b)}>
                    <span className="singularity-preset-emoji">{b.emoji}</span>
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="singularity-studio-sec">Background tune</div>
            <label className="singularity-slider">
              <span>Palette (sub-variants)</span>
              <input type="range" min={0} max={359} step={5} value={opts.bgHue}
                onChange={(e) => patchOpts({ bgHue: Number(e.target.value) })} />
              <b>{opts.bgHue}°</b>
            </label>
            <label className="singularity-slider">
              <span>Motion</span>
              <input type="range" min={0} max={3} step={0.1} value={opts.bgSpeed}
                onChange={(e) => patchOpts({ bgSpeed: Number(e.target.value) })} />
              <b>{opts.bgSpeed.toFixed(1)}×</b>
            </label>
            <p className="singularity-studio-note">Every background is a generator + a palette sub-variant — combine freely.</p>
          </div>
        </div>
      )}

      {/* Journey depth HUD (no buttons — purely physical zoom) */}
      {isJourney && (
        <div className="singularity-stage">
          <div className="singularity-stage-title">{currentStage.emoji} {currentStage.title} <span className="singularity-phase">Phase {phase}/{JOURNEY_WORLDS.length}</span></div>
          <div className="singularity-stage-desc">{currentStage.desc}</div>
          <div className="singularity-stage-progress"><div className="singularity-stage-progress-fill" style={{ width: `${Math.min(100, (phase / JOURNEY_WORLDS.length) * 100)}%` }} /></div>

          {stageIdx === MONITOR_STAGE && (
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
