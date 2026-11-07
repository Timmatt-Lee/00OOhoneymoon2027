import type { DayData } from '../types/schedule';

export function getEvenPct(index: number, count: number): number {
  if (count <= 1) return 50;
  const clampedIdx = Math.min(index, count - 1);
  return (clampedIdx / (count - 1)) * 100;
}

export interface TimelineController {
  renderInterpolation(dayIdxA: number, dayIdxB: number, t: number): void;
}

export function mountTimelineRail(daysData: DayData[]): TimelineController {
  const maxNodes = Math.max(1, ...daysData.map((d) => d.items.length));
  const lineEl = document.getElementById('timeline-line');
  const container = document.getElementById('timeline-nodes-container')!;

  let html = '';
  for (let i = 0; i < maxNodes; i++) {
    html += `
      <div class="tl-node" style="top: 0%; opacity: 0;">
        <div class="tl-time-wrap">
          <span class="tl-time-label tl-time-a">00:00</span>
          <span class="tl-time-label tl-time-b" style="opacity: 0;">00:00</span>
        </div>
        <div class="tl-dot"></div>
      </div>
    `;
  }
  container.innerHTML = html;
  const nodeEls = Array.from(container.querySelectorAll<HTMLElement>('.tl-node'));

  return {
    renderInterpolation(dayIdxA: number, dayIdxB: number, t: number) {
      const dayA = daysData[dayIdxA];
      const dayB = daysData[dayIdxB];
      const itemsA = dayA.items;
      const itemsB = dayB.items;
      const countA = itemsA.length;
      const countB = itemsB.length;
      const maxCount = Math.max(countA, countB);

      const useDarkTheme = t < 0.5 ? dayA.isDark : dayB.isDark;
      if (lineEl) {
        lineEl.style.backgroundColor = useDarkTheme
          ? 'rgba(255, 255, 255, 0.38)'
          : 'rgba(15, 23, 42, 0.28)';
      }

      const textColor = useDarkTheme ? '#FFFFFF' : '#0F172A';
      const dotBg = useDarkTheme ? '#F43F5E' : '#0F172A';
      const timeShadow = useDarkTheme ? '0 1px 6px rgba(0,0,0,0.55)' : '0 1px 6px rgba(255,255,255,0.9)';

      for (let i = 0; i < maxNodes; i++) {
        const nodeEl = nodeEls[i];
        if (i >= maxCount) {
          nodeEl.style.opacity = '0';
          continue;
        }

        const pctA = getEvenPct(i, countA);
        const pctB = getEvenPct(i, countB);
        const curPct = pctA + (pctB - pctA) * t;

        const existsInA = i < countA;
        const existsInB = i < countB;
        let nodeOpacity = 1;
        let scale = 1;
        if (existsInA && !existsInB) {
          nodeOpacity = 1 - t;
          scale = 1 - 0.25 * t;
        } else if (!existsInA && existsInB) {
          nodeOpacity = t;
          scale = 0.75 + 0.25 * t;
        }

        nodeEl.style.top = `${curPct.toFixed(2)}%`;
        nodeEl.style.opacity = nodeOpacity.toFixed(3);

        const timeAEl = nodeEl.querySelector<HTMLElement>('.tl-time-a')!;
        const timeBEl = nodeEl.querySelector<HTMLElement>('.tl-time-b')!;
        const dotEl = nodeEl.querySelector<HTMLElement>('.tl-dot')!;

        const strA = itemsA[Math.min(i, countA - 1)].time;
        const strB = itemsB[Math.min(i, countB - 1)].time;

        if (timeAEl.textContent !== strA) timeAEl.textContent = strA;
        if (timeBEl.textContent !== strB) timeBEl.textContent = strB;

        timeAEl.style.color = textColor;
        timeBEl.style.color = textColor;
        timeAEl.style.textShadow = timeShadow;
        timeBEl.style.textShadow = timeShadow;

        if (strA === strB) {
          timeAEl.style.opacity = '1';
          timeBEl.style.opacity = '0';
        } else {
          timeAEl.style.opacity = (1 - t).toFixed(3);
          timeBEl.style.opacity = t.toFixed(3);
        }

        dotEl.style.backgroundColor = dotBg;
        dotEl.style.border = '2px solid #FFFFFF';
        dotEl.style.transform = `scale(${scale.toFixed(2)})`;
      }
    }
  };
}
