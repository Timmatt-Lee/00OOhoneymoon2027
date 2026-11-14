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

const GLIDE_TAU_MS = 32;
const GLIDE_SETTLE_EPSILON = 0.003;
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
  let isSuppressNextClick = false;
  let stagedMinIdx = maxIdx;
  let stagedMaxIdx = -1;
  const stagedDayMask = new Uint8Array(dayCount);
  stagedDayMask.fill(2);
  const lastSkyOp: string[] = Array.from({ length: dayCount }, () => '');
  const lastPanelOp: string[] = Array.from({ length: dayCount }, () => '');
  const lastPanelTx: string[] = Array.from({ length: dayCount }, () => '');

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
      viewportState.innerH + (viewportState.isTouchLandscape ? viewportState.chinFixPx : 0),
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

  function stopGlideAnimation(): void {
    if (glideRafId !== null) {
      cancelAnimationFrame(glideRafId);
      glideRafId = null;
    }
  }

  function clearScheduledAnimations(): void {
    if (dragRafId !== null) {
      cancelAnimationFrame(dragRafId);
      dragRafId = null;
    }
    stopGlideAnimation();
  }

  function renderPair(idxA: number, idxB: number, t: number, rawPos: number): void {
    const clamped = idxA + t;
    const nearest = Math.round(clamped);
    const isSettled = !isHorizontal && dragRafId === null && glideRafId === null;

    if (isSettled) {
      stagedMinIdx = Math.max(0, nearest - 1);
      stagedMaxIdx = Math.min(maxIdx, nearest + 1);
    } else if (idxB > stagedMaxIdx) {
      stagedMinIdx = idxA;
      stagedMaxIdx = Math.min(maxIdx, idxB + 1);
    } else if (idxA < stagedMinIdx) {
      stagedMinIdx = Math.max(0, idxA - 1);
      stagedMaxIdx = idxB;
    }

    for (let i = 0; i <= maxIdx; i++) {
      const isInWindow = i >= stagedMinIdx && i <= stagedMaxIdx;
      const nextMask = isInWindow ? 1 : 0;
      const skyEl = renderer.skyLayerEls[i];
      const panelEl = renderer.schedulePanelEls[i];

      if (stagedDayMask[i] !== nextMask) {
        stagedDayMask[i] = nextMask;
        skyEl.classList.toggle('is-gpu-staged', isInWindow);
        panelEl.classList.toggle('is-gpu-staged', isInWindow);
        const nextVis = isInWindow ? 'visible' : 'hidden';
        skyEl.style.visibility = nextVis;
        panelEl.style.visibility = nextVis;
        if (!isInWindow) {
          skyEl.style.opacity = '0';
          lastSkyOp[i] = '0';
          panelEl.style.opacity = '0';
          lastPanelOp[i] = '0';
        }
      }

      if (!isInWindow) continue;

      const nextSkyOp = i === idxA ? '1' : i === idxB ? t.toFixed(3) : '0';
      if (lastSkyOp[i] !== nextSkyOp) {
        skyEl.style.opacity = nextSkyOp;
        lastSkyOp[i] = nextSkyOp;
      }

      const isActivePair = i === idxA || i === idxB;
      const offset = isActivePair || isSettled ? i - rawPos : i < idxA ? -1 : 1;
      const nextPanelOp = isActivePair ? Math.max(0, 1 - Math.abs(offset)).toFixed(3) : '0.000';
      if (lastPanelOp[i] !== nextPanelOp) {
        panelEl.style.opacity = nextPanelOp;
        lastPanelOp[i] = nextPanelOp;
      }

      const nextPanelTx = `translate3d(${(offset * stageWidth).toFixed(1)}px, 0, 0)`;
      if (lastPanelTx[i] !== nextPanelTx) {
        panelEl.style.transform = nextPanelTx;
        lastPanelTx[i] = nextPanelTx;
      }
    }

    timeline.renderInterpolation(idxA, idxB, t);
    parallax.renderParallax(clamped, idxA, idxB, t, viewportWidth);
    renderer.updateTopStoryBar(nearest, daysData[nearest].isDark, isSettled);
    if (isSettled) {
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

    if (checkIsReducedMotion() || Math.abs(clampedIdx - currentPos) < GLIDE_SETTLE_EPSILON) {
      jumpImmediatelyToDay(clampedIdx);
      return;
    }

    if (clampedIdx - currentPos > 1) {
      currentPos = clampedIdx - 1;
    } else if (currentPos - clampedIdx > 1) {
      currentPos = clampedIdx + 1;
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
    isSuppressNextClick = false;
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
      if (glideRafId !== null || isInterruptingGlide) {
        stopGlideAnimation();
        dragStart = currentPos + dx / stageWidth;
      }
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

    if (!isHorizontal && Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy) * 0.75) {
      isHorizontal = true;
      isSuppressNextClick = true;
    }
    const isHorizontalGesture = isHorizontal;
    isHorizontal = false;

    if (isHorizontalGesture) {
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
      if (glideRafId !== null || isInterruptingGlide) {
        isSuppressNextClick = true;
        stopGlideAnimation();
        glideToDay(Math.round(currentPos));
      }
      // Allow native <a href> click / Universal Links navigation when settled
      return;
    } else if (dist < 10) {
      const isGlidingNow = glideRafId !== null || isInterruptingGlide;
      const baseDay = isGlidingNow ? targetDayIdx : Math.round(dragStart);
      const relX = (pt.x - stageLeft) / stageWidth;
      if (relX >= 0.65) {
        glideToDay(baseDay + 1);
      } else if (relX <= 0.35) {
        glideToDay(baseDay - 1);
      } else {
        stopGlideAnimation();
        glideToDay(Math.round(currentPos));
      }
    } else {
      stopGlideAnimation();
      glideToDay(Math.round(currentPos));
    }
  };

  const cancelSwipe = (e: PointerEvent): void => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    const settleTarget = Math.round(isHorizontal ? dragStart : currentPos);
    isHorizontal = false;
    isSuppressNextClick = false;
    stopGlideAnimation();
    glideToDay(settleTarget);
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
