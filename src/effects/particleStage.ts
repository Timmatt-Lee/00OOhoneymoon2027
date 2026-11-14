import type { DayData } from '../types/schedule';
import { SnowfallEffect } from './snowfallEffect';
import { OnsenSteamEffect } from './onsenSteamEffect';
import { NightGlowEffect } from './nightGlowEffect';

const AMBIENT_FRAME_MIN_INTERVAL_MS = 30;

export function startParticleStage(daysData: readonly DayData[], getDayFloat: () => number): void {
  const rawCanvas = document.getElementById('fx-canvas');
  if (!(rawCanvas instanceof HTMLCanvasElement)) return;
  const canvas = rawCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const appShell = document.getElementById('app-shell');

  const snowTintedIndices = daysData
    .map((d, idx) => (d.isSnowTinted ? idx : -1))
    .filter((idx) => idx >= 0);
  const onsenSteamIndices = daysData
    .map((d, idx) => (d.isOnsenSteam ? idx : -1))
    .filter((idx) => idx >= 0);
  const nightGlowIndices = daysData
    .map((d, idx) => (d.isNightGlow ? idx : -1))
    .filter((idx) => idx >= 0);

  const checkIsIosWebKit = (): boolean =>
    typeof window.CSS !== 'undefined' &&
    typeof window.CSS.supports === 'function' &&
    window.CSS.supports('-webkit-touch-callout', 'none');

  const clampDpr = (): number => {
    const maxDpr = checkIsIosWebKit() ? 1 : 2;
    return Math.min(Math.max(window.devicePixelRatio || 1, 1), maxDpr);
  };

  let cssWidth = canvas.offsetWidth || 400;
  let cssHeight = canvas.offsetHeight || 844;
  let dpr = clampDpr();

  const snowfall = new SnowfallEffect(44, cssWidth, cssHeight);
  const onsenSteam = new OnsenSteamEffect(18, onsenSteamIndices, dpr);
  const nightGlow = new NightGlowEffect(12, nightGlowIndices, dpr);

  const syncCanvasBackingStore = (): void => {
    dpr = clampDpr();
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onsenSteam.setDpr(dpr);
    nightGlow.setDpr(dpr);
  };
  syncCanvasBackingStore();

  const isAutomated = navigator.webdriver;
  const reducedMotionQuery: Partial<MediaQueryList> | null =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  let lastRenderedDay = -999;
  let rafId: number | null = null;
  let lastDrawTime: number | null = null;
  let isStaticSyncPending = false;

  const checkIsSnowTinted = (dayFloat: number): boolean =>
    snowTintedIndices.some((idx) => Math.abs(dayFloat - idx) < 0.7);

  const checkIsStaticMode = (): boolean => isAutomated || Boolean(reducedMotionQuery?.matches);

  const checkIsMoving = (): boolean =>
    appShell !== null && appShell.classList.contains('is-moving');

  const renderFrame = (isAdvancing: boolean, dtScale = 1): void => {
    const dayFloat = getDayFloat();
    if (!isAdvancing && dayFloat === lastRenderedDay) return;
    lastRenderedDay = dayFloat;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    snowfall.render(ctx, cssWidth, cssHeight, checkIsSnowTinted(dayFloat), isAdvancing, dtScale);
    onsenSteam.render(ctx, cssWidth, cssHeight, dayFloat, isAdvancing, dtScale);
    nightGlow.render(ctx, cssWidth, cssHeight, dayFloat, isAdvancing, dtScale);
  };

  const stopLoop = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastDrawTime = null;
  };

  const tick = (frameNow: number): void => {
    if (document.hidden || checkIsStaticMode()) {
      rafId = null;
      lastDrawTime = null;
      return;
    }
    if (checkIsMoving()) {
      lastDrawTime = null;
      rafId = requestAnimationFrame(tick);
      return;
    }
    if (lastDrawTime !== null && frameNow - lastDrawTime < AMBIENT_FRAME_MIN_INTERVAL_MS) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    const dtMs = lastDrawTime === null ? 16.667 : frameNow - lastDrawTime;
    lastDrawTime = frameNow;
    const dtScale = Math.min(2, Math.max(0.25, dtMs / 16.667));
    renderFrame(true, dtScale);
    rafId = requestAnimationFrame(tick);
  };

  const syncLoopState = (): void => {
    if (document.hidden) {
      stopLoop();
      return;
    }
    if (!checkIsMoving()) {
      renderFrame(false);
    }
    if (checkIsStaticMode()) {
      stopLoop();
      return;
    }
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  };

  const runDeferredStaticSync = (): void => {
    if (checkIsMoving()) {
      requestAnimationFrame(runDeferredStaticSync);
      return;
    }
    isStaticSyncPending = false;
    syncLoopState();
  };

  const onNavigationTrigger = (): void => {
    if (!checkIsStaticMode()) {
      if (!document.hidden && rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
      return;
    }
    if (isStaticSyncPending) return;
    isStaticSyncPending = true;
    requestAnimationFrame(runDeferredStaticSync);
  };

  if (typeof reducedMotionQuery?.addEventListener === 'function') {
    reducedMotionQuery.addEventListener('change', () => {
      syncLoopState();
    });
  }

  window.addEventListener('resize', () => {
    cssWidth = canvas.offsetWidth || 400;
    cssHeight = canvas.offsetHeight || 844;
    syncCanvasBackingStore();
    snowfall.resize(cssWidth, cssHeight);
    lastRenderedDay = -999;
    syncLoopState();
  });

  window.addEventListener('hashchange', onNavigationTrigger);
  window.addEventListener('click', onNavigationTrigger);
  window.addEventListener('pointerup', onNavigationTrigger);
  window.addEventListener('keydown', onNavigationTrigger);

  document.addEventListener('visibilitychange', () => {
    syncLoopState();
  });

  syncLoopState();
}
