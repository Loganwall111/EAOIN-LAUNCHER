// @vitest-environment jsdom
/**
 * 2.0 Update Part 2 — ending ticket + God Mode.
 *
 * Finishing the game grants a read-once ending ticket showing the key numbers;
 * completing the ARG unlocks God Mode (super edit everywhere). These tests pin
 * the read-once ticket behavior and God Mode unlock/toggle logic.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EndingTicket, ENDING_TICKET_CODE } from '../../src/arg/EndingTicket';
import { GodMode } from '../../src/arg/GodMode';

describe('EndingTicket — read-once ticket', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts un-granted and unread', () => {
    const t = new EndingTicket();
    expect(t.get().granted).toBe(false);
    expect(t.get().read).toBe(false);
  });

  it('granting the ticket shows the code on first read, then READ', () => {
    const t = new EndingTicket();
    t.grant();
    expect(t.get().granted).toBe(true);
    // first read returns the code
    const first = t.read();
    expect(first.code).toBe(ENDING_TICKET_CODE);
    expect(first.read).toBe(true);
    // second read is marked READ (code still stored but ticket is read)
    const second = t.read();
    expect(second.read).toBe(true);
  });
});

describe('GodMode — the gift of a lifetime', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts locked', () => {
    const g = new GodMode();
    expect(g.isUnlocked()).toBe(false);
    expect(g.isActive()).toBe(false);
  });

  it('cannot toggle while locked', () => {
    const g = new GodMode();
    expect(g.toggleActive()).toBe(false);
    expect(g.isActive()).toBe(false);
  });

  it('unlocks and toggles active, persisting toggles', () => {
    const g = new GodMode();
    g.unlock();
    expect(g.isUnlocked()).toBe(true);
    expect(g.toggleActive()).toBe(true);
    g.set('superEdit', true);
    g.set('noDamage', true);
    expect(g.get().superEdit).toBe(true);
    expect(g.get().noDamage).toBe(true);
    // a fresh instance persists
    const g2 = new GodMode();
    expect(g2.isUnlocked()).toBe(true);
    expect(g2.isActive()).toBe(true);
    expect(g2.get().superEdit).toBe(true);
  });
});
