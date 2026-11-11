import { describe, it, expect, vi } from 'vitest';
import { registerOfflineServiceWorker } from './registerSw';

describe('registerOfflineServiceWorker', () => {
  it('skips registration when serviceWorker is unsupported or on plain localhost without ?sw=1', () => {
    const addListener = vi.fn();
    const fakeWin = { addEventListener: addListener };

    registerOfflineServiceWorker(fakeWin, {}, { hostname: 'example.com', search: '' });
    expect(addListener).not.toHaveBeenCalled();

    const regSpy = vi.fn().mockResolvedValue({});
    registerOfflineServiceWorker(
      fakeWin,
      { serviceWorker: { register: regSpy } },
      { hostname: 'localhost', search: '' }
    );
    expect(addListener).not.toHaveBeenCalled();
  });

  it('registers ./sw.js on production hostnames or localhost?sw=1 and reports registration errors cleanly', async () => {
    let loadHandler: (() => void) | undefined;
    const fakeWin = {
      addEventListener: vi.fn((_ev: string, cb: () => void) => {
        loadHandler = cb;
      })
    };

    const regSpy = vi.fn().mockResolvedValue({});
    registerOfflineServiceWorker(
      fakeWin,
      { serviceWorker: { register: regSpy } },
      { hostname: 'timmatt-lee.github.io', search: '' }
    );
    loadHandler?.();
    expect(regSpy).toHaveBeenCalledWith('./sw.js');

    // Error instance & non-Error rejection paths on localhost?sw=1
    const errors: Error[] = [];
    const failSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blocked'))
      .mockRejectedValueOnce('raw rejection');

    registerOfflineServiceWorker(
      fakeWin,
      { serviceWorker: { register: failSpy } },
      { hostname: '127.0.0.1', search: '?sw=1' },
      (e) => errors.push(e)
    );
    loadHandler?.();
    await Promise.resolve();
    loadHandler?.();
    await Promise.resolve();

    expect(errors.map((e) => e.message)).toEqual(['network blocked', 'raw rejection']);

    // Also invoke default arguments safely (localhost in happy-dom returns early)
    expect(() => {
      registerOfflineServiceWorker();
    }).not.toThrow();
  });
});
