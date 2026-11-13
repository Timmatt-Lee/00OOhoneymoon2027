import { describe, it, expect, vi } from 'vitest';
import {
  bindServiceWorkerLifecycle,
  bootstrapServiceWorkerGlobal,
  tryCachePut,
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
    addAll: vi.fn(async (requests: readonly (Request | string)[]) => {
      for (const reqOrUrl of requests) {
        const rawUrl = typeof reqOrUrl === 'string' ? reqOrUrl : reqOrUrl.url;
        const normalized = rawUrl.startsWith('./')
          ? `https://timmatt-lee.github.io/00OOhoneymoon2027/${rawUrl.slice(2)}`
          : rawUrl;
        store.set(normalized, new Response(`precached:${rawUrl}`, { status: 200 }));
        store.set(rawUrl, new Response(`precached:${rawUrl}`, { status: 200 }));
      }
      await Promise.resolve();
    }),
    match: vi.fn(async (req: Request | string, opts?: MultiCacheQueryOptions) => {
      const rawKey = typeof req === 'string' ? req : req.url;
      const key = opts?.ignoreSearch ? rawKey.split('?')[0] : rawKey;
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
      match: vi.fn(async (req: Request | string, opts?: MultiCacheQueryOptions) =>
        cacheObj.match(req, opts)
      )
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

describe('Service Worker lifecycle, quota resilience & caching strategies', () => {
  it('precaches manifest on install with cache=reload and purges stale caches on activate', async () => {
    const BaseRequest = globalThis.Request;
    class CacheAwareRequest extends BaseRequest {
      private readonly resolvedCache: RequestCache;
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(input, init);
        this.resolvedCache = init?.cache ?? 'default';
      }
      override get cache(): RequestCache {
        return this.resolvedCache;
      }
    }
    vi.stubGlobal('Request', CacheAwareRequest);

    const h = createMockSwHarness();
    bindServiceWorkerLifecycle(h.scope, 'honeymoon-2027-v3', ['./index.html', './manifest.json']);

    let installPromise: Promise<unknown> = Promise.resolve();
    const installEv: ExtendableEventLike = {
      waitUntil: (p) => {
        installPromise = p;
      }
    };
    h.listeners.get('install')?.(installEv);
    await installPromise;
    expect(h.cacheObj.addAll).toHaveBeenCalledTimes(1);
    const precacheBatch = vi.mocked(h.cacheObj.addAll).mock.calls[0]?.[0] ?? [];
    expect(precacheBatch).toHaveLength(2);
    for (const entry of precacheBatch) {
      expect(entry).toBeInstanceOf(Request);
      if (entry instanceof Request) {
        expect(entry.cache).toBe('reload');
      }
    }
    expect(precacheBatch.map((entry) => (typeof entry === 'string' ? entry : entry.url))).toEqual([
      expect.stringContaining('/index.html'),
      expect.stringContaining('/manifest.json')
    ]);
    await h.cacheObj.addAll(['./extra.json']);
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

  it('handles navigation skew-safe NetworkFirst, static CacheFirst with match recovery, Range/POST/cross-origin bypass, and generic GET fallback', async () => {
    const h = createMockSwHarness();
    bindServiceWorkerLifecycle(h.scope, 'honeymoon-2027-v3', ['./index.html']);

    const pendingWaitUntils: Promise<unknown>[] = [];
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
        waitUntil: (p) => {
          pendingWaitUntils.push(p);
        },
        respondWith: (r) => {
          captured.value = r;
        }
      };
      h.listeners.get('fetch')?.(ev);
      const resolved = captured.value ? await captured.value : null;
      await Promise.all(pendingWaitUntils.splice(0));
      return resolved;
    };

    // Non-GET, Range, and cross-origin requests are ignored cleanly
    expect(await dispatchFetch('https://timmatt-lee.github.io/api', { method: 'POST' })).toBeNull();
    expect(
      await dispatchFetch('https://timmatt-lee.github.io/media.mp4', {
        headers: { Range: 'bytes=0-1023' }
      })
    ).toBeNull();
    expect(await dispatchFetch('https://maps.googleapis.com/maps')).toBeNull();

    // Online navigation returns live response WITHOUT poisoning precached shell
    const navOnline = await dispatchFetch(
      'https://timmatt-lee.github.io/00OOhoneymoon2027/?utm_source=line',
      undefined,
      'navigate'
    );
    expect(await navOnline?.text()).toContain('live:');
    expect(h.cacheObj.put).not.toHaveBeenCalled();

    // Offline navigation matches ignoreSearch URL first, then ./index.html, then ./, or throws
    h.store.set(
      'https://timmatt-lee.github.io/00OOhoneymoon2027/',
      new Response('cached-subpath-shell', { status: 200 })
    );
    vi.mocked(h.scope.fetch).mockRejectedValueOnce(new Error('offline'));
    const navOfflineQuery = await dispatchFetch(
      'https://timmatt-lee.github.io/00OOhoneymoon2027/?utm_source=ig',
      undefined,
      'navigate'
    );
    expect(await navOfflineQuery?.text()).toBe('cached-subpath-shell');

    h.store.clear();
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

    // Static assets use CacheFirst, recover when caches.match rejects, and survive QuotaExceededError
    vi.mocked(h.scope.caches.match).mockRejectedValueOnce(
      new DOMException('Private mode blocked', 'SecurityError')
    );
    vi.mocked(h.cacheObj.put).mockRejectedValueOnce(
      new DOMException('Quota full', 'QuotaExceededError')
    );
    const assetQuotaSafe = await dispatchFetch(
      'https://timmatt-lee.github.io/assets/app-quota.js',
      undefined,
      'cors',
      'script'
    );
    expect(await assetQuotaSafe?.text()).toContain('live:');

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

    // Pathname /assets/ fallback when destination is empty string
    const rawAssetPathHit = await dispatchFetch(
      'https://timmatt-lee.github.io/assets/raw-data.bin'
    );
    expect(await rawAssetPathHit?.text()).toContain('live:');

    vi.mocked(h.scope.fetch).mockResolvedValueOnce(new Response('err', { status: 500 }));
    const asset500 = await dispatchFetch(
      'https://timmatt-lee.github.io/assets/bad.js',
      undefined,
      'cors',
      'script'
    );
    expect(asset500?.status).toBe(500);

    // Generic same-origin GET uses NetworkFirst + background tryCachePut + offline fallback
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

  it('swallows DOMException in tryCachePut and wraps unexpected non-DOM errors', async () => {
    const h = createMockSwHarness();

    vi.mocked(h.cacheObj.put).mockRejectedValueOnce(
      new DOMException('Quota exceeded', 'QuotaExceededError')
    );
    await expect(tryCachePut(h.scope, 'c1', './a.js', new Response('ok'))).resolves.toBeUndefined();

    vi.mocked(h.cacheObj.put).mockRejectedValueOnce(new Error('disk hardware fault'));
    await expect(tryCachePut(h.scope, 'c1', './a.js', new Response('ok'))).rejects.toThrow(
      'disk hardware fault'
    );

    vi.mocked(h.cacheObj.put).mockRejectedValueOnce('raw string fault');
    await expect(tryCachePut(h.scope, 'c1', './a.js', new Response('ok'))).rejects.toThrow(
      'raw string fault'
    );
  });

  it('bootstraps only when ServiceWorkerGlobalScope is present on global object', () => {
    const h = createMockSwHarness();
    bootstrapServiceWorkerGlobal({});

    const fakeGlobal = {
      ...h.scope,
      ServiceWorkerGlobalScope: function SwCtor() {}
    };
    bootstrapServiceWorkerGlobal(fakeGlobal);
    expect(h.listeners.has('install')).toBe(true);

    vi.stubGlobal('__SW_CACHE_NAME__', 'honeymoon-2027-injected');
    vi.stubGlobal('__SW_PRECACHE_URLS__', ['./index.html', './manifest.json']);
    bootstrapServiceWorkerGlobal(fakeGlobal);
    vi.unstubAllGlobals();
  });
});
