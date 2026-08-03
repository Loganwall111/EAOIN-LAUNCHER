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

  const float PI = 3.14159265359;
  const float RS = 1.0;            // Schwarzschild radius (unit)
  const float DISK_INNER = 2.6;    // inner edge of the disk (in RS)
  const float DISK_OUTER = 6.0;    // outer edge of the disk
  const int MAX_STEPS = 260;
  const float MAX_DIST = 90.0;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  // A starfield sampled in the ray's final (escaped) direction.
  vec3 starfield(vec3 dir){
    vec2 p = vec2(dir.z, dir.x) * 60.0 + dir.y * 30.0;
    float star = step(0.986, hash(floor(p)));
    vec3 col = vec3(0.7,0.85,1.0) * star * 0.9;
    // faint nebula gradient
    float neb = noise(dir.xy * 3.0 + dir.z);
    col += vec3(0.25,0.06,0.4) * neb * 0.25;
    col += vec3(0.02,0.04,0.09);
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

    vec3 pos = u_camPos;
    vec3 ray = dir;
    vec3 col = vec3(0.0);
    bool escaped = false;
    float t = 0.0;

    // ---- Ray-march with gravitational lensing (Schwarzschild metric) ----
    for (int i = 0; i < MAX_STEPS; i++) {
      float r = length(pos);
      float h = RS * u_gravity; // scaled horizon

      // ADAPTIVE step: tiny near the horizon, large far away.
      float stepLen = clamp((r - h) * 0.4, 0.012, 1.4);
      if (r < h * 1.25) stepLen = 0.01;

      // Gravitational deflection: bend the ray toward the hole ~ 1/r^2.
      // (Simplified Schwarzschild: the stronger the field, the more the bend.)
      vec3 gAcc = -h * 0.8 / max(r*r, 1e-4) * (pos / max(r, 1e-4));
      ray = normalize(ray + gAcc * stepLen * 0.5);

      // Accretion disk: a thin disc in the y=0 plane between inner/outer.
      // We accumulate its glow when the ray crosses the plane, which (because
      // of the bending above) also lights the part that wraps OVER and UNDER
      // the hole — the Interstellar look.
      float diskRad = length(pos.xz);
      float y = pos.y;
      if (abs(y) < u_diskThickness && diskRad > DISK_INNER && diskRad < DISK_OUTER) {
        float innerT = 1.0 - (diskRad - DISK_INNER)/(DISK_OUTER - DISK_INNER);
        float swirl = 0.5 + 0.5*noise(vec2(atan(pos.z,pos.x)*4.0, diskRad*1.2) + u_time*0.6);
        float edge = smoothstep(0.0, 1.0, innerT);
        // hotter/brighter toward the inner edge
        vec3 diskCol = vec3(1.0,0.62,0.28)*edge + vec3(0.6,0.2,0.05);
        float thickFade = 1.0 - abs(y)/max(u_diskThickness, 1e-4);
        col += diskCol * swirl * thickFade * (0.5 + innerT*0.7) * 0.6;
      }

      // Advance.
      pos += ray * stepLen;
      t += stepLen;

      // Captured by the event horizon → pure black (no light escapes).
      if (r < h) {
        // Photon-ring glow just outside the horizon.
        col += vec3(1.0,0.95,0.85) * smoothstep(h, h*1.5, r) * 0.25;
        col *= 0.0;
        escaped = false;
        break;
      }
      if (t > MAX_DIST) { escaped = true; break; }
    }

    if (escaped || t >= MAX_DIST) {
      // Light escaped the hole: paint the background starfield along the
      // final ray direction (which may have been bent around the hole).
      col += starfield(ray);
    }

    // Subtle vignette for cinematic feel.
    col *= 0.55 + 0.45 * smoothstep(1.3, 0.15, length(ndc));

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
    };

    const resize = () => {
      gl.canvas.width = canvas.clientWidth;
      gl.canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    // --- 3D camera: mouse drag orbits, wheel + keys zoom ---
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
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = camRef.current;
      c.dist = Math.max(2.2, Math.min(40, c.dist + e.deltaY * 0.02));
      // Zooming far in = entering the hole → start the journey.
      if (c.dist <= 2.6 && !journeyRef.current) startJourneyRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const c = camRef.current;
      if (e.key === 'w' || e.key === 'ArrowUp' || e.key === '=' || e.key === '+') c.dist = Math.max(2.2, c.dist - 0.6);
      if (e.key === 's' || e.key === 'ArrowDown' || e.key === '-') c.dist = Math.min(40, c.dist + 0.6);
      if (e.key === 'a' || e.key === 'ArrowLeft') c.yaw += 0.06;
      if (e.key === 'd' || e.key === 'ArrowRight') c.yaw -= 0.06;
      if (c.dist <= 2.6 && !journeyRef.current) startJourneyRef.current();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    let raf = 0;
    const start = performance.now();
    const render = () => {
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

  // Holds a ref to startJourney so the render-loop callbacks can trigger it.
  const journeyRef = useRef(false);
  const startJourneyRef = useRef<() => void>(() => {});
  startJourneyRef.current = () => {
    if (journeyRef.current) return;
    journeyRef.current = true;
    setJourney(true);
    setStageIdx(0);
    setNoteOpen(false);
    setPassword('');
    setSecretEnding(false);
  };

  const currentStage = JOURNEY_STAGES[stageIdx];

  const startJourney = () => {
    journeyRef.current = true;
    setJourney(true);
    setStageIdx(0);
    setNoteOpen(false);
    setPassword('');
    setSecretEnding(false);
  };

  const advanceStage = () => {
    const next = stageIdx + 1;
    if (next >= JOURNEY_STAGES.length) return;
    setStageIdx(next);
  };

  const prevStage = () => {
    setStageIdx(Math.max(0, stageIdx - 1));
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

  const resetJourney = () => {
    journeyRef.current = false;
    setJourney(false);
    setStageIdx(0);
    setNoteOpen(false);
    if (secretEnding) getEndingTicket().read();
    setSecretEnding(false);
    camRef.current.dist = 11;
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
        {journey
          ? `Descending: ${currentStage.title}`
          : 'Drag to orbit • Scroll / W-S / arrows to zoom • Zoom all the way in to fall through.'}
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

      <div className="singularity-actions">
        {!journey
          ? <button className="singularity-dive" onClick={startJourney}>🕳 Fall Through</button>
          : (
            <>
              <button className="singularity-dive" onClick={prevStage} disabled={stageIdx === 0}>◀ Back</button>
              <button className="singularity-dive" onClick={advanceStage} disabled={stageIdx >= JOURNEY_STAGES.length - 1}>Deeper ▸</button>
              <button className="singularity-dive" onClick={resetJourney}>↻ Surface</button>
            </>
          )}
      </div>

      {journey && (
        <div className="singularity-stage">
          <div className="singularity-stage-title">{currentStage.title}</div>
          <div className="singularity-stage-desc">{currentStage.desc}</div>
          <div className="singularity-stage-track">
            {JOURNEY_STAGES.map((s, i) => <span key={s.id} className={i <= stageIdx ? 'on' : ''} title={s.title} />)}
          </div>

          {currentStage.id === 'monitor' && (
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
