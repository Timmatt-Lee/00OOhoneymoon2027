import './styles/main.scss';
import { loadHoneymoonData } from './engine/loader';
import { mountStageDOM } from './engine/renderer';
import { mountTimelineRail } from './engine/timeline';
import { mountParallaxScenes } from './engine/parallax';
import { bindGesturesAndPhysics } from './engine/gestures';
import { startParticleStage } from './effects/particleStage';

function bootstrap(): void {
  const { daysData, sceneGroups } = loadHoneymoonData();
  const renderer = mountStageDOM(daysData);
  const timeline = mountTimelineRail(daysData);
  const parallax = mountParallaxScenes(daysData, sceneGroups);
  const gestures = bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
  startParticleStage(() => gestures.getCurrentDayFloat());
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
