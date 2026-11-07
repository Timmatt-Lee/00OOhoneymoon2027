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
  const onsenSteam = new OnsenSteamEffect(15);
  const nightGlow = new NightGlowEffect(12);
  let rafId: number | null = null;

  const renderFrame = (): void => {
    ctx.clearRect(0, 0, w, h);
    const dayFloat = getDayFloat();
    snowfall.render(ctx, w, h, dayFloat);
    onsenSteam.render(ctx, w, h, dayFloat);
    nightGlow.render(ctx, w, h, dayFloat);
  };

  // In automated headless E2E tests (navigator.webdriver), freeze after 1 deterministic frame so screenshots are 100% reproducible
  if (navigator.webdriver) {
    renderFrame();
    return;
  }

  const tick = (): void => {
    if (document.hidden) {
      rafId = null;
      return;
    }
    renderFrame();
    rafId = requestAnimationFrame(tick);
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  });

  rafId = requestAnimationFrame(tick);
}
