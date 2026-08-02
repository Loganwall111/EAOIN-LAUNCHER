/**
 * WarpTunnel3D — a real 3D Babylon hyper-speed wormhole for world loading.
 *
 * Replaces the flat CSS particle "snowstorm" overlay with a genuine 3D scene:
 *
 *   1. A curved neon tube corridor (MeshBuilder.CreateTube) running along -Z,
 *      with a rapidly-panning purple/blue gradient texture on its inner walls.
 *   2. A hyperdrive starfield — bright white point meshes spawned deep along
 *      -Z that accelerate and fly past the camera.
 *   3. Glowing neuron fibre strands (MeshBuilder.CreateLines) linking points
 *      around the tunnel rim.
 *   4. As `progress` nears 95% the pan/star speed ramps to peak; at 99% a full
 *      white alpha overlay blinds the screen.
 *   5. A pulsing 3D fresnel-glow "Cosmic Entity" sphere materializes at the end
 *      of the tunnel instead of a flat 2D portrait.
 *
 * Self-contained (owns its own Engine/Scene/canvas) so it mounts and unmounts
 * cleanly with the loading overlay.
 */
import { useEffect, useRef } from 'react';
import {
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  FreeCamera,
  FresnelParameters,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

export interface WarpTunnel3DProps {
  /** Real loading progress 0..100 from GameCanvas. */
  progress: number;
  /** True when the world is stable/ready. */
  ready: boolean;
}

/** Number of star meshes in the hyperdrive field. */
const STAR_COUNT = 180;
/** Neuron strand count around the tunnel rim. */
const NEURON_COUNT = 14;
const TUBE_RADIUS = 10;
const TUBE_LENGTH = 90;
const TUNNEL_END = -TUBE_LENGTH;

export default function WarpTunnel3D({ progress, ready }: WarpTunnel3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  const readyRef = useRef(ready);
  progressRef.current = progress;
  readyRef.current = ready;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Guard against environments without a GPU context (jsdom tests, headless
    // browsers). Babylon throws "WebGL not supported" on construction, which
    // would crash the whole loading overlay. Without WebGL we simply skip the
    // 3D tunnel and leave the CSS backdrop in place.
    try {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (!gl) return;
    } catch { return; }
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.005, 0.004, 0.02, 1);

    const camera = new FreeCamera('warp_cam', new Vector3(0, 0, 4), scene);
    camera.fov = 1.2;
    camera.setTarget(new Vector3(0, 0, -40));

    // --- 1. Neon tube corridor -------------------------------------------
    const tubePath: Vector3[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      tubePath.push(new Vector3(
        Math.sin(t * Math.PI * 0.6) * 1.2,
        Math.sin(t * Math.PI * 0.4 + 1.3) * 1.0,
        -t * TUBE_LENGTH,
      ));
    }
    const tube = MeshBuilder.CreateTube('warp_tube', {
      path: tubePath,
      radius: TUBE_RADIUS,
      tessellation: 48,
      updatable: true,
      sideOrientation: Mesh.BACKSIDE,
    }, scene);
    const tubeMat = new StandardMaterial('warp_tube_mat', scene);
    tubeMat.emissiveColor = new Color3(0.5, 0.25, 1);
    tubeMat.diffuseColor = new Color3(0.05, 0.02, 0.12);
    tubeMat.specularColor = new Color3(0.1, 0.1, 0.1);
    tubeMat.backFaceCulling = true;
    tubeMat.emissiveTexture = makeTubeTexture(scene);
    tube.material = tubeMat;
    tube.freezeWorldMatrix();

    // A second, tighter neon ring layer for depth.
    const innerPath = tubePath.map((p) => p.clone());
    const inner = MeshBuilder.CreateTube('warp_tube_inner', {
      path: innerPath, radius: TUBE_RADIUS * 0.9, tessellation: 36,
      sideOrientation: Mesh.BACKSIDE,
    }, scene);
    const innerMat = new StandardMaterial('warp_tube_inner_mat', scene);
    innerMat.emissiveColor = new Color3(0.3, 0.6, 1);
    innerMat.alpha = 0.35;
    innerMat.emissiveTexture = makeTubeTexture(scene, 1);
    inner.material = innerMat;
    inner.freezeWorldMatrix();

    // --- 2. Hyperdrive starfield -----------------------------------------
    const stars: Array<{ mesh: Mesh; speed: number; z: number }> = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = TUBE_RADIUS * (0.3 + Math.random() * 0.55);
      const s = MeshBuilder.CreateSphere(`warp_star_${i}`, { diameter: 0.22, segments: 4 }, scene);
      const sm = new StandardMaterial(`warp_star_mat_${i}`, scene);
      // Colour the hyperdrive stars so the tunnel is full of moving light, not
      // just white specks.
      const hue = Math.random() * 360;
      sm.emissiveColor = Color3.FromHSV(hue, 0.65, 1);
      sm.diffuseColor = new Color3(1, 1, 1);
      s.material = sm;
      s.position.set(Math.cos(ang) * r, Math.sin(ang) * r, -Math.random() * TUBE_LENGTH);
      s.isPickable = false;
      stars.push({ mesh: s, speed: 20 + Math.random() * 40, z: s.position.z });
    }

    // --- 3. Neuron fibre strands ------------------------------------------
    const neurons: Mesh[] = [];
    const neuronMat = new StandardMaterial('warp_neuron_mat', scene);
    neuronMat.emissiveColor = new Color3(0.4, 1, 0.9);
    neuronMat.alpha = 0.6;
    for (let i = 0; i < NEURON_COUNT; i++) {
      const ang0 = (i / NEURON_COUNT) * Math.PI * 2;
      const pts: Vector3[] = [];
      for (let k = 0; k <= 20; k++) {
        const z = -k * 4.5;
        const wob = Math.sin(z * 0.1 + i) * 1.2;
        pts.push(new Vector3(
          Math.cos(ang0) * (TUBE_RADIUS - 0.6) + wob * 0.3,
          Math.sin(ang0) * (TUBE_RADIUS - 0.6) + wob * 0.3,
          z,
        ));
      }
      const line = MeshBuilder.CreateLines(`warp_neuron_${i}`, { points: pts }, scene);
      line.color = new Color3(0.5, 1, 0.9);
      line.renderingGroupId = 3;
      neurons.push(line);
    }

    // Pulsing rim lights.
    const rimLights: PointLight[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const pl = new PointLight(`warp_rim_${i}`, new Vector3(Math.cos(ang) * 6, Math.sin(ang) * 6, -20), scene);
      pl.diffuse = new Color3(0.6, 0.3, 1);
      pl.intensity = 2;
      pl.range = 40;
      rimLights.push(pl);
    }

    // Vortex ring: dozens of glowing motes that swirl around the tunnel while
    // you fly, giving the wormhole a living, rotating core.
    const vortex: Mesh[] = [];
    const VORTEX_COUNT = 64;
    for (let i = 0; i < VORTEX_COUNT; i++) {
      const ang = (i / VORTEX_COUNT) * Math.PI * 2;
      const r = TUBE_RADIUS * (0.35 + Math.random() * 0.45);
      const v = MeshBuilder.CreateSphere(`warp_vortex_${i}`, { diameter: 0.16, segments: 4 }, scene);
      const vm = new StandardMaterial(`warp_vortex_mat_${i}`, scene);
      const hue = (i / VORTEX_COUNT) * 360;
      const c = Color3.FromHSV(hue, 0.9, 1);
      vm.emissiveColor = c;
      vm.diffuseColor = c;
      vm.specularColor = Color3.Black();
      v.material = vm;
      v.position.set(Math.cos(ang) * r, Math.sin(ang) * r, -Math.random() * TUBE_LENGTH);
      v.isPickable = false;
      vortex.push(v);
    }

    // A bright beacon light at the far end that swells as you arrive.
    const beacon = new PointLight('warp_beacon', new Vector3(0, 0, TUNNEL_END + 22), scene);
    beacon.diffuse = new Color3(0.55, 0.3, 1);
    beacon.intensity = 0;
    beacon.range = 220;

    // --- 5. Cosmic Entity (3D fresnel sphere) ----------------------------
    const entity = new TransformNode('warp_entity', scene);
    const core = MeshBuilder.CreateSphere('warp_entity_core', { diameter: 3.2, segments: 32 }, scene);
    core.parent = entity;
    const coreMat = new StandardMaterial('warp_entity_core_mat', scene);
    coreMat.emissiveColor = new Color3(0.6, 0.3, 1);
    coreMat.diffuseColor = new Color3(0.1, 0.05, 0.2);
    coreMat.specularColor = new Color3(1, 1, 1);
    coreMat.specularPower = 32;
    applyFresnel(coreMat, {
      isEnabled: true, bias: 0.4, power: 2.2,
      leftColor: new Color3(0.3, 0.1, 0.8), rightColor: new Color3(0.6, 0.2, 1),
    });
    core.material = coreMat;
    core.isPickable = false;
    const halo = MeshBuilder.CreateSphere('warp_entity_halo', { diameter: 5.4, segments: 24 }, scene);
    halo.parent = entity;
    const haloMat = new StandardMaterial('warp_entity_halo_mat', scene);
    haloMat.emissiveColor = new Color3(0.3, 0.1, 0.7);
    haloMat.alpha = 0.35;
    applyFresnel(haloMat, {
      isEnabled: true, bias: 0, power: 1.6,
      leftColor: new Color3(0.2, 0.1, 0.5), rightColor: new Color3(0.5, 0.3, 1),
    });
    halo.material = haloMat;
    halo.isPickable = false;
    entity.position.set(0, 0, TUNNEL_END + 20);
    entity.setEnabled(false);

    // Full-screen white overlay.
    const white = document.createElement('div');
    white.style.position = 'absolute';
    white.style.inset = '0';
    white.style.background = '#ffffff';
    white.style.opacity = '0';
    white.style.pointerEvents = 'none';
    white.style.transition = 'opacity 0.35s ease-in';
    white.style.zIndex = '50';
    canvas.parentElement?.appendChild(white);

    // --- render loop -----------------------------------------------------
    let starSpeed = 1;
    engine.runRenderLoop(() => {
      const p = progressRef.current;
      const isReady = readyRef.current;

      // Speed ramps as we approach the end.
      const target = p >= 99 ? 6 : p >= 95 ? 5 : p >= 80 ? 3.2 : 1;
      starSpeed += (target - starSpeed) * 0.08;

      // Advance stars.
      for (const st of stars) {
        st.z += st.speed * starSpeed * engine.getDeltaTime() * 0.06;
        if (st.z > 2) { st.z = TUNNEL_END; }
        st.mesh.position.z = st.z;
        // Scale up as they approach the camera.
        const d = Math.max(0.5, (st.z + 90) / 90);
        st.mesh.scaling.setAll(0.6 + (1 - d) * 1.6);
      }

      // Pan tube texture (offset along V for longitudinal motion).
      const offset = (performance.now() * 0.0004 * starSpeed) % 1;
      if (tubeMat.emissiveTexture) (tubeMat.emissiveTexture as DynamicTexture).vOffset = offset;
      if (innerMat.emissiveTexture) (innerMat.emissiveTexture as DynamicTexture).vOffset = -offset * 1.4;

      // Hue-shift the tube walls so the wormhole breathes through colour.
      const hueT = (performance.now() * 0.00004) % 1;
      tubeMat.emissiveColor = Color3.FromHSV(hueT * 360, 0.85, 0.9);

      // Spin the vortex ring around the tunnel's long axis.
      for (const v of vortex) {
        const r = Math.hypot(v.position.x, v.position.y);
        if (r <= 0.001) continue;
        const a = Math.atan2(v.position.y, v.position.x) + 0.02 * starSpeed;
        v.position.x = Math.cos(a) * r;
        v.position.y = Math.sin(a) * r;
      }

      // Pulse the entity.
      if (entity.isEnabled()) {
        const t = performance.now() * 0.001;
        const pulse = 1 + Math.sin(t * 3) * 0.08;
        core.scaling.setAll(pulse);
        halo.scaling.setAll(pulse * 1.15);
        halo.rotation.y += 0.01;
        core.rotation.y += 0.008;
      }

      // Rim lights breathe.
      rimLights.forEach((pl, i) => {
        pl.intensity = 1.6 + Math.sin(performance.now() * 0.003 + i) * 1.2;
      });

      // Beacon swells as we approach the end.
      beacon.intensity = p >= 95 ? 60 + Math.sin(performance.now() * 0.01) * 20 : p * 0.2;

      // Subtle camera roll for a disorienting warp feel.
      camera.rotation.z = Math.sin(performance.now() * 0.0006) * 0.05;

      // Materialize the Cosmic Entity as we near the end.
      if (p >= 99 && !entity.isEnabled()) entity.setEnabled(true);

      // Blind to white near/at completion.
      const targetOpacity = isReady ? 1 : p >= 99 ? 1 : p >= 95 ? 0.35 : 0;
      const cur = parseFloat(white.style.opacity) || 0;
      white.style.opacity = String(Math.min(1, cur + (targetOpacity - cur) * 0.25));

      scene.render();
    });

    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      white.remove();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="warp-tunnel-canvas"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: 1 }}
    />
  );
}

