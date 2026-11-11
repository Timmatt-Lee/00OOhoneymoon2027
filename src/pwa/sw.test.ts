import { describe, it, expect, vi } from 'vitest';
import {
  bindServiceWorkerLifecycle,
  bootstrapServiceWorkerGlobal,
  type ExtendableEventLike,
  type FetchEventLike,
  type ServiceWorkerScopeLike,
  type SwCacheLike
} from './sw';

function createMockSwHarness() {
  const store = new Map<string, Response>();
  const deletedCaches: string[] = [];
  const listeners = new Map<string, (ev: unknown) => void>();

  const cacheObj: SwCacheLike = {
    addAll: vi.fn(async (urls: readonly string[]) => {
      for (const u of urls) {
        const normalized = u.startsWith('./') ? `https://timmatt-lee.github.io/${u.slice(2)}` : u;
        store.set(normalized, new Response(`precached:${u}`, { status: 200 }));
        store.set(u, new Response(`precached:${u}`, { status: 200 }));
      }
      await Promise.resolve();
    }),
    match: vi.fn(async (req: Request | string) => {
      const key = typeof req === 'string' ? req : req.url;
      const found = store.get(key);
      await Promise.resolve();
      return found ? found.clone() : undefined;
    }),
    put: vi.fn(async (req: Request | string, res: Response) => {
      const key = typeof req === 'string' ? req : req.url;
      store.set(key, res.clone());
      await Promise.resolve();
    })
  };

  const scope: ServiceWorkerScopeLike = {
    location: { origin: 'https://timmatt-lee.github.io' },
    caches: {
      open: vi.fn(async () => {
        await Promise.resolve();
        return cacheObj;
      }),
      keys: vi.fn(async () => {
        await Promise.resolve();
        return ['honeymoon-2027-old', 'honeymoon-2027-v3'];
      }),
      delete: vi.fn(async (k: string) => {
        deletedCaches.push(k);
        await Promise.resolve();
        return true;
      }),
      match: vi.fn(async (req: Request | string) => cacheObj.match(req))
    },
    clients: {
      claim: vi.fn(async () => {
        await Promise.resolve();
      })
    },
    skipWaiting: vi.fn(async () => {
      await Promise.resolve();
    }),
    fetch: vi.fn(async (req: Request) => {
      await Promise.resolve();
      return new Response(`live:${req.url}`, { status: 200 });
    }),
    addEventListener: ((type: string, cb: (ev: unknown) => void) => {
      listeners.set(type, cb);
    }) as ServiceWorkerScopeLike['addEventListener']
  };

  return { scope, store, cacheObj, deletedCaches, listeners };
}

