import { describe, it, expect, afterEach, vi } from 'vitest';

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };

function fakeStorage(initial: Record<string, string> = {}): Store & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

// dx-preference keeps module-level state, so load a fresh copy per test.
async function load(opts: { runtime?: RuntimeConfig; storage?: Store | 'broken' } = {}) {
  vi.resetModules();
  vi.stubEnv('VITE_DX_ENABLED', '');
  if (opts.runtime) vi.stubGlobal('window', { __CONFIG__: opts.runtime });
  if (opts.storage === 'broken') {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
    });
  } else if (opts.storage) {
    vi.stubGlobal('localStorage', opts.storage);
  }
  return import('../dx-preference');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('dx preference', () => {
  it('defaults to on', async () => {
    const m = await load({ storage: fakeStorage() });
    expect(m.getDxEnabled()).toBe(true);
  });

  it('honours a saved off preference and ignores unknown values', async () => {
    expect((await load({ storage: fakeStorage({ 'nwv-dx-enabled': '0' }) })).getDxEnabled()).toBe(false);
    expect((await load({ storage: fakeStorage({ 'nwv-dx-enabled': 'banana' }) })).getDxEnabled()).toBe(true);
  });

  it('persists a change and notifies subscribers', async () => {
    const storage = fakeStorage();
    const m = await load({ storage });
    const seen = vi.fn();
    const unsubscribe = m.subscribeDxEnabled(seen);
    m.setDxEnabled(false);
    expect(m.getDxEnabled()).toBe(false);
    expect(storage.map.get('nwv-dx-enabled')).toBe('0');
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
    m.setDxEnabled(true);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(m.getDxEnabled()).toBe(true);
  });

  it('cannot be turned on when the deployment disabled Direct Connect', async () => {
    const m = await load({ runtime: { dxEnabled: false }, storage: fakeStorage({ 'nwv-dx-enabled': '1' }) });
    expect(m.getDxEnabled()).toBe(false);
    m.setDxEnabled(true);
    expect(m.getDxEnabled()).toBe(false);
  });

  it('still works for the session when localStorage is unavailable', async () => {
    const m = await load({ storage: 'broken' });
    expect(m.getDxEnabled()).toBe(true);
    m.setDxEnabled(false);
    expect(m.getDxEnabled()).toBe(false);
  });
});
