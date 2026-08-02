/**
 * StudioIntro3D — a real 3D cinematic backdrop for the ONEBLOCKAWAY studio card.
 *
 * A rotating voxel-style emblem (three interlocking diamond faces — the same
 * three colours as the CSS sigil), a drifting galaxy of glowing particles, and
 * sweeping light beams. Rendered as a full-screen Babylon canvas that sits
 * behind the studio title, so the intro reads as a big 3D title sequence rather
 * than a flat card.
 *
 * Self-contained (owns its own Engine/Scene/canvas) and safely no-ops when
 * WebGL isn't available.
 */
import { useEffect, useRef } from 'react';
import {
  Color3,
  Color4,
  Engine,
  FreeCamera,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';

export default function StudioIntro3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (!gl) return;
    } catch { return; }

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.008, 0.006, 0.02, 0);

    // Camera slowly orbits the emblem so it feels alive and 3D.
    const camera = new FreeCamera('studio_cam', new Vector3(0, 1.4, 7), scene);
    camera.setTarget(new Vector3(0, 0, 0));
    camera.fov = 1.0;
    camera.minZ = 0.1;

    // Key light that sweeps the emblem.
    const key = new PointLight('studio_key', new Vector3(4, 5, 6), scene);
    key.diffuse = new Color3(0.8, 0.6, 1);
    key.intensity = 3;
    key.range = 30;
    const fill = new PointLight('studio_fill', new Vector3(-5, -2, -4), scene);
    fill.diffuse = new Color3(0.2, 0.6, 1);
    fill.intensity = 1.6;
    fill.range = 30;

    // --- Rotating voxel emblem: three interlocking diamond cubes ----------
    const emblem = MeshBuilder.CreateBox('studio_emblem', { size: 1 }, scene);
    const emblemMat = new StandardMaterial('studio_emblem_mat', scene);
    emblemMat.emissiveColor = new Color3(0.4, 0.3, 1);
    emblemMat.diffuseColor = new Color3(0.2, 0.12, 0.5);
    emblemMat.specularColor = new Color3(1, 1, 1);
    emblemMat.specularPower = 24;
    emblem.material = emblemMat;
    emblem.position.set(0, 0, 0);

    // Three offset face cubes in the sigil colours (silver, teal, gold).
    const faces: Mesh[] = [];
    const faceColors: Color3[] = [
      new Color3(0.62, 0.72, 0.85),
      new Color3(0.2, 0.62, 0.75),
      new Color3(0.82, 0.6, 0.2),
    ];
    for (let i = 0; i < 3; i++) {
      const f = MeshBuilder.CreateBox(`studio_face_${i}`, { size: 0.62 }, scene);
      const fm = new StandardMaterial(`studio_face_mat_${i}`, scene);
      fm.emissiveColor = faceColors[i];
      fm.diffuseColor = faceColors[i].scale(0.4);
      fm.specularColor = new Color3(1, 1, 1);
      fm.specularPower = 40;
      f.material = fm;
      f.parent = emblem;
      f.position.set(
        Math.cos(i * ((Math.PI * 2) / 3)) * 1.05,
        0.2,
        Math.sin(i * ((Math.PI * 2) / 3)) * 1.05,
      );
      f.scaling.setAll(0.9);
      faces.push(f);
    }

    // --- Galaxy of drifting particles --------------------------------------
    const parts: Array<{ mesh: Mesh; base: Vector3; phase: number }> = [];
    const pmat = new StandardMaterial('studio_part_mat', scene);
    pmat.emissiveColor = new Color3(1, 1, 1);
    pmat.diffuseColor = Color3.Black();
    pmat.specularColor = Color3.Black();
    for (let i = 0; i < 180; i++) {
      const p = MeshBuilder.CreateSphere(`studio_part_${i}`, { diameter: 0.06, segments: 4 }, scene);
      p.material = pmat;
      const theta = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 7;
      p.position.set(Math.cos(theta) * r, (Math.random() - 0.5) * 4, Math.sin(theta) * r);
      p.isPickable = false;
      parts.push({ mesh: p, base: p.position.clone(), phase: Math.random() * Math.PI * 2 });
    }

    // --- Sweeping light beams (two emissive planes) ------------------------
    const beamMat = new StandardMaterial('studio_beam_mat', scene);
    beamMat.emissiveColor = new Color3(0.5, 0.4, 1);
    beamMat.diffuseColor = Color3.Black();
    beamMat.specularColor = Color3.Black();
    beamMat.alpha = 0.12;
    beamMat.backFaceCulling = false;
    const beams: Mesh[] = [];
    for (let i = 0; i < 2; i++) {
      const beam = MeshBuilder.CreatePlane(`studio_beam_${i}`, { size: 2, width: 9, height: 0.8 }, scene);
      beam.material = beamMat;
      beam.position.set(0, i === 0 ? 1.1 : -1.0, 0.5);
      beam.rotation.z = i === 0 ? -0.6 : 0.6;
      beams.push(beam);
    }

    let t = 0;
    engine.runRenderLoop(() => {
      t += engine.getDeltaTime() * 0.001;

      // The emblem rotates slowly and the whole assembly gently tumbles.
      emblem.rotation.y += 0.006;
      emblem.rotation.x = Math.sin(t * 0.2) * 0.3;
      emblem.position.y = Math.sin(t * 0.8) * 0.15;

      // Camera orbits for a 3D sense of depth.
      camera.position.set(Math.sin(t * 0.12) * 6, 1.2 + Math.sin(t * 0.4) * 0.4, Math.cos(t * 0.12) * 6);
      camera.setTarget(new Vector3(0, 0, 0));

      // Particles drift slowly outward and pulse.
      for (const part of parts) {
        part.mesh.position = part.base.clone().add(
          new Vector3(
            Math.sin(t * 0.3 + part.phase) * 0.4,
            Math.sin(t * 0.5 + part.phase) * 0.4,
            Math.cos(t * 0.3 + part.phase) * 0.4,
          ),
        );
        const glow = 0.7 + Math.sin(t * 2 + part.phase) * 0.3;
        (part.mesh.material as StandardMaterial).emissiveColor = new Color3(glow, glow, glow);
      }

      // Beams sweep.
      beamMat.alpha = 0.08 + Math.sin(t * 1.4) * 0.05;
      for (let i = 0; i < beams.length; i++) {
        beams[i].rotation.x = Math.sin(t * 0.8 + i * 2) * 0.15;
      }

      // Key light pulses.
      key.intensity = 2.6 + Math.sin(t * 2.2) * 0.8;

      scene.render();
    });

    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="studio-3d-canvas"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: 1 }}
    />
  );
}
