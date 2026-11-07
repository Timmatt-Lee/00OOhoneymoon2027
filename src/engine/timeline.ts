import type { DayData } from '../types/schedule';

export function getEvenPct(index: number, count: number): number {
  if (count <= 1) return 50;
  return (Math.max(0, Math.min(index, count - 1)) / (count - 1)) * 100;
}

export interface TimelineController {
  renderInterpolation(dayIdxA: number, dayIdxB: number, t: number): void;
}

export function mountTimelineRail(daysData: DayData[]): TimelineController {
  const maxNodes = Math.max(1, ...daysData.map((d) => d.items.length));
  const container = document.getElementById('timeline-nodes-container')!;

  container.innerHTML = Array.from({ length: maxNodes }, () => `
    <div class="tl-node">
      <div class="tl-time-wrap">
        <span class="tl-time-label tl-time-a">00:00</span>
        <span class="tl-time-label tl-time-b" style="opacity:0">00:00</span>
      </div>
      <div class="tl-dot"></div>
    </div>`).join('');

  const nodeEls = Array.from(container.querySelectorAll<HTMLElement>('.tl-node'));

  return {
    renderInterpolation(dayIdxA: number, dayIdxB: number, t: number) {
      const itemsA = daysData[dayIdxA].items;
      const itemsB = daysData[dayIdxB].items;
      const countA = itemsA.length;
      const countB = itemsB.length;
      const maxCount = Math.max(countA, countB);

      for (let i = 0; i < maxNodes; i++) {
        const nodeEl = nodeEls[i];
        if (i >= maxCount) {
          nodeEl.style.setProperty('--node-opacity', '0');
          continue;
        }
        const curPct = getEvenPct(i, countA) * (1 - t) + getEvenPct(i, countB) * t;
        const inA = i < countA;
        const inB = i < countB;
        const opacity = inA && !inB ? 1 - t : !inA && inB ? t : 1;
        const scale = inA && !inB ? 1 - 0.25 * t : !inA && inB ? 0.75 + 0.25 * t : 1;

        nodeEl.style.setProperty('--node-top', `${curPct.toFixed(2)}%`);
        nodeEl.style.setProperty('--node-opacity', opacity.toFixed(3));
        nodeEl.style.setProperty('--dot-scale', scale.toFixed(2));

        const timeAEl = nodeEl.querySelector<HTMLElement>('.tl-time-a')!;
        const timeBEl = nodeEl.querySelector<HTMLElement>('.tl-time-b')!;
        const strA = itemsA[Math.min(i, countA - 1)].time;
        const strB = itemsB[Math.min(i, countB - 1)].time;

        if (timeAEl.textContent !== strA) timeAEl.textContent = strA;
        if (timeBEl.textContent !== strB) timeBEl.textContent = strB;
        timeAEl.style.opacity = strA === strB ? '1' : (1 - t).toFixed(3);
        timeBEl.style.opacity = strA === strB ? '0' : t.toFixed(3);
      }
    }
  };
}
