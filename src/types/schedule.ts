export interface ScheduleItem {
  time: string;
  title: string;
  subtitle: string;
  mapQuery?: string;
}

export type PlaneAction = 'none' | 'arrive' | 'depart';

export interface RawSceneVisualPreset {
  day: number;
  date: string;
  csvFile: string;
  label: string;
  isDark: boolean;
  isSnowTinted: boolean;
  isOnsenSteam: boolean;
  isNightGlow: boolean;
  planeAction: PlaneAction;
  groupIdx: number;
  localIdx: number;
  mapQuery: string;
  skyGrad: string;
}

export interface SceneVisualPreset extends RawSceneVisualPreset {
  topSkyHex: string;
}

export interface DayData extends SceneVisualPreset {
  items: ScheduleItem[];
}

export interface SceneGroupConfig {
  groupIdx: number;
  startDay: number;
  endDay: number;
  panStepPx: number;
  widthPx: number;
}

export interface PresetsDocument {
  days: RawSceneVisualPreset[];
  sceneGroups: SceneGroupConfig[];
}
