export interface SwLocationLike {
  readonly hostname: string;
  readonly search: string;
}

export interface SwRegisterOptions {
  readonly updateViaCache?: 'all' | 'imports' | 'none';
}

export interface SwRegistrationLike {
  update?: () => Promise<unknown>;
}

export interface SwNavigatorLike {
  readonly serviceWorker?: {
    register(scriptURL: string, options?: SwRegisterOptions): Promise<SwRegistrationLike>;
  };
}

function defaultReportSwError(error: Error): void {
  console.warn('[PWA] Service Worker registration failed:', error.message);
}

export function registerOfflineServiceWorker(
  win: Pick<Window, 'addEventListener'> = window,
  nav: SwNavigatorLike = navigator,
  loc: SwLocationLike = window.location,
  onRegisterError: (error: Error) => void = defaultReportSwError,
  doc: Pick<Document, 'hidden' | 'addEventListener'> = document
): void {
  const isSwSupported = Boolean(nav.serviceWorker);
  if (!isSwSupported || !nav.serviceWorker) return;

  const isLocalhost = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  const isForcedByQuery = new URLSearchParams(loc.search).get('sw') === '1';
  if (isLocalhost && !isForcedByQuery) return;

  const swContainer = nav.serviceWorker;
  win.addEventListener('load', () => {
    swContainer
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        doc.addEventListener('visibilitychange', () => {
          if (!doc.hidden) {
            void reg.update?.().catch(() => undefined);
          }
        });
      })
      .catch((err: unknown) => {
        const normalized = err instanceof Error ? err : new Error(String(err));
        onRegisterError(normalized);
      });
  });
}
