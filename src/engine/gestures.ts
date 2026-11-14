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
import {
  mapPointerToStage,
  syncViewportState,
  tryLockPortraitOrientation,
  type Point2D,
  type ViewportState
} from '../utils/viewport';

export interface GestureEngine {
  getCurrentDayFloat(): number;
  glideToDay(nextTargetIdx: number): void;
}

const GLIDE_TAU_MS = 52;
const GLIDE_SETTLE_EPSILON = 0.002;
const FLICK_VELOCITY_PX_PER_MS = 0.22;
const FLICK_DISTANCE_PX = 28;
const VELOCITY_SAMPLE_STEP_MS = 30;
const VELOCITY_STALE_MS = 90;
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

  tryLockPortraitOrientation();

  const initialIdx = resolveInitialDayIndex(daysData, window.location.hash, now);
  let targetDayIdx = initialIdx;
  let currentPos = initialIdx;
  let dragRafId: number | null = null;
  let glideRafId: number | null = null;
  let lastGlideTime = 0;

  let viewportState: ViewportState = syncViewportState(shell);
  let viewportWidth = 400;
  let stageWidth = 400;
  let stageLeft = 0;
  let trackLeft = 0;
  let trackWidth = 368;
  let lastNearestDay = -1;
  let activeId: number | null = null;
  let isHorizontal = false;

  function measureLayoutMetrics(): void {
    viewportState = syncViewportState(shell);
    viewportWidth = shell.clientWidth || 400;
    const frameEl = stageFrame ?? shell;
    stageWidth = frameEl.clientWidth || viewportWidth;
    stageLeft = (viewportWidth - stageWidth) / 2;
    trackLeft = stageLeft + track.offsetLeft;
    trackWidth = Math.max(1, track.offsetWidth);
  }
  measureLayoutMetrics();

  function toStagePoint(e: PointerEvent): Point2D {
    return mapPointerToStage(
      e.clientX,
      e.clientY,
      viewportState.innerW,
      viewportState.innerH,
      viewportState.lockMode
    );
  }

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
    if (glideRafId !== null) {
      cancelAnimationFrame(glideRafId);
      glideRafId = null;
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
    if (activeId === null && glideRafId === null) {
      const nearest = Math.round(clamped);
      renderer.updateTopStoryBar(nearest, daysData[nearest].isDark);
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

  const jumpImmediatelyToDay = (dayIdx: number): void => {
    const clampedIdx = Math.max(0, Math.min(maxIdx, dayIdx));
    clearScheduledAnimations();
    activeId = null;
    isHorizontal = false;
    shell.classList.remove('is-moving');
    currentPos = clampedIdx;
    targetDayIdx = clampedIdx;
    syncUrlHash(clampedIdx);
    renderAtPos(clampedIdx);
  };

  function stepGlideFrame(frameNow: number): void {
    if (checkIsReducedMotion()) {
      jumpImmediatelyToDay(targetDayIdx);
      return;
    }
    const dtMs = Math.min(64, Math.max(1, frameNow - lastGlideTime));
    lastGlideTime = frameNow;
    const alpha = 1 - Math.exp(-dtMs / GLIDE_TAU_MS);
    currentPos += (targetDayIdx - currentPos) * alpha;

    if (Math.abs(targetDayIdx - currentPos) < GLIDE_SETTLE_EPSILON) {
      glideRafId = null;
      currentPos = targetDayIdx;
      shell.classList.remove('is-moving');
      syncUrlHash(targetDayIdx);
      renderAtPos(targetDayIdx);
      return;
    }

    renderAtPos(currentPos);
    glideRafId = requestAnimationFrame(stepGlideFrame);
  }

  function glideToDay(idx: number): void {
    const clampedIdx = Math.max(0, Math.min(maxIdx, idx));
    targetDayIdx = clampedIdx;
    syncUrlHash(clampedIdx);
    renderer.updateTopStoryBar(clampedIdx, daysData[clampedIdx].isDark);

    if (checkIsReducedMotion() || Math.abs(clampedIdx - currentPos) < GLIDE_SETTLE_EPSILON) {
      jumpImmediatelyToDay(clampedIdx);
      return;
    }

    if (dragRafId !== null) {
      cancelAnimationFrame(dragRafId);
      dragRafId = null;
    }

    shell.classList.add('is-moving');
    if (glideRafId === null) {
      lastGlideTime = performance.now();
      glideRafId = requestAnimationFrame(stepGlideFrame);
    }
  }

  const onViewportChange = (): void => {
    measureLayoutMetrics();
    renderAtPos(currentPos);
  };
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);

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
  const resolveSlotDay = (stageX: number, targetEl?: EventTarget | null): number => {
    const slotEl = closestElement(targetEl, '[data-day]');
    if (slotEl !== null) {
      return Number(slotEl.dataset.day);
    }
    const ratio = Math.max(0, Math.min(0.9999, (stageX - trackLeft) / trackWidth));
    return (ratio * dayCount) | 0;
  };

  track.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || scrubId !== null) return;
    e.stopPropagation();
    const pt = toStagePoint(e);
    const day = resolveSlotDay(pt.x, e.target);
    scrubId = e.pointerId;
    trySetPointerCapture(track, e.pointerId);
    jumpImmediatelyToDay(day);
  });

  track.addEventListener('pointermove', (e: PointerEvent) => {
    if (scrubId !== e.pointerId) return;
    const pt = toStagePoint(e);
    const day = resolveSlotDay(pt.x);
    if (day === targetDayIdx && glideRafId === null) return;
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

  // 2. Stage Swipe, Velocity Flicks, Chained Interruption, Tap Zones & Native Map Anchor Navigation
  let startX = 0;
  let startY = 0;
  let dragStart = 0;
  let isInterruptingGlide = false;
  let priorTargetIdx = initialIdx;
  let isSuppressNextClick = false;
  let lastTap = -1000;
  let velAnchorX = 0;
  let velAnchorTime = 0;
  let velStepX = 0;
  let velStepTime = 0;
  let lastMoveTime = 0;

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
    isInterruptingGlide = glideRafId !== null;
    priorTargetIdx = targetDayIdx;
    if (glideRafId !== null) {
      cancelAnimationFrame(glideRafId);
      glideRafId = null;
    }
    const pt = toStagePoint(e);
    const nowTime = performance.now();
    activeId = e.pointerId;
    isHorizontal = false;
    isSuppressNextClick = false;
    startX = pt.x;
    startY = pt.y;
    dragStart = currentPos;
    velAnchorX = pt.x;
    velAnchorTime = nowTime;
    velStepX = pt.x;
    velStepTime = nowTime;
    lastMoveTime = nowTime;
  });

  shell.addEventListener('pointermove', (e: PointerEvent) => {
    if (activeId !== e.pointerId) return;
    const pt = toStagePoint(e);
    const dx = pt.x - startX;
    const dy = pt.y - startY;
    if (!isHorizontal && (Math.abs(dx) <= 5 || Math.abs(dx) < Math.abs(dy) * 0.75)) return;
    if (!isHorizontal) {
      isHorizontal = true;
      isSuppressNextClick = true;
      trySetPointerCapture(shell, e.pointerId);
    }

    const nowTime = performance.now();
    if (nowTime - lastMoveTime > VELOCITY_STALE_MS) {
      velAnchorX = pt.x;
      velAnchorTime = nowTime;
      velStepX = pt.x;
      velStepTime = nowTime;
    } else if (nowTime - velStepTime >= VELOCITY_SAMPLE_STEP_MS) {
      velAnchorX = velStepX;
      velAnchorTime = velStepTime;
      velStepX = pt.x;
      velStepTime = nowTime;
    }
    lastMoveTime = nowTime;

    shell.classList.add('is-moving');
    const raw = dragStart - dx / stageWidth;
    currentPos = raw < 0 ? raw * 0.2 : raw > maxIdx ? maxIdx + (raw - maxIdx) * 0.2 : raw;
    if (dragRafId === null) {
      dragRafId = requestAnimationFrame(stepDragFrame);
    }
  });

  const endSwipe = (e: PointerEvent): void => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    const pt = toStagePoint(e);
    const dx = pt.x - startX;
    const dy = pt.y - startY;
    const dist = Math.hypot(dx, dy);
    const nowTime = performance.now();
    const targetAnchor = closestElement(e.target, 'a[href]');

    if (isHorizontal) {
      const dtVel = nowTime - velAnchorTime;
      const vx =
        nowTime - lastMoveTime <= VELOCITY_STALE_MS && dtVel >= 1 ? (pt.x - velAnchorX) / dtVel : 0;

      if (vx < -FLICK_VELOCITY_PX_PER_MS || dx < -FLICK_DISTANCE_PX) {
        const anchorLeft =
          isInterruptingGlide && priorTargetIdx > dragStart
            ? priorTargetIdx
            : Math.floor(Math.max(0, dragStart));
        glideToDay(Math.max(anchorLeft + 1, Math.ceil(currentPos)));
      } else if (vx > FLICK_VELOCITY_PX_PER_MS || dx > FLICK_DISTANCE_PX) {
        const anchorRight =
          isInterruptingGlide && priorTargetIdx < dragStart
            ? priorTargetIdx
            : Math.ceil(Math.min(maxIdx, dragStart));
        glideToDay(Math.min(anchorRight - 1, Math.floor(currentPos)));
      } else {
        glideToDay(Math.round(currentPos));
      }
    } else if (targetAnchor) {
      if (isInterruptingGlide) {
        isSuppressNextClick = true;
        glideToDay(Math.round(currentPos));
      }
      // Allow native <a href> click / Universal Links navigation when settled
      return;
    } else if (dist < 10 && nowTime - lastTap > 200) {
      lastTap = nowTime;
      const baseDay = isInterruptingGlide ? priorTargetIdx : Math.round(dragStart);
      const relX = (pt.x - stageLeft) / stageWidth;
      glideToDay(relX >= 0.65 ? baseDay + 1 : relX <= 0.35 ? baseDay - 1 : Math.round(currentPos));
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
