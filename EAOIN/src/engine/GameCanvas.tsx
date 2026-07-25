import { useEffect, useRef, useState } from 'react';
import {
  Engine, Scene, UniversalCamera, HemisphericLight, Vector3,
  Color3, Color4, MeshBuilder, StandardMaterial, Mesh
} from '@babylonjs/core';
import { Chunk } from '../world/Chunk';
import { TerrainGenerator } from '../world/TerrainGenerator';

interface GameCanvasProps {
  seed: string;
  onExit: () => void;
}

export default function GameCanvas({ seed, onExit }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [health] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 8, z: -10 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.035, 0.055, 0.1, 1);

    const camera = new UniversalCamera('playerCamera', new Vector3(0, 8, -10), scene);
    camera.attachControl(canvasRef.current, true);
    camera.speed = 0.25;
    camera.angularSensibility = 4000;
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new Vector3(0.4, 0.9, 0.4);
    scene.gravity = new Vector3(0, -0.25, 0);
    scene.collisionsEnabled = true;

    const light = new HemisphericLight('sun', new Vector3(0, 1, 0), scene);
    light.intensity = 1.4;

    // Generate chunk terrain
    const terrain = new TerrainGenerator(seed);
    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        const chunk = terrain.generateChunk(cx, cz);
        // Mesh generation placeholder — real mesh builder connects here
        console.log(`[Render] Chunk ${cx},${cz} loaded (${chunk.getBlock(8, 5, 8)})`);
      }
    }

    engine.runRenderLoop(() => {
      scene.render();
    });
    window.addEventListener('resize', () => engine.resize());

    return () => {
      window.removeEventListener('resize', () => engine.resize());
      scene.dispose();
      engine.dispose();
    };
  }, [seed]);

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="game-hud">
        <div className="hud-top">
          <div>❤️ {health}</div>
          <div>EAOIN • OVERWORLD • SEED: {seed}</div>
        </div>
        <div className="crosshair">+</div>
        <button className="exit-game" onClick={onExit}>EXIT</button>
      </div>
    </div>
  );
}