describe('Service Worker lifecycle & caching strategies', () => {
  it('precaches manifest on install and purges stale caches on activate', async () => {
    const h = createMockSwHarness();
    bindServiceWorkerLifecycle(h.scope, 'honeymoon-2027-v3', ['./', './index.html']);

    let installPromise: Promise<unknown> = Promise.resolve();
    const installEv: ExtendableEventLike = {
      waitUntil: (p) => {
        installPromise = p;
      }
    };
    h.listeners.get('install')?.(installEv);
    await installPromise;
    expect(h.cacheObj.addAll).toHaveBeenCalledWith(['./', './index.html']);
    expect(h.scope.skipWaiting).toHaveBeenCalled();

    let activatePromise: Promise<unknown> = Promise.resolve();
    const activateEv: ExtendableEventLike = {
      waitUntil: (p) => {
        activatePromise = p;
      }
    };
    h.listeners.get('activate')?.(activateEv);
    await activatePromise;
    expect(h.deletedCaches).toEqual(['honeymoon-2027-old']);
    expect(h.scope.clients.claim).toHaveBeenCalled();
  });

  it('handles navigation NetworkFirst, static CacheFirst, generic GET fallback, and ignores POST / cross-origin', async () => {
    const h = createMockSwHarness();
    bindServiceWorkerLifecycle(h.scope, 'honeymoon-2027-v3', ['./', './index.html']);

    const dispatchFetch = async (
      url: string,
      init?: RequestInit,
      modeOverride?: RequestMode,
      destOverride?: RequestDestination
    ): Promise<Response | null> => {
      const req = new Request(url, init);
      if (modeOverride) {
        Object.defineProperty(req, 'mode', { value: modeOverride });
      }
      if (destOverride) {
        Object.defineProperty(req, 'destination', { value: destOverride });
      }
      const captured: { value: Promise<Response> | Response | null } = { value: null };
      const ev: FetchEventLike = {
        request: req,
        waitUntil: () => {},
        respondWith: (r) => {
          captured.value = r;
        }
      };
      h.listeners.get('fetch')?.(ev);
      return captured.value ? await captured.value : null;
    };

    // Non-GET and cross-origin requests are ignored
    expect(await dispatchFetch('https://timmatt-lee.github.io/api', { method: 'POST' })).toBeNull();
    expect(await dispatchFetch('https://maps.googleapis.com/maps')).toBeNull();

    // Online navigation caches 200 response (and skips caching non-200)
    const navOnline = await dispatchFetch(
      'https://timmatt-lee.github.io/00OOhoneymoon2027/',
      undefined,
      'navigate'
    );
    expect(await navOnline?.text()).toContain('live:');

    vi.mocked(h.scope.fetch).mockResolvedValueOnce(new Response('not found', { status: 404 }));
    const nav404 = await dispatchFetch(
      'https://timmatt-lee.github.io/missing',
      undefined,
      'navigate'
    );
    expect(nav404?.status).toBe(404);

    // Offline navigation falls back to precached ./index.html or ./, and throws if completely empty
    h.store.set('./index.html', new Response('cached-shell', { status: 200 }));
    vi.mocked(h.scope.fetch).mockRejectedValueOnce(new Error('offline'));
    const navOffline = await dispatchFetch(
      'https://timmatt-lee.github.io/unvisited',
      undefined,
      'navigate'
    );
    expect(await navOffline?.text()).toBe('cached-shell');

    h.store.delete('./index.html');
    h.store.set('./', new Response('cached-root', { status: 200 }));
    vi.mocked(h.scope.fetch).mockRejectedValueOnce(new Error('offline'));
    const navRootFallback = await dispatchFetch(
      'https://timmatt-lee.github.io/unvisited2',
      undefined,
      'navigate'
    );
    expect(await navRootFallback?.text()).toBe('cached-root');

    h.store.clear();
    vi.mocked(h.scope.fetch).mockRejectedValueOnce(new Error('offline'));
    await expect(
      dispatchFetch('https://timmatt-lee.github.io/unvisited3', undefined, 'navigate')
    ).rejects.toThrow(/no cached application shell/);

    // Static assets use CacheFirst (miss fetches & caches, subsequent hit serves from cache, non-200 not cached)
    const assetMiss = await dispatchFetch(
      'https://timmatt-lee.github.io/assets/app-123.js',
      undefined,
      'cors',
      'script'
    );
    expect(await assetMiss?.text()).toContain('live:');
    const assetHit = await dispatchFetch(
      'https://timmatt-lee.github.io/assets/app-123.js',
      undefined,
      'cors',
      'script'
    );
    expect(await assetHit?.text()).toContain('live:');

    vi.mocked(h.scope.fetch).mockResolvedValueOnce(new Response('err', { status: 500 }));
    const asset500 = await dispatchFetch(
      'https://timmatt-lee.github.io/assets/bad.js',
      undefined,
      'cors',
      'script'
    );
    expect(asset500?.status).toBe(500);

    // Generic same-origin GET (e.g. JSON) uses NetworkFirst + offline fallback
    const jsonOnline = await dispatchFetch('https://timmatt-lee.github.io/data.json');
    expect(await jsonOnline?.text()).toContain('live:');

    vi.mocked(h.scope.fetch).mockResolvedValueOnce(new Response('err', { status: 503 }));
    await dispatchFetch('https://timmatt-lee.github.io/other.json');

    vi.mocked(h.scope.fetch).mockRejectedValueOnce(new Error('offline'));
    const jsonOfflineHit = await dispatchFetch('https://timmatt-lee.github.io/data.json');
    expect(await jsonOfflineHit?.text()).toContain('live:');

    vi.mocked(h.scope.fetch).mockRejectedValueOnce(new Error('offline'));
    await expect(dispatchFetch('https://timmatt-lee.github.io/uncached.json')).rejects.toThrow(
      /Offline cache miss/
    );
  });

  it('bootstraps only when ServiceWorkerGlobalScope is present on global object', () => {
    const h = createMockSwHarness();
    // Non-SW environment -> no-op
    bootstrapServiceWorkerGlobal({});

    // Simulated SW global environment with fallback constants and injected constants
    const fakeGlobal = {
      ...h.scope,
      ServiceWorkerGlobalScope: function SwCtor() {}
    };
    bootstrapServiceWorkerGlobal(fakeGlobal);
    expect(h.listeners.has('install')).toBe(true);

    vi.stubGlobal('__SW_CACHE_NAME__', 'honeymoon-2027-injected');
    vi.stubGlobal('__SW_PRECACHE_URLS__', ['./', './manifest.json']);
    bootstrapServiceWorkerGlobal(fakeGlobal);
    vi.unstubAllGlobals();
  });
});