/** A panning neon-purple / cosmic-blue gradient texture for the tube walls. */
function makeTubeTexture(scene: Scene, variant = 0): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture(`warp_tex_${variant}`, { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  const grad = ctx.createLinearGradient(0, 0, size, size);
  if (variant === 0) {
    grad.addColorStop(0, '#3a0a8a');
    grad.addColorStop(0.3, '#7a2bff');
    grad.addColorStop(0.5, '#2a7bff');
    grad.addColorStop(0.7, '#4de0ff');
    grad.addColorStop(1, '#3a0a8a');
  } else {
    grad.addColorStop(0, '#ff6aff');
    grad.addColorStop(0.5, '#2a4dff');
    grad.addColorStop(1, '#ff6aff');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Add diagonal streaks.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i / 12) * size);
    ctx.lineTo(size, (i / 12) * size + 30);
    ctx.stroke();
  }
  tex.update();
  return tex;
}

/** Apply a fresnel glow to a material (StandardMaterial's TS types don't
 *  declare fresnelParameters, so we set it through the dynamic material API). */
function applyFresnel(
  mat: StandardMaterial,
  params: {
    isEnabled: boolean; bias: number; power: number;
    leftColor: Color3; rightColor: Color3;
  }
): void {
  const m = mat as unknown as {
    fresnelParameters?: FresnelParameters;
  };
  const fres = new FresnelParameters();
  fres.isEnabled = params.isEnabled;
  fres.bias = params.bias;
  fres.power = params.power;
  fres.leftColor = params.leftColor;
  fres.rightColor = params.rightColor;
  m.fresnelParameters = fres;
}
