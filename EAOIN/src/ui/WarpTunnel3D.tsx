/**
 * WarpTunnel3D — a real 3D Babylon hyper-speed wormhole for world loading.
 *
 * Unlike a static tube, the CAMERA actually flies forward along the wormhole
 * for the whole loading duration, exactly like the main-menu warp:
 *
 *   - The camera travels down a wavy neon tube corridor, accelerating as
 *     `progress` climbs, so it genuinely "zooms" rather than sitting still.
 *   - A galaxy of glowing dots (stars/motes) streams past the camera.
 *   - Neuron fibre strands and glowing ring cross-sections sweep past as you
 *     fly through them.
 *   - A vortex of coloured motes swirls around the tunnel.
 *   - Near the end a pulsing fresnel "Cosmic Entity" materializes dead ahead,
 *     and the whole thing zooms all the way in until it flashes to white.
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

/** Number of galaxy-dot meshes streaming past. */
const STAR_COUNT = 240;
/** Number of neuron fibre strands around the tunnel rim. */
const NEURON_COUNT = 16;
/** Number of glowing ring cross-sections the camera flies through. */
const RING_COUNT = 14;
/** Wormhole tube dimensions (world units along Z, negative = ahead). */
const TUBE_RADIUS = 11;
const TUBE_LENGTH = 170;
const CAM_START = 34;   // camera begins here (behind the tube mouth)
const CAM_END = -TUBE_LENGTH + 26; // and ends here, at the white-flash entity

