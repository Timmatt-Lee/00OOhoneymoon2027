export interface ExtendableEventLike {
  waitUntil(promise: Promise<unknown>): void;
}

export interface FetchEventLike extends ExtendableEventLike {
  readonly request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

export interface SwCacheLike {
  addAll(urls: readonly string[]): Promise<void>;
  match(request: Request | string, options?: MultiCacheQueryOptions): Promise<Response | undefined>;
  put(request: Request | string, response: Response): Promise<void>;
}

export interface SwCacheStorageLike {
  open(cacheName: string): Promise<SwCacheLike>;
  keys(): Promise<string[]>;
  delete(cacheName: string): Promise<boolean>;
  match(request: Request | string, options?: MultiCacheQueryOptions): Promise<Response | undefined>;
}

export interface ServiceWorkerScopeLike {
  readonly location: { readonly origin: string };
  readonly caches: SwCacheStorageLike;
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  fetch(input: Request): Promise<Response>;
  addEventListener(
    type: 'install' | 'activate',
    listener: (event: ExtendableEventLike) => void
  ): void;
  addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
}

declare const __SW_CACHE_NAME__: string | undefined;
declare const __SW_PRECACHE_URLS__: readonly string[] | undefined;

const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image', 'manifest']);

export function bindServiceWorkerLifecycle(
  scope: ServiceWorkerScopeLike,
  cacheName: string,
  precacheUrls: readonly string[]
): void {
  scope.addEventListener('install', (event: ExtendableEventLike) => {
    event.waitUntil(
      scope.caches
        .open(cacheName)
        .then((cache) => cache.addAll(precacheUrls))
        .then(() => scope.skipWaiting())
    );
  });

  scope.addEventListener('activate', (event: ExtendableEventLike) => {
    event.waitUntil(
      scope.caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((key) => key !== cacheName).map((staleKey) => scope.caches.delete(staleKey))
          )
        )
        .then(() => scope.clients.claim())
    );
  });

  scope.addEventListener('fetch', (event: FetchEventLike) => {
    const req = event.request;
    const isGetRequest = req.method === 'GET';
    if (!isGetRequest) return;

    const reqUrl = new URL(req.url);
    const isSameOrigin = reqUrl.origin === scope.location.origin;
    if (!isSameOrigin) return;

    const isNavigation = req.mode === 'navigate';
    if (isNavigation) {
      // NetworkFirst for HTML documents, falling back to precached shell when offline
      event.respondWith(
        scope
          .fetch(req)
          .then(async (networkRes) => {
            if (networkRes.status === 200) {
              const cache = await scope.caches.open(cacheName);
              await cache.put(req, networkRes.clone());
            }
            return networkRes;
          })
          .catch(async () => {
            const cachedDoc =
              (await scope.caches.match(req, { ignoreVary: true })) ??
              (await scope.caches.match('./index.html', { ignoreVary: true })) ??
              (await scope.caches.match('./', { ignoreVary: true }));
            if (cachedDoc) return cachedDoc;
            throw new Error('Offline and no cached application shell available.');
          })
      );
      return;
    }

    const isStaticAsset =
      STATIC_DESTINATIONS.has(req.destination) || reqUrl.pathname.includes('/assets/');
    if (isStaticAsset) {
      // CacheFirst for versioned bundles, fonts, and icons (ignoreVary handles CORS Vary: Origin)
      event.respondWith(
        scope.caches.match(req, { ignoreVary: true }).then(async (cached) => {
          if (cached) return cached;
          const networkRes = await scope.fetch(req);
          if (networkRes.status === 200) {
            const cache = await scope.caches.open(cacheName);
            await cache.put(req, networkRes.clone());
          }
          return networkRes;
        })
      );
      return;
    }

    // NetworkFirst with cache fallback for remaining same-origin GET resources
    event.respondWith(
      scope
        .fetch(req)
        .then(async (networkRes) => {
          if (networkRes.status === 200) {
            const cache = await scope.caches.open(cacheName);
            await cache.put(req, networkRes.clone());
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await scope.caches.match(req, { ignoreVary: true });
          if (cached) return cached;
          throw new Error(`Offline cache miss for ${req.url}`);
        })
    );
  });
}

export function bootstrapServiceWorkerGlobal(globalObj: object): void {
  const isSwRuntime = 'ServiceWorkerGlobalScope' in globalObj;
  if (!isSwRuntime) return;
  const resolvedCacheName =
    typeof __SW_CACHE_NAME__ === 'string' ? __SW_CACHE_NAME__ : 'honeymoon-2027-v3';
  const resolvedUrls = typeof __SW_PRECACHE_URLS__ !== 'undefined' ? __SW_PRECACHE_URLS__ : ['./'];
  bindServiceWorkerLifecycle(
    globalObj as unknown as ServiceWorkerScopeLike,
    resolvedCacheName,
    resolvedUrls
  );
}

bootstrapServiceWorkerGlobal(globalThis);
