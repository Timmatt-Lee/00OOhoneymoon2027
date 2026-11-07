export interface ScheduleItem {
  time: string;
  title: string;
  subtitle: string;
}

export interface SceneVisualPreset {
  day: number;
  csvFile: string;
  label: string;
  isDark: boolean;
  groupIdx: number;
  localIdx: number;
  mapQuery: string;
  skyGrad: string;
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
  days: SceneVisualPreset[];
  sceneGroups: SceneGroupConfig[];
}

export interface GroupLayerElements {
  bg: HTMLElement | null;
  mid: HTMLElement | null;
  fg: HTMLElement | null;
}
