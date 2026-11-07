import { SnowfallEffect } from './snowfallEffect';
import { OnsenSteamEffect } from './onsenSteamEffect';
import { NightGlowEffect } from './nightGlowEffect';

export function startParticleStage(getDayFloat: () => number): void {
  const canvas = document.getElementById('fx-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w = (canvas.width = canvas.offsetWidth || 400);
  let h = (canvas.height = canvas.offsetHeight || 844);

  window.addEventListener('resize', () => {
    w = canvas.width = canvas.offsetWidth || 400;
    h = canvas.height = canvas.offsetHeight || 844;
  });

  const snowfall = new SnowfallEffect(44, w, h);
  const onsenSteam = new OnsenSteamEffect(18);
  const nightGlow = new NightGlowEffect(12);
  const isAutomated = Boolean(navigator.webdriver);
  let lastRenderedDay = -999;
  let rafId: number | null = null;

  const renderFrame = (advance: boolean): void => {
    const dayFloat = getDayFloat();
    if (!advance && dayFloat === lastRenderedDay) return;
    lastRenderedDay = dayFloat;
    ctx.clearRect(0, 0, w, h);
    snowfall.render(ctx, w, h, dayFloat, advance);
    onsenSteam.render(ctx, w, h, dayFloat, advance);
    nightGlow.render(ctx, w, h, dayFloat, advance);
  };

  const tick = (): void => {
    if (document.hidden) {
      rafId = null;
      return;
    }
    renderFrame(!isAutomated);
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
