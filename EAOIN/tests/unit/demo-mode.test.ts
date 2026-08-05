import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setDemoStore, isDemo, SINGULARITY_SESSION_MS, EXPERIMENTAL_DAILY_MS,
  startSingularitySession, singularityRemainingMs, singularityExhausted,
  experimentalRemainingMs, consumeExperimental, experimentalExhausted,
  blockSecretEnding, demoMaxJourneyStage, formatMs, msUntilMidnight,
  DEMO_MAX_JOURNEY_WORLDS,
} from '../../src/demo/DemoMode';

// Mock window.eaoinDesktop.isDemo + a localStorage-like store.
const mem = new Map<string, string>();
const store = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
};

beforeEach(() => {
  mem.clear();
  setDemoStore(store);
  Object.defineProperty(globalThis, 'window', {
    value: { eaoinDesktop: { isDemo: true } },
    configurable: true,
  });
});

describe('DemoMode — detection', () => {
  it('isDemo() is true when the desktop demo flag is present', () => {
    expect(isDemo()).toBe(true);
  });

  it('isDemo() is false when the flag is absent', () => {
    Object.defineProperty(globalThis, 'window', {
      value: { eaoinDesktop: { isDemo: false } },
      configurable: true,
    });
    expect(isDemo()).toBe(false);
  });
});

describe('DemoMode — Singularity 30-min session', () => {
  it('starts a session and counts down from 30 minutes', () => {
    startSingularitySession();
    const rem = singularityRemainingMs();
    expect(rem).toBeGreaterThan(0);
    expect(rem).toBeLessThanOrEqual(SINGULARITY_SESSION_MS);
    expect(singularityExhausted()).toBe(false);
  });

  it('a fresh session is 30 minutes', () => {
    startSingularitySession();
    // allow small elapsed skew
    expect(singularityRemainingMs()).toBeGreaterThan(SINGULARITY_SESSION_MS - 5000);
  });

  it('reports exhausted once the session time has passed', () => {
    // Simulate a session that started 31 minutes ago.
    mem.set('eaoin_demo_singularity_start', String(Date.now() - SINGULARITY_SESSION_MS - 1000));
    expect(singularityExhausted()).toBe(true);
    expect(singularityRemainingMs()).toBe(0);
  });
});

describe('DemoMode — daily experimental allowance', () => {
  it('starts with a full daily allowance', () => {
    expect(experimentalRemainingMs()).toBe(EXPERIMENTAL_DAILY_MS);
    expect(experimentalExhausted()).toBe(false);
  });

  it('consumes play time and depletes the allowance', () => {
    consumeExperimental(EXPERIMENTAL_DAILY_MS);
    expect(experimentalExhausted()).toBe(true);
    expect(experimentalRemainingMs()).toBe(0);
  });

  it('resets the allowance the next day (new day key)', () => {
    consumeExperimental(EXPERIMENTAL_DAILY_MS);
    expect(experimentalExhausted()).toBe(true);
    // Simulate the day rolling over.
    mem.delete('eaoin_demo_exp_day');
    expect(experimentalRemainingMs()).toBe(EXPERIMENTAL_DAILY_MS);
  });
});

describe('DemoMode — content gating + format', () => {
  it('blocks the secret ending and caps journey worlds in the demo', () => {
    expect(blockSecretEnding()).toBe(true);
    expect(demoMaxJourneyStage()).toBe(DEMO_MAX_JOURNEY_WORLDS);
  });

  it('formats countdowns as mm:ss / h:mm:ss', () => {
    expect(formatMs(0)).toBe('00:00');
    expect(formatMs(90_000)).toBe('01:30');
    expect(formatMs(3_600_000 + 120_000)).toBe('1:02:00');
    expect(formatMs(Infinity)).toBe('∞');
  });

  it('msUntilMidnight is positive and under a day', () => {
    const ms = msUntilMidnight();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});
