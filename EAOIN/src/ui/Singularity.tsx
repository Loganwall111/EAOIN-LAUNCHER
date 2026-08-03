/**
 * Singularity — a shader-based black hole you can explore on the main menu.
 *
 * 2.0 Update Part 2's headline feature. This is NOT a game mode — it's a tab
 * on the main menu called Singularity. It renders a real black hole with:
 *   - A gravitational-lensing shader (light bends around the event horizon).
 *   - A swirling accretion disc + vortex.
 *   - Mouse-move parallax so you can pan the camera around the hole.
 *   - A zoom-in "journey" that flies you through the hole toward a hidden
 *     neural-network / world with a note (ARG tie-in).
 *
 * Implemented with a full-screen WebGL fragment shader (no Babylon entity) so
 * it reads as a genuine lensing effect, not a model with a black sprite.
 */
import { useEffect, useRef, useState } from 'react';
import { ARG_FRAGMENTS, getARG } from '../arg/ARGStoryline';

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
  uniform vec2 u_mouse;
  uniform float u_zoom;

  // Simplex-like noise for starfield + vortex.
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main(){
    vec2 uv = v_uv;
    vec2 p = (uv - 0.5) * vec2(u_res.x/u_res.y, 1.0);

    // Black hole centre, nudged by mouse parallax and zoom.
    vec2 centre = vec2(0.0, 0.0) + u_mouse * 0.15;
    vec2 toCentre = p - centre;
    float dist = length(toCentre);

    // Event horizon radius (shrinks slightly as we zoom "into" the hole).
    float horizon = 0.16 - u_zoom * 0.08;

    // Gravitational lensing: bend UVs toward the hole based on 1/dist.
    vec2 dir = toCentre / max(dist, 0.001);
    float lens = 0.32 / (0.02 + dist*dist);
    vec2 warped = uv + dir * lens * (1.0 - u_zoom*0.5);

    // Accretion disc: swirling bands around the hole.
    float angle = atan(warped.y - centre.y, warped.x - centre.x);
    float swirl = noise(vec2(angle*6.0 + u_time*0.8, dist*14.0));
    float disc = smoothstep(horizon*1.3, horizon*2.6, dist) *
                 (1.0 - smoothstep(horizon*2.6, horizon*4.2, dist));
    vec3 discColor = vec3(1.0, 0.35, 0.15) * (0.5 + 0.5*swirl) * disc;

    // Photon ring glow at the horizon.
    float ring = exp(-abs(dist - horizon) * 55.0);
    vec3 ringColor = vec3(1.0, 0.9, 0.7) * ring * 1.4;

    // Starfield (warped away behind the hole).
    vec2 st = vec2(warped.x * 90.0 + u_time*2.0, warped.y*90.0);
    float star = step(0.985, hash(floor(st))) * (1.0 - smoothstep(0.0, horizon*1.2, dist));
    vec3 starColor = vec3(0.8,0.95,1.0) * star;

    // Deep-space background (purple/teal gradient like the End sky).
    vec3 bg = mix(vec3(0.02,0.03,0.08), vec3(0.12,0.02,0.18), uv.y);
    bg += vec3(0.2,0.05,0.35) * smoothstep(0.8,0.3,dist);

    vec3 col = bg + discColor + ringColor + starColor;

    // The black hole interior is pure black (event horizon swallows light).
    if (dist < horizon) col = vec3(0.0);

    // Vignette.
    col *= 0.6 + 0.4 * smoothstep(1.2, 0.2, length(p));

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

export default function Singularity({ onBack, onExit }: { onBack?: () => void; onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [journey, setJourney] = useState(false);
  const [fragments, setFragments] = useState(() => getARG().getState().collected);
  const [argMsg, setArgMsg] = useState<string | null>(null);

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

    const res = gl.getUniformLocation(prog, 'u_res');
    const time = gl.getUniformLocation(prog, 'u_time');
    const mouse = gl.getUniformLocation(prog, 'u_mouse');
    const zoom = gl.getUniformLocation(prog, 'u_zoom');

    const resize = () => {
      gl.canvas.width = canvas.clientWidth;
      gl.canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const mouseTarget = { x: 0, y: 0 };
    const onMouse = (e: MouseEvent) => {
      mouseTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);

    const zoomTarget = { v: 0 };
    let zoomNow = 0;

    let raf = 0;
    const start = performance.now();
    const render = () => {
      const t = (performance.now() - start) / 1000;
      gl.useProgram(prog);
      gl.uniform2f(res, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(time, t);
      gl.uniform2f(mouse, mouseTarget.x, mouseTarget.y);
      // smooth zoom
      zoomNow += (zoomTarget.v - zoomNow) * 0.05;
      gl.uniform1f(zoom, zoomNow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };
    render();

    // Expose zoom control so the journey button can drive it.
    (window as any).__singularityZoom = (v: number) => { zoomTarget.v = v; };

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(raf);
      delete (window as any).__singularityZoom;
    };
  }, []);

  const startJourney = () => {
    setJourney(true);
    (window as any).__singularityZoom?.(1);
    // After zooming "through", reveal the note.
    window.setTimeout(() => setNoteOpen(true), 1800);
  };

  const resetJourney = () => {
    setJourney(false);
    setNoteOpen(false);
    (window as any).__singularityZoom?.(0);
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
        Move your mouse to pan around the lensing. {journey ? 'Descending into the hole…' : 'Click "Dive In" to zoom through.'}
      </div>

      <div className="singularity-actions">
        {!journey
          ? <button className="singularity-dive" onClick={startJourney}>🕳 Dive In</button>
          : <button className="singularity-dive" onClick={resetJourney}>↻ Surface</button>}
      </div>

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
            <div className="singularity-note-head">📜 A Note</div>
            {SINGULARITY_NOTE.map((line, i) => <p key={i} className={line === '' ? 'spacer' : ''}>{line}</p>)}
            <button className="singularity-note-close" onClick={() => setNoteOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
