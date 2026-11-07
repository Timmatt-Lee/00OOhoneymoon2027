import type { DayData } from '../types/schedule';
import { getEvenPct } from './timeline';

export interface RendererRefs {
  skyLayerEls: HTMLElement[];
  storySlotEls: HTMLElement[];
  schedulePanelEls: HTMLElement[];
  updateTopStoryBar(activeDayIdx: number, isDarkSky: boolean): void;
}

export function mountStageDOM(daysData: DayData[]): RendererRefs {
  const skyStack = document.getElementById('sky-stack')!;
  skyStack.innerHTML = daysData
    .map(
      (d, idx) =>
        `<div class="sky-layer" style="background: ${d.skyGrad}; opacity: ${idx === 0 ? 1 : 0}; visibility: ${idx === 0 ? 'visible' : 'hidden'};"></div>`
    )
    .join('');
  const skyLayerEls = Array.from(skyStack.querySelectorAll<HTMLElement>('.sky-layer'));

  const track = document.getElementById('story-bar-track')!;
  track.innerHTML = daysData
    .map(
      (_, idx) => `
      <div data-day="${idx}" class="story-slot">
        <div class="story-seg"></div>
      </div>
    `
    )
    .join('');
  const storySlotEls = Array.from(track.querySelectorAll<HTMLElement>('.story-slot'));

  const stage = document.getElementById('schedule-stage')!;
  stage.innerHTML = daysData
    .map((d, dayIdx) => {
      const count = d.items.length;
      const themeCls = d.isDark ? 'theme-dark' : 'theme-light';
      const sizeCls = count >= 8 ? 'size-dense' : count === 7 ? 'size-compact' : 'size-normal';

      const rowsHtml = d.items
        .map((item, i) => {
          const pct = getEvenPct(i, count).toFixed(2);
          return `
            <div class="schedule-item-row" style="top: ${pct}%;">
              <div class="schedule-item-title ${sizeCls} ${themeCls}">${item.title}</div>
              ${item.subtitle ? `<div class="schedule-item-subtitle ${sizeCls} ${themeCls}">${item.subtitle}</div>` : ''}
            </div>
          `;
        })
        .join('');

      return `
        <div class="day-schedule-panel" data-day="${dayIdx}"
             style="opacity: ${dayIdx === 0 ? 1 : 0}; transform: translate3d(${dayIdx === 0 ? 0 : 100}%, 0, 0);">
          ${rowsHtml}
        </div>
      `;
    })
    .join('');
  const schedulePanelEls = Array.from(stage.querySelectorAll<HTMLElement>('.day-schedule-panel'));

  let lastTopBarDay = -1;
  let lastTopBarDark: boolean | null = null;

  function updateTopStoryBar(activeDayIdx: number, isDarkSky: boolean): void {
    if (activeDayIdx === lastTopBarDay && isDarkSky === lastTopBarDark) return;
    lastTopBarDay = activeDayIdx;
    lastTopBarDark = isDarkSky;

    for (let i = 0; i < storySlotEls.length; i++) {
      const slot = storySlotEls[i];
      const seg = slot.firstElementChild as HTMLElement;
      if (i === activeDayIdx) {
        const d = daysData[i];
        slot.className = 'story-slot is-active';
        seg.className = 'story-seg is-active-pill';
        seg.style.cssText = '';
        seg.innerHTML = `<span class="pill-day-tag">Day ${d.day}</span><span>${d.label}</span>`;
      } else {
        slot.className = 'story-slot';
        seg.className = 'story-seg';
        if (isDarkSky) {
          seg.style.cssText =
            i < activeDayIdx
              ? 'background: rgba(255, 255, 255, 0.85); border: 1px solid rgba(255, 255, 255, 0.95); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);'
              : 'background: rgba(255, 255, 255, 0.55); border: 1px solid rgba(255, 255, 255, 0.88); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);';
        } else {
          seg.style.cssText =
            i < activeDayIdx
              ? 'background: rgba(15, 23, 42, 0.50); border: 1px solid rgba(255, 255, 255, 0.9);'
              : 'background: rgba(30, 41, 59, 0.28); border: 1px solid rgba(255, 255, 255, 0.8);';
        }
        if (seg.innerHTML !== '') seg.innerHTML = '';
      }
    }
  }

  return { skyLayerEls, storySlotEls, schedulePanelEls, updateTopStoryBar };
}
