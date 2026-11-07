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
  let targetDayIdx = 0;
  let currentPos = 0;
  let currentDayFloat = 0;
  let isPointerDragging = false;
  let physicsRafId: number | null = null;
  let cachedViewportWidth = 400;

  const updateViewportWidth = () => {
    const shell = document.getElementById('app-shell');
    if (shell) cachedViewportWidth = shell.clientWidth || 400;
  };
  updateViewportWidth();
  window.addEventListener('resize', updateViewportWidth);

  function renderAtPos(pos: number): void {
    const maxIdx = daysData.length - 1;
    const clamped = Math.max(0, Math.min(maxIdx, pos));
    currentDayFloat = clamped;

    const idxA = Math.floor(clamped);
    const idxB = Math.min(maxIdx, idxA + 1);
    const t = clamped - idxA;

    for (let i = 0; i < renderer.skyLayerEls.length; i++) {
      const el = renderer.skyLayerEls[i];
      if (i === idxA || i === idxB) {
        const op = i === idxA ? 1 - t : t;
        if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
        el.style.opacity = op.toFixed(3);
      } else if (el.style.visibility !== 'hidden') {
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
      }
    }

    timeline.renderInterpolation(idxA, idxB, t);

    for (let i = 0; i < renderer.schedulePanelEls.length; i++) {
      const panel = renderer.schedulePanelEls[i];
      if (i === idxA || i === idxB) {
        if (panel.style.visibility !== 'visible') panel.style.visibility = 'visible';
        const offsetDays = i - pos;
        const x = (offsetDays * cachedViewportWidth).toFixed(1);
        const op = Math.max(0, 1 - Math.abs(offsetDays) * 0.85).toFixed(3);
        panel.style.opacity = op;
        panel.style.transform = `translate3d(${x}px, 0, 0)`;
      } else if (panel.style.visibility !== 'hidden') {
        panel.style.opacity = '0';
        panel.style.visibility = 'hidden';
      }
    }

    parallax.renderParallax(clamped, idxA, idxB, t, cachedViewportWidth);

    const nearestDay = Math.round(clamped);
    renderer.updateTopStoryBar(nearestDay, daysData[nearestDay].isDark);
  }

  const stepPhysicsLoop = (): void => {
    physicsRafId = null;
    if (isPointerDragging) {
      renderAtPos(currentPos);
      return;
    }
    const diff = targetDayIdx - currentPos;
    if (Math.abs(diff) > 0.0015) {
      currentPos += diff * 0.26;
      renderAtPos(currentPos);
      physicsRafId = requestAnimationFrame(stepPhysicsLoop);
    } else {
      currentPos = targetDayIdx;
      renderAtPos(currentPos);
    }
  };

  function ensurePhysicsLoop(): void {
    if (!physicsRafId) {
      physicsRafId = requestAnimationFrame(stepPhysicsLoop);
    }
  }

  function glideToDay(nextTargetIdx: number): void {
    targetDayIdx = Math.max(0, Math.min(daysData.length - 1, nextTargetIdx));
    ensurePhysicsLoop();
  }

  // 1. Top Story Bar Scrubbing
  const track = document.getElementById('story-bar-track')!;
  let activeScrubPointerId: number | null = null;
  let rectLeft = 0;
  let rectWidth = 1;

  const updateRect = () => {
    const r = track.getBoundingClientRect();
    rectLeft = r.left;
    rectWidth = Math.max(1, r.width);
  };

  const getDayAtX = (clientX: number, checkExactSlot: boolean, targetEl?: EventTarget | null): number => {
    if (checkExactSlot && targetEl && (targetEl as HTMLElement).closest) {
      const slotEl = (targetEl as HTMLElement).closest("[data-day]") as HTMLElement | null;
      if (slotEl && slotEl.dataset.day !== undefined) {
        return Number(slotEl.dataset.day);
      }
    }
    if (checkExactSlot) {
      for (let i = 0; i < renderer.storySlotEls.length; i++) {
        const sr = renderer.storySlotEls[i].getBoundingClientRect();
        if (clientX >= sr.left - 3 && clientX <= sr.right + 3) return i;
      }
    }
    const ratio = Math.max(0, Math.min(0.9999, (clientX - rectLeft) / rectWidth));
    return (ratio * daysData.length) | 0;
  };

  const jumpToX = (clientX: number, checkExactSlot: boolean, targetEl?: EventTarget | null) => {
    const target = getDayAtX(clientX, checkExactSlot, targetEl);
    isPointerDragging = false;
    targetDayIdx = target;
    currentPos = target;
    renderAtPos(target);
  };

  track.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    activeScrubPointerId = e.pointerId;
    if (track.setPointerCapture) {
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
    }
    updateRect();
    jumpToX(e.clientX, true, e.target);
  });

  track.addEventListener('pointermove', (e: PointerEvent) => {
    if (activeScrubPointerId === null || e.pointerId !== activeScrubPointerId) return;
    e.stopPropagation();
    jumpToX(e.clientX, false);
  });

  const endScrub = (e: PointerEvent) => {
    if (activeScrubPointerId === null || e.pointerId !== activeScrubPointerId) return;
    activeScrubPointerId = null;
  };
  track.addEventListener('pointerup', endScrub);
  track.addEventListener('pointercancel', endScrub);

  // 2. Main Stage Swipe, Tap & Footer Google Maps Click
  const shell = document.getElementById('app-shell')!;
  let activePointerId: number | null = null;
  let isHorizontalDrag = false;
  let startX = 0;
  let startY = 0;
  let dragStartPos = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocityX = 0;
  let startedInFooter = false;
  let lastTapTimestamp = 0;

  shell.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl && targetEl.closest && targetEl.closest('#story-bar-track')) return;

    activePointerId = e.pointerId;
    if (shell.setPointerCapture) {
      try { shell.setPointerCapture(e.pointerId); } catch (_) {}
    }

    updateViewportWidth();
    const footerEl = document.getElementById('cityscape-footer')!;
    const fRect = footerEl.getBoundingClientRect();
    startedInFooter = e.clientY >= fRect.top + 16;

    isPointerDragging = true;
    isHorizontalDrag = false;
    startX = e.clientX;
    startY = e.clientY;
    dragStartPos = currentPos;
    lastX = e.clientX;
    lastTime = performance.now();
    velocityX = 0;
  });

  shell.addEventListener('pointermove', (e: PointerEvent) => {
    if (activePointerId === null || e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!isHorizontalDrag) {
      if (Math.abs(dx) > 5 && Math.abs(dx) >= Math.abs(dy) * 0.75) {
        isHorizontalDrag = true;
      } else {
        return;
      }
    }

    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    const instVx = (e.clientX - lastX) / dt;
    velocityX = velocityX * 0.35 + instVx * 0.65;
    lastX = e.clientX;
    lastTime = now;

    const maxIdx = daysData.length - 1;
    let nextPos = dragStartPos - dx / cachedViewportWidth;
    if (nextPos < 0) nextPos = nextPos * 0.2;
    if (nextPos > maxIdx) nextPos = maxIdx + (nextPos - maxIdx) * 0.2;

    currentPos = Math.max(-0.18, Math.min(maxIdx + 0.18, nextPos));
    ensurePhysicsLoop();
  });

  const finishPointer = (e: PointerEvent) => {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    activePointerId = null;
    isPointerDragging = false;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.hypot(dx, dy);
    const maxIdx = daysData.length - 1;

    if (isHorizontalDrag) {
      const projectedPos = currentPos - velocityX * 0.28;
      let nextTarget = Math.round(projectedPos);
      const baseDay = Math.round(dragStartPos);
      if (velocityX < -0.2 || dx < -36) {
        nextTarget = Math.max(nextTarget, Math.floor(dragStartPos) + 1);
      } else if (velocityX > 0.2 || dx > 36) {
        nextTarget = Math.min(nextTarget, Math.ceil(dragStartPos) - 1);
      }
      nextTarget = Math.max(baseDay - 1, Math.min(baseDay + 1, nextTarget));
      glideToDay(Math.max(0, Math.min(maxIdx, nextTarget)));
    } else if (dist < 10) {
      const now = performance.now();
      if (now - lastTapTimestamp > 220) {
        lastTapTimestamp = now;
        const settledDay = Math.round(currentPos);
        if (startedInFooter) {
          const q = daysData[settledDay].mapQuery;
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer');
          glideToDay(settledDay);
        } else {
          const shellRect = shell.getBoundingClientRect();
          const relX = (e.clientX - shellRect.left) / Math.max(1, shellRect.width);
          if (relX >= 0.65 && settledDay < maxIdx) {
            glideToDay(settledDay + 1);
          } else if (relX <= 0.35 && settledDay > 0) {
            glideToDay(settledDay - 1);
          } else {
            glideToDay(settledDay);
          }
        }
      } else {
        glideToDay(targetDayIdx);
      }
    } else {
      glideToDay(Math.round(currentPos));
    }

    isHorizontalDrag = false;
    startedInFooter = false;
  };

  shell.addEventListener('pointerup', finishPointer);
  shell.addEventListener('pointercancel', finishPointer);

  // 3. Keyboard Navigation
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' && targetDayIdx < daysData.length - 1) {
      glideToDay(targetDayIdx + 1);
    } else if (e.key === 'ArrowLeft' && targetDayIdx > 0) {
      glideToDay(targetDayIdx - 1);
    }
  });

  renderAtPos(0);

  return {
    getCurrentDayFloat: () => currentDayFloat,
    glideToDay
  };
}
