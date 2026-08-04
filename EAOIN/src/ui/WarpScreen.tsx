/**
 * WarpScreen — a full-screen GLSL gravitational-lensing warp used while the
 * world loads. This REPLACES the old Babylon "neon tube" wormhole with a pure
 * shader effect that has the same look as the Singularity black hole:
 *
 *   - A black hole lens sits at screen centre with a bright accretion ring.
 *   - A starfield is streamed outward at warp speed, and rays near the hole are
 *     bent (gravitational lensing), so stars smear into arcs around the lens.
 *   - As `progress` climbs the warp accelerates and the image zooms into the
 *     lens; on `ready` the whole thing flashes to white.
 *
 * Self-contained (owns its own WebGL program) so it mounts/unmounts cleanly
 * with the loading overlay.
 */
import { useEffect, useRef } from 'react';

export interface WarpScreenProps {
  /** Real loading progress 0..100 from GameCanvas. */
  progress: number;
  /** True when the world is stable/ready. */
  ready: boolean;
}

const VERT = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main(){
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 v_uv;
  uniform vec2 u_res;
  uniform float u_time;
  uniform float u_progress; // 0..100
  uniform float u_ready;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main(){
    float warp = clamp(u_progress / 100.0, 0.0, 1.0);
    vec2 uv = v_uv;
    vec2 p = (uv - 0.5) * vec2(u_res.x / max(1.0, u_res.y), 1.0);
    float r = length(p);

    // Barrel lens distortion — the whole image bulges like it is pulled by the
    // black hole's gravity (the "warping" of the black-hole shader).
    p *= 1.0 + 0.28 * r * r * (0.4 + warp);
    uv = p * 0.5 + 0.5;

    // Starfield streaming outward at warp speed; speed grows with progress.
    float speed = 1.5 + warp * 18.0;
    float ang = atan(p.y, p.x);
    float rad = length(p) + u_time * speed;
    vec2 sp = vec2(cos(ang), sin(ang)) * rad * 5.0;
    float star = step(0.992, hash(floor(sp)));
    vec3 col = vec3(0.7, 0.85, 1.0) * star * (0.4 + warp);

    // Faint nebula so space is never flat black.
    float neb = noise(sp*0.12 + u_time*0.03);
    col += vec3(0.25, 0.06, 0.4) * neb * 0.25;
    col += vec3(0.01, 0.02, 0.05);

    // Gravitational lensing: bend the sample so stars smear into arcs around
    // the hole. Rays near the horizon get deflected most (1/r^2).
    vec3 dir = normalize(vec3(p, 1.0));
    vec2 lensP = p;
    float h = 0.16;
    float d = max(r, 1e-3);
    lensP -= p / (d*d) * (h * 0.6 * (0.5 + warp));
    float lr = length(lensP);
    if (lr < 1.0) {
      float la = atan(lensP.y, lensP.x);
      vec2 ls = vec2(cos(la), sin(la)) * (lr + u_time*0.3) * 6.0;
      float lstar = step(0.985, hash(floor(ls)));
      col += vec3(1.0, 0.85, 0.6) * lstar * 0.8 * (0.4 + warp);
    }

    // Black sphere + accretion ring.
    float sphere = smoothstep(0.16, 0.15, r);
    col *= 1.0 - sphere;
    float ring = smoothstep(0.24, 0.16, abs(r - 0.20));
    col += vec3(1.0, 0.62, 0.28) * ring * (0.6 + warp*0.8);

    // Photon ring glow.
    col += vec3(1.0, 0.85, 0.6) * exp(-abs(r - 0.16)*40.0) * (0.5 + warp);

    // Zoom into the lens as progress climbs; flash white when ready.
    float zoom = 1.0 - warp * 0.45;
    col *= zoom;
    if (u_ready > 0.5) {
      float flash = smoothstep(0.0, 0.12, u_time);
      col = mix(col, vec3(1.0), flash);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function WarpScreen({ progress, ready }: WarpScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  const readyRef = useRef(ready);
  progressRef.current = progress;
  readyRef.current = ready;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl');
      if (!gl) return;
    } catch { return; }

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl!.createShader(type);
      if (!sh) return null;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        console.warn('[WarpScreen] shader:', gl!.getShaderInfoLog(sh));
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
      console.warn('[WarpScreen] link:', gl.getProgramInfoLog(prog));
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
    const uprogress = gl.getUniformLocation(prog, 'u_progress');
    const uready = gl.getUniformLocation(prog, 'u_ready');

    const resize = () => {
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      gl!.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let start = performance.now();
    const render = () => {
      const t = (performance.now() - start) / 1000;
      gl!.useProgram(prog);
      gl!.uniform2f(res, canvas.width, canvas.height);
      gl!.uniform1f(time, t);
      gl!.uniform1f(uprogress, progressRef.current);
      gl!.uniform1f(uready, readyRef.current ? 1 : 0);
      gl!.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
      gl.deleteProgram(prog);
    };
  }, []);

  return <canvas ref={canvasRef} className="warp-screen-canvas" aria-hidden="true" />;
}
