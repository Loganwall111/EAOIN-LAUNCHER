/**
 * ServerLobbyWorld — a real, block-built lobby you can walk around in.
 *
 * Joining a server spins up a lightweight Babylon world that renders the
 * prebuilt lobby (plaza, themed block buildings, paths, lampposts) and lets
 * you walk around it with WASD/mouse. A banner names the server and shows the
 * player count / MOTD.
 */
import { useEffect, useRef } from 'react';
import { Color4, Engine, FreeCamera, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';
import { createBlockMaterials } from '../rendering/BlockMaterials';
import { ChunkRenderManager } from '../rendering/ChunkRenderManager';
import { lobbyChunkSource, lobbySpawnY } from '../effects/ServerLobby';
import type { ServerEntry } from '../networking/ServerBrowser';

export interface ServerLobbyWorldProps {
  server: ServerEntry;
  onExit: () => void;
}

export default function ServerLobbyWorld({ server, onExit }: ServerLobbyWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.4, 0.6, 0.9, 1);
    scene.gravity = new Vector3(0, -0.6, 0);
    scene.collisionsEnabled = true;

    // The player spawns ON the ground (eye just above the plaza surface) with
    // collision + gravity so they can actually walk around — the old code left
    // the camera floating in the air with no collision, which made joining a
    // server feel like a broken "pan out" where you couldn't move.
    const camStart = new Vector3(0, lobbySpawnY() + 1, 12);
    const camera = new FreeCamera('lobby_cam', camStart, scene);
    camera.setTarget(new Vector3(0, lobbySpawnY(), 0));
    camera.attachControl(canvas, true);
    camera.checkCollisions = true;
    camera.applyGravity = true;
    camera.ellipsoid = new Vector3(0.3, 0.9, 0.3);
    camera.ellipsoidOffset = new Vector3(0, 0.9, 0);
    camera.minZ = 0.1;
    camera.keysUp = [87, 38]; camera.keysDown = [83, 40];
    camera.keysLeft = [65, 37]; camera.keysRight = [68, 39];
    camera.speed = 0.6;

    const light = new HemisphericLight('lobby_light', new Vector3(0.5, 1, 0.3), scene);
    light.intensity = 0.9;

    const materials = createBlockMaterials(scene, 'classic');
    const renderer = new ChunkRenderManager(scene, materials);
    const source = lobbyChunkSource(server.type, server.id);
    renderer.updateVisibleChunks(0, 0, 2, source);

    engine.runRenderLoop(() => scene.render());
    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      engine.dispose();
    };
  }, [server, onExit]);

  return (
    <div className="server-lobby" style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div className="lobby-banner">
        <div className="lobby-name">{server.emoji} {server.name}</div>
        <div className="lobby-motd">{server.motd}</div>
        <div className="lobby-meta">{server.players}/{server.maxPlayers} players • {server.ping}ms • {server.region}</div>
        <button className="btn-secondary" onClick={onExit}>← Leave lobby</button>
      </div>
    </div>
  );
}
