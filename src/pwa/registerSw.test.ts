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

  it('registers ./sw.js with updateViaCache: none and reports registration errors via custom or default handler', async () => {
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
    expect(regSpy).toHaveBeenCalledWith('./sw.js', { updateViaCache: 'none' });

    // Custom error handler receives normalized Error for both Error and non-Error rejections
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

    // Default error handler logs warning cleanly when onRegisterError is omitted
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const defaultFailSpy = vi.fn().mockRejectedValueOnce(new Error('default warn check'));
    registerOfflineServiceWorker(
      fakeWin,
      { serviceWorker: { register: defaultFailSpy } },
      { hostname: 'timmatt-lee.github.io', search: '' }
    );
    loadHandler?.();
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith(
      '[PWA] Service Worker registration failed:',
      'default warn check'
    );
    warnSpy.mockRestore();

    // Default arguments execute safely in localhost happy-dom environment
    expect(() => {
      registerOfflineServiceWorker();
    }).not.toThrow();
  });
});
