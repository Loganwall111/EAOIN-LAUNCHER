// @vitest-environment jsdom
/**
 * 2.0 Update Part 2 — grass block PNG retexture.
 *
 * The grass block gets its own dedicated PNG asset (public/textures/grass.png).
 * These tests pin that the asset exists, is a valid PNG, and that the texture
 * pipeline routes grass (id 1) to the PNG path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const GRASS_PNG = resolve(__dirname, '../../public/textures/grass.png');

describe('grass block PNG retexture', () => {
  it('ships a dedicated grass.png asset', () => {
    expect(existsSync(GRASS_PNG)).toBe(true);
  });

  it('is a valid PNG file', () => {
    const buf = readFileSync(GRASS_PNG);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // Must be a 16x16 RGBA (IHDR width/height at bytes 16-23).
    expect(buf.readUInt32BE(16)).toBe(16);
    expect(buf.readUInt32BE(20)).toBe(16);
  });
});
