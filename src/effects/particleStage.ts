import type { DayData } from '../types/schedule';
import { SnowfallEffect } from './snowfallEffect';
import { OnsenSteamEffect } from './onsenSteamEffect';
import { NightGlowEffect } from './nightGlowEffect';

export function startParticleStage(daysData: readonly DayData[], getDayFloat: () => number): void {
  const canvas = document.getElementById('fx-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const snowTintedIndices = daysData
    .map((d, idx) => (d.isSnowTinted ? idx : -1))
    .filter((idx) => idx >= 0);
  const onsenSteamIndices = daysData
    .map((d, idx) => (d.isOnsenSteam ? idx : -1))
    .filter((idx) => idx >= 0);
  const nightGlowIndices = daysData
    .map((d, idx) => (d.isNightGlow ? idx : -1))
    .filter((idx) => idx >= 0);

  let cssWidth = canvas.offsetWidth || 400;
  let cssHeight = canvas.offsetHeight || 844;
  let dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);

  const syncCanvasBackingStore = (): void => {
    dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  syncCanvasBackingStore();

  const snowfall = new SnowfallEffect(44, cssWidth, cssHeight);
  const onsenSteam = new OnsenSteamEffect(18, onsenSteamIndices);
  const nightGlow = new NightGlowEffect(12, nightGlowIndices);

  const isAutomated = navigator.webdriver;
  const reducedMotionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  let lastRenderedDay = -999;
  let rafId: number | null = null;

  const checkIsSnowTinted = (dayFloat: number): boolean =>
    snowTintedIndices.some((idx) => Math.abs(dayFloat - idx) < 0.7);

  const renderFrame = (isAdvancing: boolean): void => {
    const dayFloat = getDayFloat();
    if (!isAdvancing && dayFloat === lastRenderedDay) return;
    lastRenderedDay = dayFloat;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    snowfall.render(ctx, cssWidth, cssHeight, checkIsSnowTinted(dayFloat), isAdvancing);
    onsenSteam.render(ctx, cssWidth, cssHeight, dayFloat, isAdvancing);
    nightGlow.render(ctx, cssWidth, cssHeight, dayFloat, isAdvancing);
  };

  window.addEventListener('resize', () => {
    cssWidth = canvas.offsetWidth || 400;
    cssHeight = canvas.offsetHeight || 844;
    syncCanvasBackingStore();
    snowfall.resize(cssWidth, cssHeight);
    lastRenderedDay = -999;
    renderFrame(false);
  });

  const tick = (): void => {
    if (document.hidden) {
      rafId = null;
      return;
    }
    const isReducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;
    renderFrame(!isAutomated && !isReducedMotion);
    rafId = requestAnimationFrame(tick);
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  });

  renderFrame(false);
  rafId = requestAnimationFrame(tick);
}
