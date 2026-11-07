import type { DayData, GroupLayerElements, SceneGroupConfig } from '../types/schedule';
import group0Bg from '../assets/scenes/group0-bg.svg?raw';
import group0Mid from '../assets/scenes/group0-mid.svg?raw';
import group0Fg from '../assets/scenes/group0-fg.svg?raw';
import group1Bg from '../assets/scenes/group1-bg.svg?raw';
import group1Mid from '../assets/scenes/group1-mid.svg?raw';
import group1Fg from '../assets/scenes/group1-fg.svg?raw';
import group2Bg from '../assets/scenes/group2-bg.svg?raw';
import group2Mid from '../assets/scenes/group2-mid.svg?raw';
import group2Fg from '../assets/scenes/group2-fg.svg?raw';
import group3Bg from '../assets/scenes/group3-bg.svg?raw';
import group3Mid from '../assets/scenes/group3-mid.svg?raw';
import group3Fg from '../assets/scenes/group3-fg.svg?raw';
import group4Bg from '../assets/scenes/group4-bg.svg?raw';
import group4Mid from '../assets/scenes/group4-mid.svg?raw';
import group4Fg from '../assets/scenes/group4-fg.svg?raw';
import jetlinerArriveSvg from '../assets/scenes/jetliner-arrive.svg?raw';
import jetlinerDepartSvg from '../assets/scenes/jetliner-depart.svg?raw';
import snowGroundSvg from '../assets/scenes/snow-ground.svg?raw';

const GROUP_SVG_ASSETS = [
  { bg: group0Bg, mid: group0Mid, fg: group0Fg, planeId: 'day1-arriving-plane', planeCls: 'plane-arrive', planeSvg: jetlinerArriveSvg },
  { bg: group1Bg, mid: group1Mid, fg: group1Fg, planeId: null, planeCls: '', planeSvg: '' },
  { bg: group2Bg, mid: group2Mid, fg: group2Fg, planeId: null, planeCls: '', planeSvg: '' },
  { bg: group3Bg, mid: group3Mid, fg: group3Fg, planeId: null, planeCls: '', planeSvg: '' },
  { bg: group4Bg, mid: group4Mid, fg: group4Fg, planeId: 'day12-departing-plane', planeCls: 'plane-depart', planeSvg: jetlinerDepartSvg }
];

export interface ParallaxController {
  renderParallax(clamped: number, idxA: number, idxB: number, t: number, viewportWidth: number): void;
}

export function mountParallaxScenes(daysData: DayData[], sceneGroups: SceneGroupConfig[]): ParallaxController {
  const snowSlot = document.getElementById('snow-ground-slot');
  if (snowSlot) {
    snowSlot.innerHTML = snowGroundSvg;
  }

  const container = document.getElementById('scene-groups-container')!;
  container.innerHTML = sceneGroups
    .map((grp, idx) => {
      const assets = GROUP_SVG_ASSETS[idx];
      const w = `${grp.widthPx}px`;
      const planeHtml = assets.planeId
        ? `<div id="${assets.planeId}" class="plane-actor ${assets.planeCls}">${assets.planeSvg}</div>`
        : '';
      return `
        <div class="scene-group-clip" data-group="${grp.groupIdx}">
          <div class="parallax-layer parallax-bg" style="width: ${w};">${assets.bg}</div>
          <div class="parallax-layer parallax-mid" style="width: ${w};">${assets.mid}</div>
          <div class="parallax-layer parallax-fg" style="width: ${w};">${assets.fg}</div>
          ${planeHtml}
        </div>
      `;
    })
    .join('');

  const groupClipEls = Array.from(container.querySelectorAll<HTMLElement>('.scene-group-clip'));
  const groupLayersMap: GroupLayerElements[] = groupClipEls.map((clipEl) => ({
    bg: clipEl.querySelector<HTMLElement>('.parallax-bg'),
    mid: clipEl.querySelector<HTMLElement>('.parallax-mid'),
    fg: clipEl.querySelector<HTMLElement>('.parallax-fg')
  }));

  const day1PlaneEl = document.getElementById('day1-arriving-plane');
  const day12PlaneEl = document.getElementById('day12-departing-plane');

  return {
    renderParallax(clamped, idxA, idxB, t, viewportWidth) {
      const groupA = daysData[idxA].groupIdx;
      const groupB = daysData[idxB].groupIdx;

      for (let g = 0; g < sceneGroups.length; g++) {
        const grp = sceneGroups[g];
        const clipEl = groupClipEls[g];
        const layers = groupLayersMap[g];

        let clipX = 0;
        let localDayOffset = 0;
        let visible = true;

        if (groupA === groupB) {
          if (g === groupA) {
            clipX = 0;
            localDayOffset = clamped - grp.startDay;
          } else {
            visible = false;
          }
        } else {
          if (g === groupA) {
            clipX = -t * viewportWidth;
            localDayOffset = idxA - grp.startDay;
          } else if (g === groupB) {
            clipX = (1 - t) * viewportWidth;
            localDayOffset = idxB - grp.startDay;
          } else {
            visible = false;
          }
        }

        if (!visible) {
          if (clipEl.style.visibility !== 'hidden') {
            clipEl.style.visibility = 'hidden';
            clipEl.style.transform = `translate3d(${viewportWidth * 1.2}px, 0, 0)`;
          }
        } else {
          if (clipEl.style.visibility !== 'visible') clipEl.style.visibility = 'visible';
          clipEl.style.transform = `translate3d(${clipX.toFixed(1)}px, 0, 0)`;
          const shift = -localDayOffset * grp.panStepPx;
          if (layers.bg) layers.bg.style.transform = `translate3d(${(shift * 0.38).toFixed(1)}px, 0, 0)`;
          if (layers.mid) layers.mid.style.transform = `translate3d(${(shift * 0.68).toFixed(1)}px, 0, 0)`;
          if (layers.fg) layers.fg.style.transform = `translate3d(${(shift * 1.0).toFixed(1)}px, 0, 0)`;
        }
      }

      if (day1PlaneEl) {
        if (clamped <= 1.2) {
          const p = Math.max(0, Math.min(1, clamped));
          const px = (-p * 240).toFixed(1);
          const py = (-p * 60).toFixed(1);
          const op = Math.max(0, 1 - p * 1.05).toFixed(3);
          day1PlaneEl.style.opacity = op;
          day1PlaneEl.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(-7deg)`;
        } else if (day1PlaneEl.style.opacity !== '0') {
          day1PlaneEl.style.opacity = '0';
        }
      }

      if (day12PlaneEl) {
        if (clamped >= 9.8) {
          const p = Math.max(0, Math.min(1, clamped - 10));
          const px = ((1 - p) * 240).toFixed(1);
          const py = ((1 - p) * 28).toFixed(1);
          const op = Math.max(0, Math.min(1, p * 1.15)).toFixed(3);
          day12PlaneEl.style.opacity = op;
          day12PlaneEl.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(-13deg)`;
        } else if (day12PlaneEl.style.opacity !== '0') {
          day12PlaneEl.style.opacity = '0';
        }
      }
    }
  };
}
