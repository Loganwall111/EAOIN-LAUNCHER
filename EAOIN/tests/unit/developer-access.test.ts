/**
 * Developer Access Lock regression tests.
 *
 * The requirement: during Alpha Access the developer app panel is hidden and
 * completely locked down for general players, but opens instantly when the
 * developer triggers it (stored grant, dev runtime, URL grant, or the unlock
 * code).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ALPHA_ACCESS_LOCKDOWN,
  DeveloperAccessController,
  DEVELOPER_ACCESS_STORAGE_KEY,
  DEVELOPER_ACCESS_URL_PARAM,
  DEVELOPER_UNLOCK_CODE,
} from '../../src/dev/DeveloperAccess';

/** In-memory Storage stand-in. */
function makeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
}

describe('Developer Access Lock', () => {
  it('ships with the Alpha Access lockdown enabled', () => {
    expect(ALPHA_ACCESS_LOCKDOWN).toBe(true);
  });

  describe('a general player (no grant anywhere)', () => {
    let access: DeveloperAccessController;
    beforeEach(() => {
      access = new DeveloperAccessController({ storage: null, devRuntime: false, urlSearch: '' });
    });

    it('starts fully locked: no grant, no gate, no panel', () => {
      const s = access.get();
      expect(s.granted).toBe(false);
      expect(s.gateOpen).toBe(false);
      expect(s.panelOpen).toBe(false);
      expect(access.isGranted()).toBe(false);
    });

    it('the developer trigger reveals the lock gate but grants nothing', () => {
      access.trigger();
      expect(access.get().gateOpen).toBe(true);
      expect(access.isGranted()).toBe(false);
      expect(access.get().panelOpen).toBe(false);
    });

    it('a wrong unlock code is denied with feedback and stays locked', () => {
      access.trigger();
      const ok = access.submitCode('let-me-in');
      expect(ok).toBe(false);
      const s = access.get();
      expect(s.granted).toBe(false);
      expect(s.panelOpen).toBe(false);
      expect(s.lastError).toBeTruthy();
    });

    it('an empty code never grants', () => {
      expect(access.submitCode('   ')).toBe(false);
      expect(access.isGranted()).toBe(false);
      expect(access.get().lastError).toBeTruthy();
    });

    it('the correct code grants instantly and opens the panel on the spot', () => {
      access.trigger();
      const ok = access.submitCode(`  ${DEVELOPER_UNLOCK_CODE.toLowerCase()}  `);
      expect(ok).toBe(true);
      const s = access.get();
      expect(s.granted).toBe(true);
      expect(s.gateOpen).toBe(false);
      expect(s.panelOpen).toBe(true); // instantly open — the developer trigger
      expect(s.lastError).toBeNull();
    });
  });

  describe('a developer machine', () => {
    it('instantly opens from the trigger once a grant exists', () => {
      const storage = makeStorage();
      storage.setItem(DEVELOPER_ACCESS_STORAGE_KEY, 'granted:v1');
      const access = new DeveloperAccessController({ storage, devRuntime: false, urlSearch: '' });
      expect(access.isGranted()).toBe(true);

      access.trigger();
      expect(access.get().panelOpen).toBe(true); // one keypress, no gate
      access.trigger();
      expect(access.get().panelOpen).toBe(false); // toggles
    });

    it('remembers the grant after a code unlock (persists to storage)', () => {
      const storage = makeStorage();
      const first = new DeveloperAccessController({ storage, devRuntime: false, urlSearch: '' });
      first.submitCode(DEVELOPER_UNLOCK_CODE);
      expect(storage.getItem(DEVELOPER_ACCESS_STORAGE_KEY)).toBe('granted:v1');

      const second = new DeveloperAccessController({ storage, devRuntime: false, urlSearch: '' });
      expect(second.isGranted()).toBe(true);
    });

    it('grants on the Vite dev server runtime', () => {
      const access = new DeveloperAccessController({ storage: null, devRuntime: true, urlSearch: '' });
      expect(access.isGranted()).toBe(true);
    });

    it('grants from the developer URL parameter', () => {
      const access = new DeveloperAccessController({
        storage: null,
        devRuntime: false,
        urlSearch: `?${DEVELOPER_ACCESS_URL_PARAM}=${DEVELOPER_UNLOCK_CODE}`,
      });
      expect(access.isGranted()).toBe(true);
    });

    it('a malformed URL parameter does not grant', () => {
      const access = new DeveloperAccessController({
        storage: null,
        devRuntime: false,
        urlSearch: `?${DEVELOPER_ACCESS_URL_PARAM}=wrong-code`,
      });
      expect(access.isGranted()).toBe(false);
    });

    it('lock() revokes the grant and clears the stored token', () => {
      const storage = makeStorage();
      const access = new DeveloperAccessController({ storage, devRuntime: true, urlSearch: '' });
      expect(access.isGranted()).toBe(true);
      access.lock();
      expect(access.isGranted()).toBe(false);
      expect(storage.getItem(DEVELOPER_ACCESS_STORAGE_KEY)).toBeNull();
      expect(access.get().panelOpen).toBe(false);
    });
  });

  describe('observability', () => {
    it('notifies subscribers on every state change', () => {
      const access = new DeveloperAccessController({ storage: null, devRuntime: false, urlSearch: '' });
      const seen: string[] = [];
      const unsubscribe = access.subscribe((s) => {
        seen.push(`granted=${s.granted},gate=${s.gateOpen},panel=${s.panelOpen}`);
      });
      access.trigger();
      access.submitCode(DEVELOPER_UNLOCK_CODE);
      access.trigger();
      expect(seen.length).toBeGreaterThanOrEqual(3);
      expect(seen[0]).toBe('granted=false,gate=true,panel=false');
      expect(seen[1]).toBe('granted=true,gate=false,panel=true');
      expect(seen[2]).toBe('granted=true,gate=false,panel=false');
      unsubscribe();
    });

    it('dismiss closes gate and panel without revoking the grant', () => {
      const access = new DeveloperAccessController({ storage: null, devRuntime: true, urlSearch: '' });
      access.trigger(); // open panel
      access.dismiss();
      const s = access.get();
      expect(s.panelOpen).toBe(false);
      expect(s.granted).toBe(true);
    });
  });
});