/** Where a point on the tube's centre line sits at a given Z. */
function tubeCentre(z: number): Vector3 {
  const t = Math.max(0, Math.min(1, -z / TUBE_LENGTH)); // 0 at z=0 … 1 at end
  return new Vector3(
    Math.sin(t * Math.PI * 0.6) * 1.4,
    Math.sin(t * Math.PI * 0.4 + 1.3) * 1.1,
    z,
  );
}

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

    const camera = new FreeCamera('warp_cam', new Vector3(0, 0, CAM_START), scene);
    camera.fov = 1.25;
    camera.minZ = 0.1;

    // --- 1. Neon tube corridor (wavy, runs along -Z) ----------------------
    const steps = 96;
    const tubePath: Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const z = CAM_START - (i / steps) * (CAM_START - (CAM_END - 8));
      tubePath.push(tubeCentre(z));
    }
    const tube = MeshBuilder.CreateTube('warp_tube', {
      path: tubePath, radius: TUBE_RADIUS, tessellation: 48,
      updatable: true, sideOrientation: Mesh.BACKSIDE,
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

    // --- 2. Galaxy dot field (streams past the flying camera) -------------
    const stars: Array<{ mesh: Mesh; z: number }> = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = TUBE_RADIUS * (0.2 + Math.random() * 0.8);
      const s = MeshBuilder.CreateSphere(`warp_star_${i}`, { diameter: 0.22, segments: 4 }, scene);
      const sm = new StandardMaterial(`warp_star_mat_${i}`, scene);
      const hue = Math.random() * 360;
      sm.emissiveColor = Color3.FromHSV(hue, 0.7, 1);
      sm.diffuseColor = new Color3(1, 1, 1);
      s.material = sm;
      s.position.set(
        Math.cos(ang) * r,
        Math.sin(ang) * r,
        CAM_START + 8 - Math.random() * (CAM_START + 8 - CAM_END),
      );
      s.isPickable = false;
      stars.push({ mesh: s, z: s.position.z });
    }

    // --- 3. Neuron fibre strands sweeping along the tunnel -----------------
    const neurons: Mesh[] = [];
    const neuronMat = new StandardMaterial('warp_neuron_mat', scene);
    neuronMat.emissiveColor = new Color3(0.4, 1, 0.9);
    neuronMat.alpha = 0.55;
    for (let i = 0; i < NEURON_COUNT; i++) {
      const ang0 = (i / NEURON_COUNT) * Math.PI * 2;
      const pts: Vector3[] = [];
      for (let k = 0; k <= 26; k++) {
        const z = CAM_START + 6 - k * ((CAM_START + 6 - CAM_END) / 26);
        const wob = Math.sin(z * 0.12 + i) * 1.2;
        pts.push(new Vector3(
          Math.cos(ang0) * (TUBE_RADIUS - 0.7) + wob * 0.4,
          Math.sin(ang0) * (TUBE_RADIUS - 0.7) + wob * 0.4,
          z,
        ));
      }
      const line = MeshBuilder.CreateLines(`warp_neuron_${i}`, { points: pts }, scene);
      line.color = new Color3(0.5, 1, 0.9);
      line.renderingGroupId = 3;
      neurons.push(line);
    }

    // --- 4. Glowing ring cross-sections the camera flies through -----------
    const rings: Array<{ mesh: Mesh; z: number }> = [];
    const ringMat = new StandardMaterial('warp_ring_mat', scene);
    ringMat.emissiveColor = new Color3(0.6, 0.3, 1);
    ringMat.diffuseColor = Color3.Black();
    ringMat.specularColor = Color3.Black();
    for (let i = 0; i < RING_COUNT; i++) {
      const z = CAM_START - 4 - (i / RING_COUNT) * (CAM_START - 4 - CAM_END);
      const ring = MeshBuilder.CreateTorus(`warp_ring_${i}`, {
        diameter: TUBE_RADIUS * 1.55, thickness: 0.28, tessellation: 32,
      }, scene);
      ring.material = ringMat;
      ring.position.copyFrom(tubeCentre(z));
      ring.rotation.x = Math.PI / 2;
      ring.isPickable = false;
      rings.push({ mesh: ring, z });
    }

    // Pulsing rim lights.
    const rimLights: PointLight[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const pl = new PointLight(`warp_rim_${i}`, new Vector3(Math.cos(ang) * 6, Math.sin(ang) * 6, CAM_END + 30), scene);
      pl.diffuse = new Color3(0.6, 0.3, 1);
      pl.intensity = 2;
      pl.range = 80;
      rimLights.push(pl);
    }

    // Vortex ring: coloured motes that swirl around the tunnel while you fly.
    const vortex: Mesh[] = [];
    const VORTEX_COUNT = 70;
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
      v.position.set(
        Math.cos(ang) * r, Math.sin(ang) * r,
        CAM_START + 8 - Math.random() * (CAM_START + 8 - CAM_END),
      );
      v.isPickable = false;
      vortex.push(v);
    }

    // A bright beacon light at the far end that swells as you arrive.
    const beacon = new PointLight('warp_beacon', new Vector3(0, 0, CAM_END + 20), scene);
    beacon.diffuse = new Color3(0.55, 0.3, 1);
    beacon.intensity = 0;
    beacon.range = 240;

    // --- 5. Cosmic Entity (3D fresnel sphere) at the far end ----------------
    const entity = new TransformNode('warp_entity', scene);
    const core = MeshBuilder.CreateSphere('warp_entity_core', { diameter: 3.4, segments: 32 }, scene);
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
    const halo = MeshBuilder.CreateSphere('warp_entity_halo', { diameter: 5.6, segments: 24 }, scene);
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
    entity.position.copyFrom(tubeCentre(CAM_END + 14));
    entity.setEnabled(false);

    // Full-screen white overlay (the zoom-to-white climax).
    const white = document.createElement('div');
    white.style.position = 'absolute';
    white.style.inset = '0';
    white.style.background = '#ffffff';
    white.style.opacity = '0';
    white.style.pointerEvents = 'none';
    white.style.transition = 'opacity 0.3s ease-in';
    white.style.zIndex = '50';
    canvas.parentElement?.appendChild(white);

    // --- render loop -----------------------------------------------------
    let starSpeed = 1;
    engine.runRenderLoop(() => {
      const p = progressRef.current;
      const isReady = readyRef.current;

      // ---- Camera flies forward down the tunnel, accelerating with progress.
      // Ease so it starts slow and zooms fast near the end (the "warp" feel).
      const t = Math.max(0, Math.min(1, p / 100));
      const eased = t * t * (3 - 2 * t); // smoothstep
      const camZ = CAM_START + (CAM_END - CAM_START) * eased;
      camera.position.copyFrom(tubeCentre(camZ));
      camera.setTarget(tubeCentre(camZ - 60));

      // Speed multiplier for the streaming elements.
      const targetSpeed = p >= 99 ? 7 : p >= 95 ? 6 : p >= 80 ? 4 : 1 + eased * 2;
      starSpeed += (targetSpeed - starSpeed) * 0.06;

      // ---- Galaxy dots stream past (they also wrap behind the camera).
      const delta = engine.getDeltaTime() * 0.001;
      for (const st of stars) {
        st.z += (40 + starSpeed * 30) * delta;
        if (st.z > camZ + 30) st.z = camZ - 190;
        st.mesh.position.z = st.z;
        // Scale up as they fly past the camera.
        const dist = st.z - camZ;
        st.mesh.scaling.setAll(Math.max(0.4, 1.4 - dist * 0.02));
      }

      // ---- Vortex motes swirl around the tunnel axis.
      for (const v of vortex) {
        const r = Math.hypot(v.position.x, v.position.y);
        if (r <= 0.001) continue;
        const a = Math.atan2(v.position.y, v.position.x) + 0.02 * starSpeed;
        v.position.x = Math.cos(a) * r;
        v.position.y = Math.sin(a) * r;
        v.position.z += (30 + starSpeed * 20) * delta;
        if (v.position.z > camZ + 26) v.position.z = camZ - 180;
      }

      // ---- Pan the tube texture for longitudinal motion.
      const offset = (performance.now() * 0.0005 * starSpeed) % 1;
      if (tubeMat.emissiveTexture) (tubeMat.emissiveTexture as DynamicTexture).vOffset = offset;
      if (innerMat.emissiveTexture) (innerMat.emissiveTexture as DynamicTexture).vOffset = -offset * 1.4;

      // Hue-shift the tube so the wormhole breathes through colour.
      const hueT = (performance.now() * 0.00005) % 1;
      tubeMat.emissiveColor = Color3.FromHSV(hueT * 360, 0.85, 0.9);

      // ---- Rings glow brighter as the camera approaches, then pass.
      for (const ring of rings) {
        const d = ring.z - camZ;
        const glow = Math.max(0, 1 - Math.abs(d) / 40);
        (ring.mesh.material as StandardMaterial).emissiveColor =
          Color3.FromHSV(280, 0.8, 0.4 + glow * 0.6);
        ring.mesh.scaling.setAll(1 + glow * 0.3);
      }

      // Pulse the entity.
      if (entity.isEnabled()) {
        const tSec = performance.now() * 0.001;
        const pulse = 1 + Math.sin(tSec * 3) * 0.08;
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
      beacon.intensity = p >= 95 ? 70 + Math.sin(performance.now() * 0.012) * 20 : p * 0.2;

      // Subtle camera roll + head-bob for a disorienting warp feel.
      const bob = Math.sin(performance.now() * 0.0005) * 0.25 * (0.5 + starSpeed * 0.1);
      camera.position.y = tubeCentre(camZ).y + bob;
      camera.rotation.z = Math.sin(performance.now() * 0.0008) * 0.06;

      // Materialize the Cosmic Entity as we near the end.
      if (p >= 96 && !entity.isEnabled()) entity.setEnabled(true);

      // Zoom to white at the end.
      const targetOpacity = isReady ? 1 : p >= 99 ? 1 : p >= 95 ? 0.35 : 0;
      const cur = parseFloat(white.style.opacity) || 0;
      white.style.opacity = String(Math.min(1, cur + (targetOpacity - cur) * 0.28));

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
