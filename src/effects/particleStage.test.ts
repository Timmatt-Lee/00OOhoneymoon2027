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

  it('runs a continuous ~60fps (14ms) loop without pausing during .is-moving, caps DPR at 1.25x/1x, and handles hidden & reduced-motion transitions', () => {
    const { daysData } = loadHoneymoonData();
    document.body.innerHTML =
      '<div id="app-shell" class="theme-dark"><canvas id="fx-canvas"></canvas></div>';
    const appShell = document.getElementById('app-shell');
    const rawCanvas = document.getElementById('fx-canvas');
    if (!(appShell instanceof HTMLElement) || !(rawCanvas instanceof HTMLCanvasElement)) {
      throw new Error('Expected #app-shell and #fx-canvas');
    }

    const ctxMock = createCanvasCtxMock();
    vi.spyOn(rawCanvas, 'getContext').mockReturnValue(ctxMock);
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

    // Backing store capped at 1.25x DPR on non-iOS (400 * 1.25 = 500, 844 * 1.25 = 1055)
    expect(rawCanvas.width).toBe(500);
    expect(rawCanvas.height).toBe(1055);
    expect(ctxMock.setTransform).toHaveBeenCalledWith(1.25, 0, 0, 1.25, 0, 0);
    expect(rafCallbacks.size).toBe(1);

    const clearRectSpy = vi.mocked(ctxMock.clearRect);
    clearRectSpy.mockClear();

    // Tick at t = 100 draws; t = 108 (< 14ms) skips drawing on 120Hz odd frame; t = 116 (>= 14ms) draws!
    flushNextRaf(100);
    expect(clearRectSpy).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(1);

    flushNextRaf(108);
    expect(clearRectSpy).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(1);

    flushNextRaf(116);
    expect(clearRectSpy).toHaveBeenCalledTimes(2);
    expect(rafCallbacks.size).toBe(1);

    // Adding .is-moving NEVER pauses #fx-canvas: snow & cross-fades continue advancing at 60fps!
    appShell.classList.add('is-moving');
    dayPos = 4.5;
    flushNextRaf(133);
    expect(clearRectSpy).toHaveBeenCalledTimes(3);
    expect(rafCallbacks.size).toBe(1);

    // Navigation triggers while live loop is active keep single rAF without synchronous snap
    window.dispatchEvent(new Event('click'));
    expect(clearRectSpy).toHaveBeenCalledTimes(3);
    expect(rafCallbacks.size).toBe(1);

    // Live-mode resize repaints immediately with dtScale = 0 (preserving mid-fade envelope) and keeps rAF armed
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
    expect(clearRectSpy).toHaveBeenCalledTimes(4);
    expect(rafCallbacks.size).toBe(1);

    // visibilitychange while already visible & running keeps single rAF without extra draw
    document.dispatchEvent(new Event('visibilitychange'));
    expect(clearRectSpy).toHaveBeenCalledTimes(4);
    expect(rafCallbacks.size).toBe(1);

    // Hidden before tick fires: tick exits cleanly with 0 rAFs
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    flushNextRaf(160);
    expect(rafCallbacks.size).toBe(0);

    // Navigation trigger, resize, and visibilitychange while hidden keep loop stopped
    Reflect.deleteProperty(window, 'CSS');
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true });
    Object.defineProperty(rawCanvas, 'offsetWidth', { value: 0, configurable: true });
    Object.defineProperty(rawCanvas, 'offsetHeight', { value: 0, configurable: true });
    window.dispatchEvent(new Event('pointerup'));
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rawCanvas.width).toBe(400);
    expect(rawCanvas.height).toBe(844);
    expect(rafCallbacks.size).toBe(0);

    // Visible again before visibilitychange: pointerup re-arms rAF immediately
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    window.dispatchEvent(new Event('pointerup'));
    expect(rafCallbacks.size).toBe(1);

    const drawAlphas: number[] = [];
    vi.mocked(ctxMock.drawImage).mockImplementation(() => {
      drawAlphas.push(ctxMock.globalAlpha);
    });

    // Hide via visibilitychange mid-fade + background resize, then unhide preserves exact mid-fade strength (dtScale = 0)
    dayPos = 8; // Jump to Day 9 Night Glow -> 1 live tick puts envelope mid-fade-in (~0.073)
    drawAlphas.length = 0;
    flushNextRaf(220);
    const midFadeInAlphaSum = drawAlphas.reduce((sum, a) => sum + a, 0);
    expect(midFadeInAlphaSum).toBeGreaterThan(0);

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('resize'));
    expect(rafCallbacks.size).toBe(0);

    drawAlphas.length = 0;
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks.size).toBe(1);
    const unhideAlphaSum = drawAlphas.reduce((sum, a) => sum + a, 0);
    expect(unhideAlphaSum).toBeCloseTo(midFadeInAlphaSum, 10);

    // Toggling prefers-reduced-motion mid-fade AT THE SAME dayPos (8) stops rAF and snaps immediately to steady state!
    clearRectSpy.mockClear();
    drawAlphas.length = 0;
    isReducedMotion = true;
    for (const notify of motionListeners) notify();
    expect(rafCallbacks.size).toBe(0);
    expect(clearRectSpy).toHaveBeenCalledTimes(1);
    const snappedSteadyAlphaSum = drawAlphas.reduce((sum, a) => sum + a, 0);
    expect(snappedSteadyAlphaSum).toBeGreaterThan(midFadeInAlphaSum * 5);

    // Subsequent static trigger at unchanged dayPos (8) hits lastRenderedDay cache; changed dayPos via pointercancel redraws
    window.dispatchEvent(new Event('hashchange'));
    expect(clearRectSpy).toHaveBeenCalledTimes(1);
    dayPos = 10;
    window.dispatchEvent(new Event('pointercancel'));
    expect(clearRectSpy).toHaveBeenCalledTimes(2);
    expect(rafCallbacks.size).toBe(0);
    window.dispatchEvent(new Event('pointercancel'));
    expect(clearRectSpy).toHaveBeenCalledTimes(2);
  });

  it('supports ?fx=live under navigator.webdriver and polls animated glides to integer settle in default webdriver static mode', () => {
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

    // 1. Default webdriver mode (no ?fx=live): 0 idle rAFs on load, polls animated glide until settled integer!
    let dayPos = 0;
    startParticleStage(daysData, () => dayPos, { search: '' });
    expect(ctxMock.clearRect).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(0);

    // Simulate tap starting a glide: at pointerup dayPos is still 0, then glides 0 -> 0.5 -> 1 -> 1 (settle)
    window.dispatchEvent(new Event('pointerup'));
    expect(rafCallbacks.size).toBe(1);
    // Duplicate trigger while static poll rAF is already queued does not queue a second rAF
    window.dispatchEvent(new Event('keydown'));
    expect(rafCallbacks.size).toBe(1);

    dayPos = 0.5;
    flushNextRaf(16);
    expect(rafCallbacks.size).toBe(1);

    // Held at 0.5 (non-integer): keeps polling
    flushNextRaf(32);
    expect(rafCallbacks.size).toBe(1);

    // Reaches integer 1: draws Day 2 and schedules 1 settle confirmation check, then stops at 0 rAFs!
    dayPos = 1;
    flushNextRaf(48);
    expect(rafCallbacks.size).toBe(1);
    flushNextRaf(64);
    expect(rafCallbacks.size).toBe(0);

    // If document becomes hidden before pollStaticSettle runs, exits cleanly with 0 rAFs
    window.dispatchEvent(new Event('pointerup'));
    expect(rafCallbacks.size).toBe(1);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    flushNextRaf(80);
    expect(rafCallbacks.size).toBe(0);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });

    // 2. Forced live mode (?fx=live) under navigator.webdriver: runs full live 60fps loop!
    document.body.innerHTML = '<canvas id="fx-canvas"></canvas>';
    const liveCanvas = document.getElementById('fx-canvas');
    if (!(liveCanvas instanceof HTMLCanvasElement)) {
      throw new Error('Expected live HTMLCanvasElement');
    }
    const liveCtxMock = createCanvasCtxMock();
    vi.spyOn(liveCanvas, 'getContext').mockReturnValue(liveCtxMock);

    startParticleStage(daysData, () => 8, { search: '?fx=live' });
    expect(rafCallbacks.size).toBe(1);
    flushNextRaf(100);
    expect(liveCtxMock.clearRect).toHaveBeenCalledTimes(2);
    expect(rafCallbacks.size).toBe(1);
  });
});
