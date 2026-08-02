/**
 * ParticleDotTexture — a soft white particle sprite built from raw RGBA data.
 *
 * Babylon's `Texture.CreateFromBase64String` loads through an `Image`, which
 * can fail on the WebGPU backend and fall back to the red/black checkerboard
 * "missing texture" sprite. Building the sprite as a `RawTexture` from a
 * plain RGBA buffer is fully procedural, works identically on WebGL and
 * WebGPU, and can never be a checkerboard.
 */
import { RawTexture, Scene, Texture } from '@babylonjs/core';

/** A 16×16 soft-edged white dot — the base sprite for every soft particle. */
export function createParticleDotTexture(scene: Scene): RawTexture {
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  const radius = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const d = Math.hypot(x - c, y - c);
      // Soft falloff: solid core, feathered edge.
      const t = Math.max(0, Math.min(1, (radius - d) / radius));
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(t * 255);
    }
  }

  const texture = RawTexture.CreateRGBATexture(
    data,
    size,
    size,
    scene,
    false, // generateMipMaps
    false, // invertY
    Texture.BILINEAR_SAMPLINGMODE
  );
  texture.name = 'particle_dot_raw';
  texture.hasAlpha = true;
  return texture;
}
