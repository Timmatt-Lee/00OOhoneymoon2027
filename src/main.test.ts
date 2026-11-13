import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bootstrap, initWhenReady, onServiceWorkerRegisterError } from './main';

const STAGE_HTML = `
  <meta id="theme-color-meta" content="#070B19" />
  <div id="app-shell" class="theme-dark">
    <div id="sky-stack"></div>
    <canvas id="fx-canvas"></canvas>
    <div id="stage-frame">
      <header id="top-header"><nav id="story-bar-track"></nav></header>
      <div id="day-live-status"></div>
      <div id="timeline-rail"><div id="timeline-line"></div><div id="timeline-nodes-container"></div></div>
      <main id="schedule-stage"></main>
    </div>
    <footer id="cityscape-footer">
      <div id="scene-groups-container"></div>
      <div id="snow-ground-slot"></div>
      <a id="cityscape-map-link" href="#"></a>
    </footer>
  </div>
`;

describe('application bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = STAGE_HTML;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('bootstraps immediately when DOM is ready, defers when loading, and logs SW registration warnings', () => {
    const mockCtx = {
      fillStyle: '',
      globalAlpha: 1,
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      fillRect: vi.fn()
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => mockCtx);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);

    initWhenReady({ readyState: 'complete' }, window);
    expect(document.querySelectorAll('.story-slot')).toHaveLength(12);

    // Invoke particle-stage day callback by triggering a resize frame
    window.dispatchEvent(new Event('resize'));

    const addListenerSpy = vi.fn();
    initWhenReady({ readyState: 'loading' }, { addEventListener: addListenerSpy });
    expect(addListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', bootstrap);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onServiceWorkerRegisterError(new Error('SW blocked in WebView'));
    expect(warnSpy).toHaveBeenCalledWith(
      '[PWA] Service worker registration skipped:',
      'SW blocked in WebView'
    );
  });

  it('auto-initializes on module import only when document and #app-shell exist', async () => {
    // 1. Mounted #app-shell -> auto-runs initWhenReady() with default arguments
    document.body.innerHTML = STAGE_HTML;
    vi.resetModules();
    await import('./main');
    expect(document.querySelectorAll('.story-slot')).toHaveLength(12);

    // 2. Empty document.body (no #app-shell) -> skips auto-init
    document.body.innerHTML = '';
    vi.resetModules();
    await import('./main');
    expect(document.querySelectorAll('.story-slot')).toHaveLength(0);

    // 3. SSR / non-DOM environment where global document is undefined -> skips auto-init
    vi.stubGlobal('document', undefined);
    vi.resetModules();
    await import('./main');
  });
});
