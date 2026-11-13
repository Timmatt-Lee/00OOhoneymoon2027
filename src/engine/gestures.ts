import type { DayData } from '../types/schedule';
import type { RendererRefs } from './renderer';
import type { TimelineController } from './timeline';
import type { ParallaxController } from './parallax';
import {
  closestElement,
  getOptionalMetaById,
  getRequiredElementById,
  trySetPointerCapture
} from '../utils/dom';
import { formatDayHash, parseDayHash, resolveInitialDayIndex } from '../utils/tripDate';

export interface GestureEngine {
  getCurrentDayFloat(): number;
  glideToDay(nextTargetIdx: number): void;
}

const GLIDE_DURATION_MS = 320;
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

export function bindGesturesAndPhysics(
  daysData: DayData[],
  renderer: RendererRefs,
  timeline: TimelineController,
  parallax: ParallaxController,
  now: Date = new Date()
): GestureEngine {
  const dayCount = daysData.length;
  const maxIdx = dayCount - 1;
  const shell = getRequiredElementById('app-shell');
  const track = getRequiredElementById('story-bar-track');
  const stageFrame = document.getElementById('stage-frame');
  let themeMeta = getOptionalMetaById('theme-color-meta');
  if (
    themeMeta &&
    typeof window.CSS !== 'undefined' &&
    typeof window.CSS.supports === 'function' &&
    window.CSS.supports('-webkit-touch-callout', 'none')
  ) {
    themeMeta.remove();
    themeMeta = null;
  }

  const initialIdx = resolveInitialDayIndex(daysData, window.location.hash, now);
  let targetDayIdx = initialIdx;
  let currentPos = initialIdx;
  let dragRafId: number | null = null;
  let glideTimerId: number | null = null;
  let glideFromPos = initialIdx;
  let glideStartTime = 0;
  let activeGlideLowIdx = -1;
  let activeGlideHighIdx = -1;

  let viewportWidth = 400;
  let stageWidth = 400;
  let stageLeft = 0;
  let trackLeft = 0;
  let trackWidth = 368;
  let lastNearestDay = -1;

  function measureLayoutMetrics(): void {
    viewportWidth = shell.clientWidth || 400;
    const frameEl = stageFrame ?? shell;
    stageWidth = frameEl.clientWidth || viewportWidth;
    stageLeft = frameEl.getBoundingClientRect().left;
    const trackRect = track.getBoundingClientRect();
    trackLeft = trackRect.left;
    trackWidth = Math.max(1, trackRect.width);
  }
  measureLayoutMetrics();

  const reducedMotionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  function checkIsReducedMotion(): boolean {
    return reducedMotionQuery ? reducedMotionQuery.matches : false;
  }

  function syncUrlHash(dayIdx: number): void {
    const nextHash = formatDayHash(dayIdx);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }

  function syncSystemBars(nearestIdx: number): void {
    if (nearestIdx === lastNearestDay) return;
    lastNearestDay = nearestIdx;
    const hex = daysData[nearestIdx].topSkyHex;
    if (themeMeta && themeMeta.content !== hex) {
      themeMeta.content = hex;
    }
  }

  function clearScheduledAnimations(): void {
    if (dragRafId !== null) {
      cancelAnimationFrame(dragRafId);
      dragRafId = null;
    }
    if (glideTimerId !== null) {
      window.clearTimeout(glideTimerId);
      glideTimerId = null;
    }
  }

  function renderPair(idxA: number, idxB: number, t: number, rawPos: number): void {
    for (let i = 0; i <= maxIdx; i++) {
      const el = renderer.skyLayerEls[i];
      const isPrevNeighbor = t === 0 && i === idxA - 1;
      const isSkyStaged = i === idxA || i === idxB || isPrevNeighbor;
      el.classList.toggle('is-gpu-staged', isSkyStaged);
      if (i === idxA) {
        if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
        el.style.opacity = '1';
      } else if (i === idxB) {
        if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
        el.style.opacity = t.toFixed(3);
      } else if (isPrevNeighbor) {
        if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
        el.style.opacity = '0';
      } else if (el.style.visibility !== 'hidden') {
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
      }
    }

    for (let i = 0; i <= maxIdx; i++) {
      const panel = renderer.schedulePanelEls[i];
      const isPrevNeighbor = t === 0 && i === idxA - 1;
      const isPanelStaged = i === idxA || i === idxB || isPrevNeighbor;
      panel.classList.toggle('is-gpu-staged', isPanelStaged);
      if (isPanelStaged) {
        if (panel.style.visibility !== 'visible') panel.style.visibility = 'visible';
        const offset = i - rawPos;
        panel.style.opacity = Math.max(0, 1 - Math.abs(offset)).toFixed(3);
        panel.style.transform = `translate3d(${(offset * stageWidth).toFixed(1)}px, 0, 0)`;
      } else if (panel.style.visibility !== 'hidden') {
        panel.style.visibility = 'hidden';
        panel.style.opacity = '0';
      }
    }

    const clamped = idxA + t;
    timeline.renderInterpolation(idxA, idxB, t);
    parallax.renderParallax(clamped, idxA, idxB, t, viewportWidth);
    const nearest = Math.round(clamped);
    renderer.updateTopStoryBar(nearest, daysData[nearest].isDark);
    if (glideTimerId === null) {
      syncSystemBars(nearest);
    }
  }

  function renderAtPos(pos: number): void {
    const clamped = Math.max(0, Math.min(maxIdx, pos));
    const idxA = Math.floor(clamped);
    const idxB = Math.min(maxIdx, idxA + 1);
    const t = clamped - idxA;
    renderPair(idxA, idxB, t, pos);
  }

  function stepDragFrame(): void {
    dragRafId = null;
    renderAtPos(currentPos);
  }

  function finishGlide(): void {
    glideTimerId = null;
    activeGlideLowIdx = -1;
    activeGlideHighIdx = -1;
    shell.classList.remove('is-gliding');
    renderAtPos(targetDayIdx);
  }

  const jumpImmediatelyToDay = (dayIdx: number): void => {
    const clampedIdx = Math.max(0, Math.min(maxIdx, dayIdx));
    clearScheduledAnimations();
    activeGlideLowIdx = -1;
    activeGlideHighIdx = -1;
    shell.classList.remove('is-swiping', 'is-gliding');
    currentPos = clampedIdx;
    targetDayIdx = clampedIdx;
    syncUrlHash(clampedIdx);
    renderAtPos(clampedIdx);
  };

  function glideToDay(idx: number): void {
    const clampedIdx = Math.max(0, Math.min(maxIdx, idx));
    const prevPos = currentPos;
    targetDayIdx = clampedIdx;
    syncUrlHash(clampedIdx);

    if (
      checkIsReducedMotion() ||
      Math.abs(clampedIdx - prevPos) > 1 ||
      (clampedIdx === prevPos && glideTimerId === null)
    ) {
      jumpImmediatelyToDay(clampedIdx);
      return;
    }

    if (dragRafId !== null) {
      cancelAnimationFrame(dragRafId);
      dragRafId = null;
    }

    const clampedFrom = Math.max(0, Math.min(maxIdx, prevPos));
    const lowIdx = Math.min(Math.floor(clampedFrom), clampedIdx);
    const highIdx = Math.min(maxIdx, lowIdx + 1);

    if (glideTimerId !== null) {
      window.clearTimeout(glideTimerId);
      glideTimerId = null;
      if (lowIdx !== activeGlideLowIdx || highIdx !== activeGlideHighIdx) {
        shell.classList.remove('is-gliding');
        renderAtPos(prevPos);
      }
    }

    if (prevPos === highIdx && clampedIdx === lowIdx) {
      shell.classList.remove('is-gliding');
      renderPair(lowIdx, highIdx, 1, highIdx);
    }

    shell.getBoundingClientRect();
    shell.classList.remove('is-swiping');
    shell.classList.add('is-gliding');

    activeGlideLowIdx = lowIdx;
    activeGlideHighIdx = highIdx;
    glideFromPos = prevPos;
    glideStartTime = performance.now();
    currentPos = clampedIdx;

    const endT = clampedIdx === highIdx && highIdx > lowIdx ? 1 : 0;
    glideTimerId = window.setTimeout(finishGlide, GLIDE_DURATION_MS);
    renderPair(lowIdx, highIdx, endT, clampedIdx);
  }

  window.addEventListener('resize', () => {
    measureLayoutMetrics();
    renderAtPos(currentPos);
  });

  window.addEventListener('hashchange', () => {
    const hashIdx = parseDayHash(window.location.hash, dayCount);
    if (hashIdx !== null) {
      if (hashIdx !== targetDayIdx) {
        glideToDay(hashIdx);
      }
    } else if (window.location.hash !== '') {
      syncUrlHash(targetDayIdx);
    }
  });

  // 1. Top Story Bar Scrub, Slot Click & Keyboard Button Activation
  let scrubId: number | null = null;
  const resolveSlotDay = (clientX: number, targetEl?: EventTarget | null): number => {
    const slotEl = closestElement(targetEl, '[data-day]');
    if (slotEl !== null) {
      return Number(slotEl.dataset.day);
    }
    const ratio = Math.max(0, Math.min(0.9999, (clientX - trackLeft) / trackWidth));
    return (ratio * dayCount) | 0;
  };

  track.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || scrubId !== null) return;
    e.stopPropagation();
    const day = resolveSlotDay(e.clientX, e.target);
    scrubId = e.pointerId;
    trySetPointerCapture(track, e.pointerId);
    jumpImmediatelyToDay(day);
  });

  track.addEventListener('pointermove', (e: PointerEvent) => {
    if (scrubId !== e.pointerId) return;
    const day = resolveSlotDay(e.clientX);
    if (day === targetDayIdx && glideTimerId === null) return;
    jumpImmediatelyToDay(day);
  });

  const endTrackScrub = (e: PointerEvent): void => {
    if (scrubId !== e.pointerId) return;
    scrubId = null;
  };
  track.addEventListener('pointerup', endTrackScrub);
  track.addEventListener('pointercancel', endTrackScrub);

  // Keyboard activation (Enter / Space) on story-slot <button> elements triggers click with detail === 0
  track.addEventListener('click', (e: MouseEvent) => {
    if (e.detail !== 0) return;
    const slotEl = closestElement(e.target, '[data-day]');
    if (slotEl !== null) {
      jumpImmediatelyToDay(Number(slotEl.dataset.day));
    }
  });

  // 2. Stage Swipe, Left/Right Tap, Multi-Pointer Guard & Native Map Anchor Navigation
  let activeId: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragStart = 0;
  let isHorizontal = false;
  let isSuppressNextClick = false;
  let lastTap = -1000;

  shell.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (isSuppressNextClick) {
        isSuppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  shell.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || activeId !== null || closestElement(e.target, '#story-bar-track')) {
      return;
    }
    if (glideTimerId !== null) {
      const elapsed = Math.min(
        1,
        Math.max(0, (performance.now() - glideStartTime) / GLIDE_DURATION_MS)
      );
      const eased = 1 - Math.pow(1 - elapsed, 3);
      currentPos = glideFromPos + (targetDayIdx - glideFromPos) * eased;
      clearScheduledAnimations();
      activeGlideLowIdx = -1;
      activeGlideHighIdx = -1;
      shell.classList.remove('is-gliding');
      renderAtPos(currentPos);
    }
    activeId = e.pointerId;
    isHorizontal = false;
    isSuppressNextClick = false;
    startX = e.clientX;
    startY = e.clientY;
    dragStart = currentPos;
  });

  shell.addEventListener('pointermove', (e: PointerEvent) => {
    if (activeId !== e.pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!isHorizontal && (Math.abs(dx) <= 5 || Math.abs(dx) < Math.abs(dy) * 0.75)) return;
    if (!isHorizontal) {
      isHorizontal = true;
      isSuppressNextClick = true;
      trySetPointerCapture(shell, e.pointerId);
    }
    shell.classList.add('is-swiping');
    const raw = dragStart - dx / stageWidth;
    currentPos = raw < 0 ? raw * 0.2 : raw > maxIdx ? maxIdx + (raw - maxIdx) * 0.2 : raw;
    if (dragRafId === null) {
      dragRafId = requestAnimationFrame(stepDragFrame);
    }
  });

  const endSwipe = (e: PointerEvent): void => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    const dx = e.clientX - startX;
    const dist = Math.hypot(dx, e.clientY - startY);
    const settled = Math.round(dragStart);
    const targetAnchor = closestElement(e.target, 'a[href]');

    if (isHorizontal) {
      glideToDay(dx < -36 ? settled + 1 : dx > 36 ? settled - 1 : Math.round(currentPos));
    } else if (targetAnchor) {
      // Allow native <a href> click / Universal Links navigation on schedule items and #cityscape-map-link
      return;
    } else if (dist < 10 && performance.now() - lastTap > 200) {
      lastTap = performance.now();
      const relX = (e.clientX - stageLeft) / stageWidth;
      glideToDay(relX >= 0.65 ? settled + 1 : relX <= 0.35 ? settled - 1 : settled);
    } else {
      glideToDay(Math.round(currentPos));
    }
  };

  const cancelSwipe = (e: PointerEvent): void => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    isHorizontal = false;
    isSuppressNextClick = false;
    glideToDay(Math.round(dragStart));
  };

  shell.addEventListener('pointerup', endSwipe);
  shell.addEventListener('pointercancel', cancelSwipe);

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.defaultPrevented ||
      closestElement(e.target, EDITABLE_SELECTOR)
    ) {
      return;
    }

    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = targetDayIdx + 1;
    else if (e.key === 'ArrowLeft') nextIdx = targetDayIdx - 1;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = maxIdx;

    if (nextIdx === null) return;

    glideToDay(nextIdx);
    if (closestElement(document.activeElement, '#story-bar-track')) {
      e.preventDefault();
      renderer.storySlotEls[targetDayIdx].focus();
    }
  });

  if (window.location.hash !== '') {
    syncUrlHash(initialIdx);
  }
  renderAtPos(initialIdx);
  return { getCurrentDayFloat: () => currentPos, glideToDay };
}
