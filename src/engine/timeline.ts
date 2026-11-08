import type { DayData } from '../types/schedule';

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

  let railHeight = container.clientHeight || 460;
  window.addEventListener('resize', () => {
    railHeight = container.clientHeight || 460;
  });

  const cachedNodes = Array.from(container.querySelectorAll<HTMLElement>('.tl-node')).map((nodeEl) => ({
    nodeEl,
    dotEl: nodeEl.querySelector<HTMLElement>('.tl-dot')!,
    timeAEl: nodeEl.querySelector<HTMLElement>('.tl-time-a')!,
    timeBEl: nodeEl.querySelector<HTMLElement>('.tl-time-b')!,
    lastY: -9999,
    lastOp: '',
    lastScale: '',
    lastStrA: '',
    lastStrB: '',
    lastOpA: '',
    lastOpB: ''
  }));

  return {
    renderInterpolation(dayIdxA: number, dayIdxB: number, t: number) {
      if (railHeight <= 0) railHeight = container.clientHeight || 460;
      const itemsA = daysData[dayIdxA].items;
      const itemsB = daysData[dayIdxB].items;
      const countA = itemsA.length;
      const countB = itemsB.length;
      const maxCount = Math.max(countA, countB);
      const denomA = Math.max(1, countA - 1);
      const denomB = Math.max(1, countB - 1);

      for (let i = 0; i < maxNodes; i++) {
        const n = cachedNodes[i];
        if (i >= maxCount) {
          if (n.lastOp !== '0') {
            n.nodeEl.style.opacity = '0';
            n.lastOp = '0';
          }
          continue;
        }
        const ratioA = Math.min(i, countA - 1) / denomA;
        const ratioB = Math.min(i, countB - 1) / denomB;
        const curRatio = ratioA + (ratioB - ratioA) * t;
        const yPx = curRatio * railHeight;

        const inA = i < countA;
        const inB = i < countB;
        const opacityStr = (inA && !inB ? 1 - t : !inA && inB ? t : 1).toFixed(3);
        const scaleStr = (inA && !inB ? 1 - 0.25 * t : !inA && inB ? 0.75 + 0.25 * t : 1).toFixed(2);

        if (Math.abs(yPx - n.lastY) > 0.05) {
          n.nodeEl.style.transform = `translate3d(0, ${yPx.toFixed(1)}px, 0)`;
          n.lastY = yPx;
        }
        if (n.lastOp !== opacityStr) {
          n.nodeEl.style.opacity = opacityStr;
          n.lastOp = opacityStr;
        }
        if (n.lastScale !== scaleStr) {
          n.dotEl.style.transform = `scale(${scaleStr})`;
          n.lastScale = scaleStr;
        }

        const strA = itemsA[Math.min(i, countA - 1)].time;
        const strB = itemsB[Math.min(i, countB - 1)].time;

        if (n.lastStrA !== strA) {
          n.timeAEl.textContent = strA;
          n.lastStrA = strA;
        }
        if (n.lastStrB !== strB) {
          n.timeBEl.textContent = strB;
          n.lastStrB = strB;
        }

        const opA = strA === strB ? '1' : (1 - t).toFixed(3);
        const opB = strA === strB ? '0' : t.toFixed(3);
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
  };
}
