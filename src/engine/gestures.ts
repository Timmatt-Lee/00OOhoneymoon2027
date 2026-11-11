import type { DayData } from '../types/schedule';
import type { RendererRefs } from './renderer';
import type { TimelineController } from './timeline';
import type { ParallaxController } from './parallax';
import { closestElement, getRequiredElementById, trySetPointerCapture } from '../utils/dom';
import { buildGoogleMapsUrl } from '../utils/themeColor';
import { formatDayHash, parseDayHash, resolveInitialDayIndex } from '../utils/tripDate';

export interface GestureEngine {
  getCurrentDayFloat(): number;
  glideToDay(nextTargetIdx: number): void;
}

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
  const skyStack = getRequiredElementById('sky-stack');
  const track = getRequiredElementById('story-bar-track');
  const footerEl = getRequiredElementById('cityscape-footer');
  const stageFrame = document.getElementById('stage-frame');
  const themeMeta = document.getElementById('theme-color-meta') as HTMLMetaElement | null;

  const initialIdx = resolveInitialDayIndex(daysData, window.location.hash, now);
  let targetDayIdx = initialIdx;
  let currentPos = initialIdx;
  let isDragging = false;
  let rafId: number | null = null;
  let lastFrameTime = 0;
  let viewportWidth = shell.clientWidth || 400;
  let stageWidth = stageFrame?.clientWidth || viewportWidth;
  let lastNearestDay = -1;
  let lastSkyIdxA = -1;

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
    document.documentElement.style.setProperty('--sky-top-color', hex);
    if (themeMeta && themeMeta.content !== hex) {
      themeMeta.content = hex;
    }
  }

  function renderAtPos(pos: number): void {
    const clamped = Math.max(0, Math.min(maxIdx, pos));
    const idxA = Math.floor(clamped);
    const idxB = Math.min(maxIdx, idxA + 1);
    const t = clamped - idxA;

    if (idxA !== lastSkyIdxA) {
      lastSkyIdxA = idxA;
      skyStack.style.background = daysData[idxA].skyGrad;
    }

    for (let i = 0; i <= maxIdx; i++) {
      const el = renderer.skyLayerEls[i];
      const isSkyActive = i === idxA || i === idxB;
      if (isSkyActive) {
        if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
        el.style.opacity = (i === idxA ? 1 - t : t).toFixed(3);
      } else if (el.style.visibility !== 'hidden') {
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
      }
    }

    for (let i = 0; i <= maxIdx; i++) {
      const panel = renderer.schedulePanelEls[i];
      const isPanelActive = i === idxA || i === idxB;
      if (isPanelActive) {
        if (panel.style.visibility !== 'visible') panel.style.visibility = 'visible';
        const offset = i - pos;
        panel.style.opacity = Math.max(0, 1 - Math.abs(offset) * 0.85).toFixed(3);
        panel.style.transform = `translate3d(${(offset * stageWidth).toFixed(1)}px, 0, 0)`;
      } else if (panel.style.visibility !== 'hidden') {
        panel.style.visibility = 'hidden';
      }
    }

    timeline.renderInterpolation(idxA, idxB, t);
    parallax.renderParallax(clamped, idxA, idxB, t, viewportWidth);
    const nearest = Math.round(clamped);
    renderer.updateTopStoryBar(nearest, daysData[nearest].isDark);
    syncSystemBars(nearest);
  }

  function stepSpring(frameNow: number): void {
    rafId = null;
    if (isDragging) {
      lastFrameTime = frameNow;
      shell.classList.add('is-swiping');
      renderAtPos(currentPos);
      return;
    }
    const dt = lastFrameTime > 0 ? Math.min(32, Math.max(4, frameNow - lastFrameTime)) : 16.67;
    lastFrameTime = frameNow;
    const diff = targetDayIdx - currentPos;
    if (Math.abs(diff) > 0.0015) {
      const alpha = 1 - Math.pow(1 - 0.26, dt / 16.67);
      currentPos += diff * alpha;
      renderAtPos(currentPos);
      rafId = requestAnimationFrame(stepSpring);
    } else {
      lastFrameTime = 0;
      shell.classList.remove('is-swiping');
      currentPos = targetDayIdx;
      renderAtPos(currentPos);
    }
  }

  function glideToDay(idx: number): void {
    const clampedIdx = Math.max(0, Math.min(maxIdx, idx));
    targetDayIdx = clampedIdx;
    syncUrlHash(clampedIdx);

    if (checkIsReducedMotion()) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastFrameTime = 0;
      shell.classList.remove('is-swiping');
      currentPos = clampedIdx;
      renderAtPos(currentPos);
      return;
    }

    if (rafId === null) {
      lastFrameTime = performance.now();
      rafId = requestAnimationFrame(stepSpring);
    }
  }

  window.addEventListener('resize', () => {
    viewportWidth = shell.clientWidth || 400;
    stageWidth = stageFrame?.clientWidth || viewportWidth;
    renderAtPos(currentPos);
  });

  window.addEventListener('hashchange', () => {
    const hashIdx = parseDayHash(window.location.hash, dayCount);
    if (hashIdx !== null && hashIdx !== targetDayIdx) {
      glideToDay(hashIdx);
    }
  });

  // 1. Top Story Bar Scrub, Slot Click & Keyboard Button Activation
  let scrubId: number | null = null;
  const resolveSlotDay = (clientX: number, targetEl?: EventTarget | null): number => {
    const slotEl = closestElement(targetEl, '[data-day]');
    if (slotEl?.dataset.day !== undefined && (clientX === 0 || scrubId === null)) {
      return Number(slotEl.dataset.day);
    }
    const r = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.9999, (clientX - r.left) / Math.max(1, r.width)));
    return (ratio * dayCount) | 0;
  };

  const jumpImmediatelyToDay = (dayIdx: number): void => {
    isDragging = false;
    shell.classList.remove('is-swiping');
    currentPos = dayIdx;
    targetDayIdx = dayIdx;
    syncUrlHash(dayIdx);
    renderAtPos(dayIdx);
  };

  track.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button) return;
    e.stopPropagation();
    const day = resolveSlotDay(e.clientX, e.target);
    scrubId = e.pointerId;
    trySetPointerCapture(track, e.pointerId);
    jumpImmediatelyToDay(day);
  });

  track.addEventListener('pointermove', (e: PointerEvent) => {
    if (scrubId !== e.pointerId) return;
    jumpImmediatelyToDay(resolveSlotDay(e.clientX));
  });
  track.addEventListener('pointerup', () => {
    scrubId = null;
  });
  track.addEventListener('pointercancel', () => {
    scrubId = null;
  });

  // Keyboard activation (Enter / Space) on story-slot <button> elements triggers click with detail === 0
  track.addEventListener('click', (e: MouseEvent) => {
    if (e.detail !== 0) return;
    const slotEl = closestElement(e.target, '[data-day]');
    if (slotEl?.dataset.day !== undefined) {
      jumpImmediatelyToDay(Number(slotEl.dataset.day));
    }
  });

  // 2. Stage Swipe, Left/Right Tap, Item Map Links & Footer Google Maps Link
  let activeId: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragStart = 0;
  let isInFooter = false;
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

  renderer.cityscapeMapLinkEl.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    const settled = Math.round(currentPos);
    window.open(buildGoogleMapsUrl(daysData[settled].mapQuery), '_blank', 'noopener,noreferrer');
  });

  shell.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button || closestElement(e.target, '#story-bar-track')) return;
    activeId = e.pointerId;
    if (!closestElement(e.target, 'a[href]')) {
      trySetPointerCapture(shell, e.pointerId);
    }
    viewportWidth = shell.clientWidth || 400;
    stageWidth = stageFrame?.clientWidth || viewportWidth;
    isInFooter = e.clientY >= footerEl.getBoundingClientRect().top + 16;
    isDragging = true;
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
    if (rafId === null) {
      rafId = requestAnimationFrame(stepSpring);
    }
  });

  const endSwipe = (e: PointerEvent): void => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    isDragging = false;
    const dx = e.clientX - startX;
    const dist = Math.hypot(dx, e.clientY - startY);
    const settled = Math.round(dragStart);
    const targetAnchor = closestElement(e.target, 'a[href]');

    if (isHorizontal) {
      glideToDay(dx < -36 ? settled + 1 : dx > 36 ? settled - 1 : Math.round(currentPos));
    } else if (targetAnchor) {
      // Allow native <a> click handler to navigate without advancing day
      return;
    } else if (dist < 10 && performance.now() - lastTap > 200) {
      lastTap = performance.now();
      if (isInFooter) {
        window.open(
          buildGoogleMapsUrl(daysData[settled].mapQuery),
          '_blank',
          'noopener,noreferrer'
        );
      } else {
        const frameEl = stageFrame ?? shell;
        const relX = (e.clientX - frameEl.getBoundingClientRect().left) / stageWidth;
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

  renderAtPos(initialIdx);
  return { getCurrentDayFloat: () => currentPos, glideToDay };
}
