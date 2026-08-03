// @vitest-environment jsdom
/**
 * ARGStoryline — the EAOIN alternate-reality storyline.
 *
 * Collecting fragments across dimensions assembles the key "EAOIN". These
 * tests pin the collect/progress/key-reveal logic.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ARG_FRAGMENTS, ARGStoryline } from '../../src/arg/ARGStoryline';

const KEY = 'EAOIN';

describe('ARGStoryline', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts with no fragments and incomplete key', () => {
    const arg = new ARGStoryline();
    expect(arg.progress()).toEqual({ found: 0, total: ARG_FRAGMENTS.length, pct: 0 });
    expect(arg.isKeyComplete()).toBe(false);
    expect(arg.revealKey()).toBeNull();
  });

  it('collects a fragment by dimension and persists it', () => {
    const arg = new ARGStoryline();
    const frag = arg.collect('nether');
    expect(frag?.title).toBe('The Forge');
    expect(arg.getState().collected).toContain('nether');
    expect(arg.progress().found).toBe(1);
    // collecting the same one again is a no-op
    expect(arg.collect('nether')).toBeNull();
    // a fresh instance (same storage) sees it
    const arg2 = new ARGStoryline();
    expect(arg2.getState().collected).toContain('nether');
  });

  it('assembles the glyphs in canonical order', () => {
    const arg = new ARGStoryline();
    arg.collect('aether'); // I
    arg.collect('overworld'); // E
    arg.collect('nether'); // A
    expect(arg.assembledGlyphs()).toBe('EAI');
  });

  it('reveals the key EAOIN once all fragments are collected', () => {
    const arg = new ARGStoryline();
    for (const f of ARG_FRAGMENTS) arg.collect(f.id);
    expect(arg.isKeyComplete()).toBe(true);
    expect(arg.revealKey()).toBe(KEY);
    expect(arg.assembledGlyphs()).toBe('EAOIN');
  });
});
