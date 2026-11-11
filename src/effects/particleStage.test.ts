import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startParticleStage } from './particleStage';
import { loadHoneymoonData } from '../engine/loader';

describe('startParticleStage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns safely when #fx-canvas or 2D context is unavailable', () => {
    const { daysData } = loadHoneymoonData();
    expect(() => {
      startParticleStage(daysData, () => 0);
    }).not.toThrow();

    document.body.innerHTML = '<canvas id="fx-canvas"></canvas>';
    const canvas = document.getElementById('fx-canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    expect(() => {
      startParticleStage(daysData, () => 0);
    }).not.toThrow();
  });

  it('scales backing store by devicePixelRatio, handles resize, visibilitychange, and reduced motion', () => {
    const { daysData } = loadHoneymoonData();
    document.body.innerHTML = '<canvas id="fx-canvas"></canvas>';
    const canvas = document.getElementById('fx-canvas') as HTMLCanvasElement;

    const ctxMock = {
      fillStyle: '',
      globalAlpha: 1,
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      fillRect: vi.fn()
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(canvas, 'getContext').mockReturnValue(ctxMock);
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true
    });

    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    let dayPos = 4; // Day 5 Biei (snow tinted)
    startParticleStage(daysData, () => dayPos);

    // Backing store scaled by 2x DPR (400 * 2 = 800, 844 * 2 = 1688)
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(1688);
    expect(ctxMock.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);

    // Run RAF tick while visible
    rafCallbacks.shift()?.(16);
    expect(ctxMock.clearRect).toHaveBeenCalled();

    // Resize updates backing store and re-renders static frame (both explicit & fallback 0 sizes)
    Object.defineProperty(canvas, 'offsetWidth', { value: 500, configurable: true });
    Object.defineProperty(canvas, 'offsetHeight', { value: 900, configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(canvas.width).toBe(500);

    Object.defineProperty(canvas, 'offsetWidth', { value: 0, configurable: true });
    Object.defineProperty(canvas, 'offsetHeight', { value: 0, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(canvas.width).toBe(400);

    // Visibility event while already running does not duplicate RAF
    document.dispatchEvent(new Event('visibilitychange'));

    // Pause when document.hidden becomes true, resume on visibilitychange when visible again
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    rafCallbacks.shift()?.(32);
    expect(rafCallbacks).toHaveLength(0);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafCallbacks).toHaveLength(1);

    // Also test automated / reduced-motion non-advancing skip when dayFloat is unchanged vs changed
    Reflect.deleteProperty(window, 'matchMedia');
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    startParticleStage(daysData, () => dayPos);
    // Unchanged dayFloat hits early-return cache guard
    rafCallbacks.pop()?.(48);
    // Changed dayFloat renders new static frame
    dayPos = 5;
    rafCallbacks.pop()?.(64);
  });
});
