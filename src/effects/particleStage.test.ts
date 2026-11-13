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

  it('caps DPR at 2x, pauses during .is-swiping/.is-gliding, scales dt, and handles reduced-motion transitions', async () => {
    const { daysData } = loadHoneymoonData();
    document.body.innerHTML = '<div id="app-shell"><canvas id="fx-canvas"></canvas></div>';
    const appShell = document.getElementById('app-shell');
    const rawCanvas = document.getElementById('fx-canvas');
    if (!(appShell instanceof HTMLElement) || !(rawCanvas instanceof HTMLCanvasElement)) {
      throw new Error('Expected #app-shell and #fx-canvas');
    }

    const ctxMock = createCanvasCtxMock();
    vi.spyOn(rawCanvas, 'getContext').mockReturnValue(ctxMock);

    // 3x Retina DPR must be capped at 2x
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });

    let isReducedMotion = false;
    const motionListeners: Array<() => void> = [];
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        get matches(): boolean {
          return isReducedMotion;
        },
        addEventListener: (_event: string, cb: () => void) => {
          motionListeners.push(cb);
        }
      })),
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

    // Backing store capped at 2x DPR (400 * 2 = 800, 844 * 2 = 1688)
    expect(rawCanvas.width).toBe(800);
    expect(rawCanvas.height).toBe(1688);
    expect(ctxMock.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(rafCallbacks.size).toBe(1);

    // Run ticks covering initial dt, normal 60Hz dt, slow 30Hz dt clamp (2x), and fast >240Hz dt clamp (0.25x)
    flushNextRaf(100);
    flushNextRaf(116.667);
    flushNextRaf(200);
    flushNextRaf(201);
    expect(rafCallbacks.size).toBe(1);

    // Dispatch click while animated (loop stays single-scheduled)
    window.dispatchEvent(new Event('click'));
    expect(rafCallbacks.size).toBe(1);

    // Adding .is-swiping pauses rAF immediately via MutationObserver
    appShell.classList.add('is-swiping');
    await Promise.resolve();
    expect(rafCallbacks.size).toBe(0);

    // Switching to .is-gliding keeps rAF paused
    appShell.classList.remove('is-swiping');
    appShell.classList.add('is-gliding');
    await Promise.resolve();
    expect(rafCallbacks.size).toBe(0);

    // Clearing .is-gliding resumes rAF smoothly
    dayPos = 5;
    appShell.classList.remove('is-gliding');
    await Promise.resolve();
    expect(rafCallbacks.size).toBe(1);

    // If document.hidden flips before visibilitychange fires, tick exits cleanly without rescheduling
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    flushNextRaf(240);
    expect(rafCallbacks.size).toBe(0);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks.size).toBe(0);

    // Visible again -> resumes rAF
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks.size).toBe(1);

    // Resize updates backing store (including 0 fallback & 0 DPR fallback) and re-renders
    Object.defineProperty(rawCanvas, 'offsetWidth', { value: 500, configurable: true });
    Object.defineProperty(rawCanvas, 'offsetHeight', { value: 900, configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(rawCanvas.width).toBe(500);

    Object.defineProperty(rawCanvas, 'offsetWidth', { value: 0, configurable: true });
    Object.defineProperty(rawCanvas, 'offsetHeight', { value: 0, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(rawCanvas.width).toBe(400);

    // Dynamic prefers-reduced-motion toggle stops continuous loop immediately
    isReducedMotion = true;
    for (const notify of motionListeners) notify();
    expect(rafCallbacks.size).toBe(0);

    // Coalesces multiple navigation events into a single static rAF sync
    dayPos = 9;
    window.dispatchEvent(new Event('pointerup'));
    window.dispatchEvent(new Event('click'));
    expect(rafCallbacks.size).toBe(1);
    flushNextRaf(300);
    expect(rafCallbacks.size).toBe(0);

    // Unchanged dayFloat in static mode hits early-return cache guard
    window.dispatchEvent(new Event('hashchange'));
    flushNextRaf(316);
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
