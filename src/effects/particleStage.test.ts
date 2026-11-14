import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startParticleStage } from './particleStage';
import { loadHoneymoonData } from '../engine/loader';

function createCanvasCtxMock(): CanvasRenderingContext2D {
  return {
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
}

describe('startParticleStage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    Object.defineProperty(window, 'CSS', {
      value: {
        supports: vi.fn(() => false)
      },
      configurable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns safely when #fx-canvas is missing, non-canvas, or lacks a 2D context', () => {
    const { daysData } = loadHoneymoonData();
    expect(() => {
      startParticleStage(daysData, () => 0);
    }).not.toThrow();

    document.body.innerHTML = '<div id="fx-canvas"></div>';
    expect(() => {
      startParticleStage(daysData, () => 0);
    }).not.toThrow();

    document.body.innerHTML = '<canvas id="fx-canvas"></canvas>';
    const rawCanvas = document.getElementById('fx-canvas');
    if (!(rawCanvas instanceof HTMLCanvasElement)) {
      throw new Error('Expected HTMLCanvasElement');
    }
    vi.spyOn(rawCanvas, 'getContext').mockReturnValue(null);
    expect(() => {
      startParticleStage(daysData, () => 0);
    }).not.toThrow();
  });

  it('caps DPR at 2x on non-iOS and 1x on iOS WebKit, throttles ambient ticks to ~30fps, skips drawing while .is-moving, and handles reduced-motion transitions', () => {
    const { daysData } = loadHoneymoonData();
    document.body.innerHTML = '<div id="app-shell"><canvas id="fx-canvas"></canvas></div>';
    const appShell = document.getElementById('app-shell');
    const rawCanvas = document.getElementById('fx-canvas');
    if (!(appShell instanceof HTMLElement) || !(rawCanvas instanceof HTMLCanvasElement)) {
      throw new Error('Expected #app-shell and #fx-canvas');
    }

    const ctxMock = createCanvasCtxMock();
    vi.spyOn(rawCanvas, 'getContext').mockReturnValue(ctxMock);

    // 3x Retina DPR must be capped at 2x on non-iOS browsers
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });

    let isReducedMotion = false;
    const motionListeners: Array<() => void> = [];
    const mockMql = {
      addEventListener: (_event: string, cb: () => void) => {
        motionListeners.push(cb);
      }
    };
    Object.defineProperty(mockMql, 'matches', {
      get: () => isReducedMotion,
      configurable: true
    });
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => mockMql),
      configurable: true
    });

    const rafCallbacks = new Map<number, FrameRequestCallback>();
    let nextRafId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id);
    });

    const flushNextRaf = (timestamp: number): void => {
      const firstEntry = rafCallbacks.entries().next().value;
      if (!firstEntry) return;
      const [id, cb] = firstEntry;
      rafCallbacks.delete(id);
      cb(timestamp);
    };

    let dayPos = 4; // Day 5 Biei (snow tinted)
    startParticleStage(daysData, () => dayPos);

    // Backing store capped at 2x DPR on non-iOS (400 * 2 = 800, 844 * 2 = 1688)
    expect(rawCanvas.width).toBe(800);
    expect(rawCanvas.height).toBe(1688);
    expect(ctxMock.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(rafCallbacks.size).toBe(1);

    const clearRectSpy = vi.mocked(ctxMock.clearRect);
    clearRectSpy.mockClear();

    // Tick at t = 100 draws initial ambient frame; t = 116 (< 30ms) skips drawing while keeping rafId scheduled; t = 135 (>= 30ms) draws
    flushNextRaf(100);
    expect(clearRectSpy).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(1);

    flushNextRaf(116);
    expect(clearRectSpy).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(1);

    flushNextRaf(135);
    expect(clearRectSpy).toHaveBeenCalledTimes(2);
    expect(rafCallbacks.size).toBe(1);

    // Dispatch click while animated (loop stays single-scheduled with zero synchronous redraw)
    window.dispatchEvent(new Event('click'));
    expect(clearRectSpy).toHaveBeenCalledTimes(2);
    expect(rafCallbacks.size).toBe(1);

    // Adding .is-moving passively skips canvas drawing inside tick without MutationObserver microtasks
    appShell.classList.add('is-moving');
    flushNextRaf(170);
    expect(clearRectSpy).toHaveBeenCalledTimes(2);
    expect(rafCallbacks.size).toBe(1);

    // Resize while .is-moving skips renderFrame(false) cleanly
    window.dispatchEvent(new Event('resize'));
    expect(clearRectSpy).toHaveBeenCalledTimes(2);

    // Removing .is-moving resumes drawing on the very next tick
    dayPos = 5;
    appShell.classList.remove('is-moving');
    flushNextRaf(210);
    expect(clearRectSpy).toHaveBeenCalledTimes(3);
    expect(rafCallbacks.size).toBe(1);

    // If document.hidden flips before visibilitychange fires, tick exits cleanly without rescheduling
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    flushNextRaf(250);
    expect(rafCallbacks.size).toBe(0);

    // Navigation trigger while hidden does not re-arm rAF
    window.dispatchEvent(new Event('pointerup'));
    expect(rafCallbacks.size).toBe(0);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks.size).toBe(0);

    // Visible again before visibilitychange: pointerup re-arms rAF immediately
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    window.dispatchEvent(new Event('pointerup'));
    expect(rafCallbacks.size).toBe(1);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks.size).toBe(1);

    // iOS WebKit (-webkit-touch-callout: none) caps DPR at 1x even on 3x Retina (500 * 1 = 500, 900 * 1 = 900)
    Object.defineProperty(window, 'CSS', {
      value: {
        supports: vi.fn(
          (prop: string, val: string) => prop === '-webkit-touch-callout' && val === 'none'
        )
      },
      configurable: true
    });
    Object.defineProperty(rawCanvas, 'offsetWidth', { value: 500, configurable: true });
    Object.defineProperty(rawCanvas, 'offsetHeight', { value: 900, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(rawCanvas.width).toBe(500);
    expect(rawCanvas.height).toBe(900);

    // Resize also handles missing window.CSS, 0 DPR fallback, and 0 offsetWidth/offsetHeight fallbacks
    Reflect.deleteProperty(window, 'CSS');
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true });
    Object.defineProperty(rawCanvas, 'offsetWidth', { value: 0, configurable: true });
    Object.defineProperty(rawCanvas, 'offsetHeight', { value: 0, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(rawCanvas.width).toBe(400);
    expect(rawCanvas.height).toBe(844);

    // Dynamic prefers-reduced-motion toggle stops continuous loop immediately
    isReducedMotion = true;
    for (const notify of motionListeners) notify();
    expect(rafCallbacks.size).toBe(0);

    // Static sync waits if .is-moving is active, coalesces duplicate triggers, then renders settled frame once
    dayPos = 9;
    appShell.classList.add('is-moving');
    window.dispatchEvent(new Event('pointerup'));
    window.dispatchEvent(new Event('keydown'));
    expect(rafCallbacks.size).toBe(1);

    flushNextRaf(300);
    expect(rafCallbacks.size).toBe(1);

    appShell.classList.remove('is-moving');
    flushNextRaf(330);
    expect(rafCallbacks.size).toBe(0);

    // Unchanged dayFloat in static mode hits early-return cache guard
    window.dispatchEvent(new Event('hashchange'));
    flushNextRaf(360);
    expect(rafCallbacks.size).toBe(0);
  });

  it('spins zero idle rAF loop under navigator.webdriver and tolerates missing #app-shell or matchMedia', () => {
    const { daysData } = loadHoneymoonData();
    document.body.innerHTML = '<canvas id="fx-canvas"></canvas>';
    const rawCanvas = document.getElementById('fx-canvas');
    if (!(rawCanvas instanceof HTMLCanvasElement)) {
      throw new Error('Expected HTMLCanvasElement');
    }
    const ctxMock = createCanvasCtxMock();
    vi.spyOn(rawCanvas, 'getContext').mockReturnValue(ctxMock);

    Reflect.deleteProperty(window, 'matchMedia');
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);

    startParticleStage(daysData, () => 0);

    // Renders initial static frame once and schedules ZERO continuous rAF ticks!
    expect(ctxMock.clearRect).toHaveBeenCalledTimes(1);
    expect(rafSpy).not.toHaveBeenCalled();
  });
});
