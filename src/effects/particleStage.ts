import type { DayData } from '../types/schedule';
import { SnowfallEffect } from './snowfallEffect';
import { OnsenSteamEffect } from './onsenSteamEffect';
import { NightGlowEffect } from './nightGlowEffect';

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

  const clampDpr = (): number => Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

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
  let lastFrameTime: number | null = null;
  let isStaticSyncPending = false;

  const checkIsSnowTinted = (dayFloat: number): boolean =>
    snowTintedIndices.some((idx) => Math.abs(dayFloat - idx) < 0.7);

  const checkIsStaticMode = (): boolean => isAutomated || Boolean(reducedMotionQuery?.matches);

  const checkIsInteractionActive = (): boolean =>
    appShell !== null &&
    (appShell.classList.contains('is-swiping') || appShell.classList.contains('is-gliding'));

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
    lastFrameTime = null;
  };

  const tick = (frameNow: number): void => {
    if (document.hidden || checkIsStaticMode() || checkIsInteractionActive()) {
      rafId = null;
      lastFrameTime = null;
      return;
    }
    const dtMs = lastFrameTime === null ? 16.667 : frameNow - lastFrameTime;
    lastFrameTime = frameNow;
    const dtScale = Math.min(2, Math.max(0.25, dtMs / 16.667));
    renderFrame(true, dtScale);
    rafId = requestAnimationFrame(tick);
  };

  const syncLoopState = (): void => {
    if (document.hidden || checkIsInteractionActive()) {
      stopLoop();
      return;
    }
    renderFrame(false);
    if (checkIsStaticMode()) {
      stopLoop();
      return;
    }
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  };

  const scheduleStaticSync = (): void => {
    if (!checkIsStaticMode()) {
      syncLoopState();
      return;
    }
    if (isStaticSyncPending) return;
    isStaticSyncPending = true;
    requestAnimationFrame(() => {
      isStaticSyncPending = false;
      syncLoopState();
    });
  };

  if (appShell !== null) {
    const shellObserver = new MutationObserver(() => {
      syncLoopState();
    });
    shellObserver.observe(appShell, { attributes: true, attributeFilter: ['class'] });
  }

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

  window.addEventListener('hashchange', scheduleStaticSync);
  window.addEventListener('click', scheduleStaticSync);
  window.addEventListener('pointerup', scheduleStaticSync);
  window.addEventListener('keydown', scheduleStaticSync);

  document.addEventListener('visibilitychange', () => {
    syncLoopState();
  });

  syncLoopState();
}
