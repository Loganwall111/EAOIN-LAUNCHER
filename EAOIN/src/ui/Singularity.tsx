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

  const float PI = 3.14159265359;
  const float RS = 1.0;            // Schwarzschild radius (unit)
  const float DISK_INNER = 2.6;    // inner edge of the disk (in RS)
  const float DISK_OUTER = 6.0;    // outer edge of the disk
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

  // A starfield sampled in the ray's final (escaped) direction.
  vec3 starfield(vec3 dir){
    vec2 p = vec2(dir.z, dir.x) * 60.0 + dir.y * 30.0;
    float star = step(0.984, hash(floor(p)));
    vec3 col = vec3(0.7,0.85,1.0) * star * 0.9;
    float neb = noise(dir.xy * 3.0 + vec2(dir.z, dir.z));
    col += vec3(0.25,0.06,0.4) * neb * 0.25;
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
    vec2 ndc = (uv - 0.5) * vec2(u_aspect, 1.0);

    // Build a right-handed camera basis from eye→target.
    vec3 fwd = normalize(u_camTarget - u_camPos);
    vec3 right = normalize(cross(fwd, vec3(0.0,1.0,0.0)));
    vec3 up = cross(right, fwd);
    float fov = 1.35; // ~1/tan(fov/2); bigger = wider
    vec3 dir = normalize(ndc.x*right + ndc.y*up + fwd*fov);

    // ---- Journey worlds: render a distinct scene per stage ----
    if (u_stage >= 1) {
      vec3 col = renderWorld(u_camPos, dir);
      col *= 0.6 + 0.4 * smoothstep(1.3, 0.15, length(ndc));
      gl_FragColor = vec4(col, 1.0);
      return;
    }

    vec3 pos = u_camPos;
    vec3 ray = dir;
    vec3 col = vec3(0.0);
    bool escaped = false;
    float t = 0.0;

    // ---- Ray-march with gravitational lensing (Schwarzschild metric) ----
    for (int i = 0; i < MAX_STEPS; i++) {
      float r = length(pos);
      float h = RS * u_gravity; // scaled horizon

      float stepLen = clamp((r - h) * 0.4, 0.012, 1.4);
      if (r < h * 1.25) stepLen = 0.01;

      // Gravitational deflection: bend the ray toward the hole ~ 1/r^2.
      vec3 gAcc = -h * 0.8 / max(r*r, 1e-4) * (pos / max(r, 1e-4));
      ray = normalize(ray + gAcc * stepLen * 0.5);

      // Accretion disk with extra glow.
      float diskRad = length(pos.xz);
      float y = pos.y;
      if (abs(y) < u_diskThickness && diskRad > DISK_INNER && diskRad < DISK_OUTER) {
        float innerT = 1.0 - (diskRad - DISK_INNER)/(DISK_OUTER - DISK_INNER);
        float swirl = 0.5 + 0.5*noise(vec2(atan(pos.z,pos.x)*4.0, diskRad*1.2) + u_time*0.6);
        float edge = smoothstep(0.0, 1.0, innerT);
        vec3 diskCol = vec3(1.0,0.62,0.28)*edge + vec3(0.6,0.2,0.05);
        float thickFade = 1.0 - abs(y)/max(u_diskThickness, 1e-4);
        col += diskCol * swirl * thickFade * (0.6 + innerT*0.8) * 0.7;
      }

      // Photon-ring / bloom halo around the horizon for extra glow.
      float rglow = max(r - h, 0.0);
      col += vec3(1.0,0.85,0.6) * exp(-rglow*8.0) * 0.35;

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
    col += col*col*0.4;
    col *= 0.6 + 0.4 * smoothstep(1.3, 0.15, length(ndc));

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
  yaw: number;
  pitch: number;
  dist: number;
}

/**
 * Map camera distance to a journey stage, purely physical (no buttons):
 *   - far out  → black hole (stage 0)
 *   - zoom in  → neural (1) → asteroids (2) → planet (3) → house (4) → monitor (5)
 *   - zoom out / look back → reverse, seeing everything again.
 */
export function stageFromDist(dist: number): number {
  if (dist >= 8) return 0;        // black hole
  if (dist >= 6.2) return 1;      // neural network
  if (dist >= 4.6) return 2;      // asteroid field
  if (dist >= 3.2) return 3;      // Minecraft planet
  if (dist >= 2.6) return 4;      // house
  return 5;                        // monitor (deepest)
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
  const [diskThickness, setDiskThickness] = useState(0.35);
  const [gravity, setGravity] = useState(1.0);
  const diskThicknessRef = useRef(diskThickness);
  const gravityRef = useRef(gravity);
  diskThicknessRef.current = diskThickness;
  gravityRef.current = gravity;

  const camRef = useRef<Camera>({ yaw: 0.6, pitch: 0.32, dist: 11 });
  const stageRef = useRef(0);
  const lastStageRef = useRef(0);
  const setStageIdxProxy = useRef<(s: number) => void>(() => {});

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
    };

    const resize = () => {
      gl.canvas.width = canvas.clientWidth;
      gl.canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    // --- 3D camera: mouse drag orbits, wheel + keys zoom ---
    // Physical zoom: camera distance drives the stage. Zoom in past each
    // threshold and you fall into the next world; zoom back out (or turn
    // around / look back) and you reverse to see everything again.
    const drag = { down: false, lastX: 0, lastY: 0 };
    const onPointerDown = (e: PointerEvent) => { drag.down = true; drag.lastX = e.clientX; drag.lastY = e.clientY; };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag.down) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX; drag.lastY = e.clientY;
      const c = camRef.current;
      c.yaw -= dx * 0.006;
      c.pitch = Math.max(-1.35, Math.min(1.35, c.pitch + dy * 0.006));
    };
    const onPointerUp = () => { drag.down = false; };
    const applyZoom = () => {
      // Recompute stage purely from camera distance.
      const stage = stageFromDist(camRef.current.dist);
      if (stage !== lastStageRef.current) {
        lastStageRef.current = stage;
        stageRef.current = stage;
        // Sync React state (only when it changes).
        setStageIdxProxy.current(stage);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = camRef.current;
      c.dist = Math.max(2.2, Math.min(40, c.dist + e.deltaY * 0.02));
      applyZoom();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const c = camRef.current;
      if (e.key === 'w' || e.key === 'ArrowUp' || e.key === '=' || e.key === '+') c.dist = Math.max(2.2, c.dist - 0.6);
      if (e.key === 's' || e.key === 'ArrowDown' || e.key === '-') c.dist = Math.min(40, c.dist + 0.6);
      if (e.key === 'a' || e.key === 'ArrowLeft') c.yaw += 0.06;
      if (e.key === 'd' || e.key === 'ArrowRight') c.yaw -= 0.06;
      applyZoom();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    let raf = 0;
    const start = performance.now();
    const render = () => {
      applyZoom(); // keep the stage in sync with camera distance every frame
      const t = (performance.now() - start) / 1000;
      const c = camRef.current;
      // Orbit camera: yaw around Y, pitch up/down, radius = dist.
      const cp = Math.cos(c.pitch);
      const eye = new Float32Array([
        Math.sin(c.yaw) * cp * c.dist,
        Math.sin(c.pitch) * c.dist,
        Math.cos(c.yaw) * cp * c.dist,
      ]);
      gl.useProgram(prog);
      gl.uniform2f(U.res, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(U.time, t);
      gl.uniform3f(U.camPos, eye[0], eye[1], eye[2]);
      gl.uniform3f(U.camTarget, 0, 0, 0);
      gl.uniform1f(U.diskThickness, diskThicknessRef.current);
      gl.uniform1f(U.gravity, gravityRef.current);
      gl.uniform1f(U.aspect, gl.canvas.width / Math.max(1, gl.canvas.height));
      gl.uniform1i(U.stage, stageRef.current);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };
    render();

    const cleanup = () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(raf);
    };
    (window as any).__singularityCleanup = cleanup;

    return cleanup;
  }, []);

  // Physical, button-free journey: stage is driven purely by camera zoom.
  // Zoom in → fall deeper; zoom out / look back → reverse and see everything.
  const isJourney = stageIdx >= 1;

  // Bridge so the render-loop's applyZoom can update React state.
  setStageIdxProxy.current = (stage: number) => {
    setStageIdx(stage);
    setJourney(stage >= 1);
  };

  const currentStage = JOURNEY_STAGES[Math.max(0, Math.min(stageIdx, JOURNEY_STAGES.length - 1))];

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
          ? `Descending: ${currentStage.title} — zoom out or look back to surface`
          : 'Drag to orbit • Scroll / W-S / arrows to zoom • Zoom all the way in to fall through'}
      </div>

      {/* Camera-control sliders */}
      <div className="singularity-controls">
        <label className="singularity-slider">
          <span>💿 Disk thickness</span>
          <input type="range" min={0.08} max={0.8} step={0.02} value={diskThickness}
            onChange={(e) => setDiskThickness(Number(e.target.value))} />
        </label>
        <label className="singularity-slider">
          <span>🌌 Gravity strength</span>
          <input type="range" min={0.3} max={2.2} step={0.05} value={gravity}
            onChange={(e) => setGravity(Number(e.target.value))} />
        </label>
      </div>

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
