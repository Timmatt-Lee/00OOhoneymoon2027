import type { DayData } from '../types/schedule';

export interface RendererRefs {
  skyLayerEls: HTMLElement[];
  storySlotEls: HTMLElement[];
  schedulePanelEls: HTMLElement[];
  updateTopStoryBar(activeDayIdx: number, isDarkSky: boolean): void;
}

export function mountStageDOM(daysData: DayData[]): RendererRefs {
  const shellEl = document.getElementById('app-shell')!;
  const skyStack = document.getElementById('sky-stack')!;
  skyStack.innerHTML = daysData
    .map((d, idx) => `<div class="sky-layer" style="background:${d.skyGrad};opacity:${idx === 0 ? 1 : 0};visibility:${idx === 0 ? 'visible' : 'hidden'}"></div>`)
    .join('');
  const skyLayerEls = Array.from(skyStack.querySelectorAll<HTMLElement>('.sky-layer'));

  const track = document.getElementById('story-bar-track')!;
  track.innerHTML = daysData
    .map((_, idx) => `<div data-day="${idx}" class="story-slot"><div class="story-seg"></div></div>`)
    .join('');
  const storySlotEls = Array.from(track.querySelectorAll<HTMLElement>('.story-slot'));

  const stage = document.getElementById('schedule-stage')!;
  stage.innerHTML = daysData
    .map((d, dayIdx) => {
      const themeCls = d.isDark ? 'theme-dark' : 'theme-light';
      const rowsHtml = d.items
        .map((item) => `
          <div class="schedule-item-row">
            <div class="schedule-item-title ${themeCls}">${item.title}</div>
            ${item.subtitle ? `<div class="schedule-item-subtitle ${themeCls}">${item.subtitle}</div>` : ''}
          </div>`)
        .join('');
      return `<div class="day-schedule-panel" data-day="${dayIdx}" style="opacity:${dayIdx === 0 ? 1 : 0};transform:translate3d(${dayIdx === 0 ? 0 : 100}%,0,0)">${rowsHtml}</div>`;
    })
    .join('');
  const schedulePanelEls = Array.from(stage.querySelectorAll<HTMLElement>('.day-schedule-panel'));

  let lastTopBarDay = -1;
  let lastTopBarDark: boolean | null = null;

  function updateTopStoryBar(activeDayIdx: number, isDarkSky: boolean): void {
    if (activeDayIdx === lastTopBarDay && isDarkSky === lastTopBarDark) return;
    lastTopBarDay = activeDayIdx;
    lastTopBarDark = isDarkSky;

    shellEl.classList.toggle('theme-dark', isDarkSky);
    shellEl.classList.toggle('theme-light', !isDarkSky);

    storySlotEls.forEach((slot, i) => {
      const seg = slot.firstElementChild as HTMLElement;
      if (i === activeDayIdx) {
        const d = daysData[i];
        slot.className = 'story-slot is-active';
        seg.className = 'story-seg is-active-pill';
        seg.innerHTML = `<span class="pill-day-tag">Day ${d.day}</span><span>${d.label}</span>`;
      } else {
        slot.className = `story-slot ${i < activeDayIdx ? 'is-past' : 'is-future'}`;
        seg.className = 'story-seg';
        if (seg.innerHTML) seg.innerHTML = '';
      }
    });
  }

  return { skyLayerEls, storySlotEls, schedulePanelEls, updateTopStoryBar };
}
