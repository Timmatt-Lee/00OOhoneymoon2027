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

  it('registers ./sw.js with updateViaCache: none, checks for updates on foreground visibilitychange, and reports registration errors', async () => {
    let loadHandler: (() => void) | undefined;
    const fakeWin = {
      addEventListener: vi.fn((_ev: string, cb: () => void) => {
        loadHandler = cb;
      })
    };

    const visibilityHandlers: Array<() => void> = [];
    const fakeDoc = {
      hidden: true,
      addEventListener: vi.fn((_ev: string, cb: () => void) => {
        visibilityHandlers.push(cb);
      })
    };

    const updateSpy = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('offline resume'));
    const regSpy = vi.fn().mockResolvedValueOnce({ update: updateSpy }).mockResolvedValueOnce({});

    registerOfflineServiceWorker(
      fakeWin,
      { serviceWorker: { register: regSpy } },
      { hostname: 'timmatt-lee.github.io', search: '' },
      undefined,
      fakeDoc
    );
    loadHandler?.();
    expect(regSpy).toHaveBeenCalledWith('./sw.js', { updateViaCache: 'none' });
    await Promise.resolve();
    expect(visibilityHandlers).toHaveLength(1);

    // Hidden background transition does not trigger SW update check
    fakeDoc.hidden = true;
    visibilityHandlers[0]();
    expect(updateSpy).not.toHaveBeenCalled();

    // Foreground resume (!doc.hidden) triggers reg.update() and swallows offline update rejections
    fakeDoc.hidden = false;
    visibilityHandlers[0]();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    visibilityHandlers[0]();
    expect(updateSpy).toHaveBeenCalledTimes(2);
    await Promise.resolve();

    // Registration without an update() method handles foreground resume safely
    loadHandler?.();
    await Promise.resolve();
    expect(visibilityHandlers).toHaveLength(2);
    visibilityHandlers[1]();

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
    await Promise.resolve();
    loadHandler?.();
    await Promise.resolve();
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
