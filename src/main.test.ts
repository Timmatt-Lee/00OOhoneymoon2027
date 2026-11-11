import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrap, initWhenReady } from './main';

describe('application bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <meta id="theme-color-meta" content="#070B19" />
      <div id="app-shell" class="theme-dark">
        <div id="sky-stack"></div>
        <canvas id="fx-canvas"></canvas>
        <div id="stage-frame">
          <header id="top-header"><nav id="story-bar-track"></nav></header>
          <div id="timeline-rail"><div id="timeline-line"></div><div id="timeline-nodes-container"></div></div>
          <main id="schedule-stage"></main>
        </div>
        <footer id="cityscape-footer">
          <div id="scene-groups-container"></div>
          <div id="snow-ground-slot"></div>
          <a id="cityscape-map-link" href="#"></a>
        </footer>
      </div>
    `;
  });

  it('bootstraps immediately when DOM is ready and defers to DOMContentLoaded when loading', () => {
    initWhenReady({ readyState: 'complete' }, window);
    expect(document.querySelectorAll('.story-slot')).toHaveLength(12);

    const addListenerSpy = vi.fn();
    initWhenReady({ readyState: 'loading' }, { addEventListener: addListenerSpy });
    expect(addListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', bootstrap);
  });
});
