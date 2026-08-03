/**
 * CosmicRift — the hidden cosmic rift found behind the "?" button on the menu.
 *
 * A gigantic, colour-shifting cosmic rift rendered with the same lensing /
 * pixelated effect as the black hole. As you get close, colours bloom on the
 * screen, and a special vision appears: the Cosmic Girl returns, speaks the
 * warning, then the rift jumpscares you with a monstrous face before teleporting
 * you back to the main menu.
 */
import { useEffect, useRef, useState } from 'react';

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
  uniform float u_intensity; // 0 at far, 1 at full (near the rift)
  uniform float u_aspect;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main(){
    vec2 uv = v_uv;
    vec2 p = (uv - 0.5) * vec2(u_aspect, 1.0);
    float r = length(p);

    // Giant cosmic rift in the centre — colour-shifting jagged opening.
    float ang = atan(p.y, p.x);
    float swirl = noise(vec2(ang*5.0 + u_time*0.6, r*6.0));
    float edge = 0.30 + 0.10*swirl - u_intensity*0.05;
    float crack = smoothstep(edge, edge+0.06, r) * (1.0 - smoothstep(edge, edge+0.5, r));

    // Pixelated colour bands bleeding in from the rift as you approach.
    float pixel = floor(uv.x*26.0)/26.0 + floor(uv.y*18.0)/18.0;
    vec3 riftCol = 0.5 + 0.5*cos(vec3(pixel*3.0 + u_time, pixel*5.0 + u_time*1.3, pixel*7.0 - u_time*0.8));
    riftCol = riftCol * crack * u_intensity;

    // Deep-space backdrop.
    vec3 col = vec3(0.01,0.01,0.03);
    // stars
    vec2 st = uv*90.0;
    float star = step(0.988, hash(floor(st)));
    col += vec3(0.8,0.9,1.0)*star*0.8;
    // nebula
    col += vec3(0.3,0.1,0.5) * noise(uv*5.0 + u_time*0.1) * 0.3;

    // Bloom / pixelated glow that floods the screen as you get close.
    float bloom = pow(crack, 2.0) * u_intensity;
    col += riftCol + vec3(0.4,0.2,0.9)*bloom*0.6;

    // Pixelate the whole screen harder near the rift (distortion).
    if (u_intensity > 0.35) {
      vec2 q = floor(uv*vec2(40.0, 30.0) * (1.0 + u_intensity))/ (40.0* (1.0 + u_intensity));
      col += (noise(q*12.0) - 0.5) * u_intensity * 0.25;
    }

    // Vignette
    col *= 0.6 + 0.4*smoothstep(1.3, 0.2, r);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const LINES = [
  "You're not meant to be here.",
  'Why are you behind the code?',
  "You're meant to be in the game.",
  'Out now.',
];

export default function CosmicRift({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'rift' | 'vision' | 'scare'>('rift');
  const [lineIdx, setLineIdx] = useState(0);
  const [showLine, setShowLine] = useState(false);
  const [intensity, setIntensity] = useState(0.25);
  const intensityRef = useRef(0.25);
  intensityRef.current = intensity;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Approaching the rift: intensity rises over time.
  useEffect(() => {
    const iv = window.setInterval(() => {
      setIntensity((v) => Math.min(1, v + 0.05));
    }, 220);
    return () => window.clearInterval(iv);
  }, []);

  // Sequence: once the rift is at full bloom, the vision starts.
  useEffect(() => {
    if (intensity >= 0.98 && phase === 'rift') {
      window.setTimeout(() => setPhase('vision'), 600);
    }
  }, [intensity, phase]);

  // Vision: type out the Cosmic Girl's words.
  useEffect(() => {
    if (phase !== 'vision') return;
    setShowLine(true);
    const t = window.setTimeout(() => {
      if (lineIdx < LINES.length - 1) {
        setLineIdx((i) => i + 1);
        setShowLine(false);
        window.setTimeout(() => setShowLine(true), 120);
      } else {
        // after the last line, jump-scare then exit to menu.
        window.setTimeout(() => setPhase('scare'), 900);
      }
    }, 1600);
    return () => window.clearTimeout(t);
  }, [lineIdx, phase]);

  // Jumpscare: flash the monstrous face, then teleport back to the menu.
  useEffect(() => {
    if (phase !== 'scare') return;
    const t = window.setTimeout(() => onExit(), 1500);
    return () => window.clearTimeout(t);
  }, [phase, onExit]);

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
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn('[CosmicRift]', gl.getShaderInfoLog(sh)); return null; }
      return sh;
    };
    const prog = gl.createProgram();
    const vert = compile(gl.VERTEX_SHADER, VERT);
    const frag = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag || !prog) return;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const res = gl.getUniformLocation(prog, 'u_res');
    const time = gl.getUniformLocation(prog, 'u_time');
    const intensityU = gl.getUniformLocation(prog, 'u_intensity');
    const aspectU = gl.getUniformLocation(prog, 'u_aspect');
    const resize = () => { gl.canvas.width = canvas.clientWidth; gl.canvas.height = canvas.clientHeight; gl.viewport(0,0,gl.canvas.width,gl.canvas.height); };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    const start = performance.now();
    const render = () => {
      const t = (performance.now() - start)/1000;
      gl.uniform2f(res, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(time, t);
      gl.uniform1f(intensityU, intensityRef.current);
      gl.uniform1f(aspectU, gl.canvas.width/Math.max(1,gl.canvas.height));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };
    render();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className={`cosmic-rift ${phase}`}>
      <canvas ref={canvasRef} className="cosmic-rift-canvas" />

      <div className="cosmic-rift-head">
        <span className="cosmic-rift-eyebrow">???: UNKNOWN SIGNAL</span>
      </div>

      {phase === 'rift' && (
        <div className="cosmic-rift-hint">A colossal rift tears open before you. It draws you closer…</div>
      )}

      {phase === 'vision' && (
        <div className="cosmic-vision">
          <div className="cosmic-woman">👧</div>
          <div className="cosmic-dialogue">
            {LINES.slice(0, lineIdx + 1).map((l, i) => (
              <p key={i} className={i === lineIdx && showLine ? 'typing' : ''}>{l}</p>
            ))}
          </div>
        </div>
      )}

      {phase === 'scare' && (
        <div className="cosmic-scare">
          <div className="cosmic-face">
            <div className="cosmic-face-eyes"><span className="eye red">👁</span><span className="eye red">👁</span></div>
            <div className="cosmic-face-mouth"><span>👹</span></div>
          </div>
          <div className="cosmic-scare-text">IF I'M OUT TOO LONG, THE SYSTEM WILL FORGET.</div>
        </div>
      )}
    </div>
  );
}
