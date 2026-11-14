import type { DayData } from '../types/schedule';
import { getRequiredElementById } from '../utils/dom';

export interface TimelineController {
  renderInterpolation(dayIdxA: number, dayIdxB: number, t: number): void;
}

interface CachedTimelineNode {
  nodeEl: HTMLDivElement;
  timeAEl: HTMLSpanElement;
  timeBEl: HTMLSpanElement;
  lastY: number;
  lastOp: string;
  lastStrA: string;
  lastStrB: string;
  lastOpA: string;
  lastOpB: string;
}

export function mountTimelineRail(daysData: DayData[]): TimelineController {
  const maxNodeCount = Math.max(1, ...daysData.map((d) => d.items.length));
  const container = getRequiredElementById('timeline-nodes-container');
  container.replaceChildren();

  const cachedNodes: CachedTimelineNode[] = Array.from({ length: maxNodeCount }, () => {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'tl-node';

    const wrapEl = document.createElement('div');
    wrapEl.className = 'tl-time-wrap';

    const timeAEl = document.createElement('span');
    timeAEl.className = 'tl-time-label tl-time-a';
    timeAEl.textContent = '00:00';

    const timeBEl = document.createElement('span');
    timeBEl.className = 'tl-time-label tl-time-b';
    timeBEl.style.opacity = '0';
    timeBEl.textContent = '00:00';

    const dotEl = document.createElement('div');
    dotEl.className = 'tl-dot';

    wrapEl.append(timeAEl, timeBEl);
    nodeEl.append(wrapEl, dotEl);
    container.appendChild(nodeEl);

    return {
      nodeEl,
      timeAEl,
      timeBEl,
      lastY: -9999,
      lastOp: '',
      lastStrA: '',
      lastStrB: '',
      lastOpA: '',
      lastOpB: ''
    };
  });

  let railHeight = container.clientHeight || 460;
  let lastDayA = 0;
  let lastDayB = 0;
  let lastT = 0;

  function renderInterpolation(dayIdxA: number, dayIdxB: number, t: number): void {
    lastDayA = dayIdxA;
    lastDayB = dayIdxB;
    lastT = t;

    const itemsA = daysData[dayIdxA].items;
    const itemsB = daysData[dayIdxB].items;
    const itemACount = itemsA.length;
    const itemBCount = itemsB.length;
    const maxItemCount = Math.max(itemACount, itemBCount);
    const denomA = Math.max(1, itemACount - 1);
    const denomB = Math.max(1, itemBCount - 1);

    for (let i = 0; i < maxNodeCount; i++) {
      const n = cachedNodes[i];
      if (i >= maxItemCount) {
        if (n.lastOp !== '0') {
          n.nodeEl.style.opacity = '0';
          n.lastOp = '0';
        }
        continue;
      }
      const ratioA = Math.min(i, itemACount - 1) / denomA;
      const ratioB = Math.min(i, itemBCount - 1) / denomB;
      const curRatio = ratioA + (ratioB - ratioA) * t;
      const yPx = curRatio * railHeight;

      const isOnlyInA = i < itemACount && i >= itemBCount;
      const isOnlyInB = i >= itemACount;
      const opacityStr = (isOnlyInA ? 1 - t : isOnlyInB ? t : 1).toFixed(3);

      if (Math.abs(yPx - n.lastY) > 0.05) {
        n.nodeEl.style.transform = `translate3d(0, ${yPx.toFixed(1)}px, 0)`;
        n.lastY = yPx;
      }
      if (n.lastOp !== opacityStr) {
        n.nodeEl.style.opacity = opacityStr;
        n.lastOp = opacityStr;
      }

      const strA = itemsA[Math.min(i, itemACount - 1)].time;
      const strB = itemsB[Math.min(i, itemBCount - 1)].time;

      if (n.lastStrA !== strA) {
        n.timeAEl.textContent = strA;
        n.lastStrA = strA;
      }
      if (n.lastStrB !== strB) {
        n.timeBEl.textContent = strB;
        n.lastStrB = strB;
      }

      const isSingleLabel = isOnlyInA || isOnlyInB || strA === strB;
      const opA = isOnlyInB ? '0' : isSingleLabel ? '1' : (1 - t).toFixed(3);
      const opB = isOnlyInB ? '1' : isSingleLabel ? '0' : t.toFixed(3);
      if (n.lastOpA !== opA) {
        n.timeAEl.style.opacity = opA;
        n.lastOpA = opA;
      }
      if (n.lastOpB !== opB) {
        n.timeBEl.style.opacity = opB;
        n.lastOpB = opB;
      }
    }
  }

  window.addEventListener('resize', () => {
    railHeight = container.clientHeight || 460;
    renderInterpolation(lastDayA, lastDayB, lastT);
  });

  return { renderInterpolation };
}
