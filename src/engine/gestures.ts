import type { DayData } from '../types/schedule';
import type { RendererRefs } from './renderer';
import type { TimelineController } from './timeline';
import type { ParallaxController } from './parallax';

export interface GestureEngine {
  getCurrentDayFloat(): number;
  glideToDay(nextTargetIdx: number): void;
}

export function bindGesturesAndPhysics(
  daysData: DayData[],
  renderer: RendererRefs,
  timeline: TimelineController,
  parallax: ParallaxController
): GestureEngine {
  const maxIdx = daysData.length - 1;
  const shell = document.getElementById('app-shell')!;
  const track = document.getElementById('story-bar-track')!;
  const footerEl = document.getElementById('cityscape-footer')!;

  let targetDayIdx = 0;
  let currentPos = 0;
  let isDragging = false;
  let rafId: number | null = null;
  let vw = shell.clientWidth || 400;

  window.addEventListener('resize', () => { vw = shell.clientWidth || 400; });

  function renderAtPos(pos: number): void {
    const clamped = Math.max(0, Math.min(maxIdx, pos));
    const idxA = Math.floor(clamped);
    const idxB = Math.min(maxIdx, idxA + 1);
    const t = clamped - idxA;

    renderer.skyLayerEls.forEach((el, i) => {
      const active = i === idxA || i === idxB;
      el.style.visibility = active ? 'visible' : 'hidden';
      el.style.opacity = active ? (i === idxA ? 1 - t : t).toFixed(3) : '0';
    });

    renderer.schedulePanelEls.forEach((panel, i) => {
      const active = i === idxA || i === idxB;
      panel.style.visibility = active ? 'visible' : 'hidden';
      if (active) {
        const offset = i - pos;
        panel.style.opacity = Math.max(0, 1 - Math.abs(offset) * 0.85).toFixed(3);
        panel.style.transform = `translate3d(${(offset * vw).toFixed(1)}px, 0, 0)`;
      }
    });

    timeline.renderInterpolation(idxA, idxB, t);
    parallax.renderParallax(clamped, idxA, idxB, t, vw);
    const nearest = Math.round(clamped);
    renderer.updateTopStoryBar(nearest, daysData[nearest].isDark);
  }

  function stepSpring(): void {
    rafId = null;
    if (isDragging) return renderAtPos(currentPos);
    const diff = targetDayIdx - currentPos;
    if (Math.abs(diff) > 0.0015) {
      currentPos += diff * 0.26;
      renderAtPos(currentPos);
      rafId = requestAnimationFrame(stepSpring);
    } else {
      renderAtPos((currentPos = targetDayIdx));
    }
  }

  function glideToDay(idx: number): void {
    targetDayIdx = Math.max(0, Math.min(maxIdx, idx));
    if (!rafId) rafId = requestAnimationFrame(stepSpring);
  }

  // 1. Top Story Bar Scrub & Slot Click
  let scrubId: number | null = null;
  const resolveSlotDay = (clientX: number, targetEl?: EventTarget | null): number => {
    const slotEl = (targetEl as HTMLElement | null)?.closest?.('[data-day]') as HTMLElement | null;
    if (slotEl?.dataset.day !== undefined && (clientX === 0 || scrubId === null)) return Number(slotEl.dataset.day);
    const r = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.9999, (clientX - r.left) / Math.max(1, r.width)));
    return (ratio * daysData.length) | 0;
  };

  track.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button) return;
    e.stopPropagation();
    const day = resolveSlotDay(e.clientX, e.target);
    scrubId = e.pointerId;
    try { track.setPointerCapture(e.pointerId); } catch {}
    isDragging = false;
    renderAtPos((currentPos = targetDayIdx = day));
  });

  track.addEventListener('pointermove', (e: PointerEvent) => {
    if (scrubId !== e.pointerId) return;
    renderAtPos((currentPos = targetDayIdx = resolveSlotDay(e.clientX)));
  });
  track.addEventListener('pointerup', () => { scrubId = null; });
  track.addEventListener('pointercancel', () => { scrubId = null; });

  // 2. Stage Swipe, Left/Right Tap & Footer Google Maps Link
  let activeId: number | null = null;
  let startX = 0, startY = 0, dragStart = 0, inFooter = false, horiz = false, lastTap = 0;

  shell.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button || (e.target as HTMLElement | null)?.closest?.('#story-bar-track')) return;
    activeId = e.pointerId;
    try { shell.setPointerCapture(e.pointerId); } catch {}
    vw = shell.clientWidth || 400;
    inFooter = e.clientY >= footerEl.getBoundingClientRect().top + 16;
    isDragging = true;
    horiz = false;
    startX = e.clientX;
    startY = e.clientY;
    dragStart = currentPos;
  });

  shell.addEventListener('pointermove', (e: PointerEvent) => {
    if (activeId !== e.pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!horiz && (Math.abs(dx) <= 5 || Math.abs(dx) < Math.abs(dy) * 0.75)) return;
    horiz = true;
    const raw = dragStart - dx / vw;
    currentPos = raw < 0 ? raw * 0.2 : raw > maxIdx ? maxIdx + (raw - maxIdx) * 0.2 : raw;
    if (!rafId) rafId = requestAnimationFrame(stepSpring);
  });

  const endSwipe = (e: PointerEvent) => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    isDragging = false;
    const dx = e.clientX - startX;
    const dist = Math.hypot(dx, e.clientY - startY);
    const settled = Math.round(dragStart);

    if (horiz) {
      glideToDay(dx < -36 ? settled + 1 : dx > 36 ? settled - 1 : Math.round(currentPos));
    } else if (dist < 10 && performance.now() - lastTap > 200) {
      lastTap = performance.now();
      if (inFooter) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(daysData[settled].mapQuery)}`, '_blank', 'noopener,noreferrer');
      } else {
        const relX = (e.clientX - shell.getBoundingClientRect().left) / vw;
        glideToDay(relX >= 0.65 ? settled + 1 : relX <= 0.35 ? settled - 1 : settled);
      }
    } else {
      glideToDay(Math.round(currentPos));
    }
  };
  shell.addEventListener('pointerup', endSwipe);
  shell.addEventListener('pointercancel', endSwipe);

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') glideToDay(targetDayIdx + 1);
    else if (e.key === 'ArrowLeft') glideToDay(targetDayIdx - 1);
  });

  renderAtPos(0);
  return { getCurrentDayFloat: () => currentPos, glideToDay };
}
