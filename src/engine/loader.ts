import Papa from 'papaparse';
import { z } from 'zod';
import rawThemes from '../content/day-themes.json';
import { extractTopSkyHex } from '../utils/themeColor';
import type { DayData, ScheduleItem, SceneGroupConfig } from '../types/schedule';

const RawScheduleRowSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be 24h HH:MM format'),
  title: z.string().min(1, 'Title cannot be empty'),
  subtitle: z.string().min(1, 'Subtitle cannot be empty'),
  mapQuery: z.string().optional()
});

const DayThemeSchema = z.object({
  day: z.number().int().min(1).max(12),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  csvFile: z.string().regex(/^\d{2}_\d{4}\.csv$/),
  label: z.string().min(1),
  isDark: z.boolean(),
  isSnowTinted: z.boolean(),
  isOnsenSteam: z.boolean(),
  isNightGlow: z.boolean(),
  planeAction: z.enum(['none', 'arrive', 'depart']),
  groupIdx: z.number().int().min(0).max(4),
  localIdx: z.number().int().min(0),
  mapQuery: z.string().min(1),
  skyGrad: z.string().min(10)
});

const SceneGroupSchema = z.object({
  groupIdx: z.number().int().min(0).max(4),
  startDay: z.number().int().min(0).max(11),
  endDay: z.number().int().min(0).max(11),
  panStepPx: z.number().min(0),
  widthPx: z.number().positive()
});

const ThemesDocumentSchema = z.object({
  days: z.array(DayThemeSchema).length(12),
  sceneGroups: z.array(SceneGroupSchema).length(5)
});

const VALID_CSV_HEADERS = new Set(['time,title,subtitle', 'time,title,subtitle,mapQuery']);

const rawCsvFiles = import.meta.glob<string>('../content/days/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true
});

export function parseAndValidateDayCsv(rawCsv: string, fileName: string): ScheduleItem[] {
  const normalized = rawCsv.replace(/\r\n/g, '\n').trim();
  const firstLine = normalized.split('\n')[0].trim();
  if (!VALID_CSV_HEADERS.has(firstLine)) {
    throw new Error(
      `[Schema Error] ${fileName} must start with exact header 'time,title,subtitle' or 'time,title,subtitle,mapQuery', got '${firstLine}'`
    );
  }

  const parsed = Papa.parse<Record<string, string>>(normalized, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(`[CSV Parse Error] ${fileName}: ${parsed.errors[0].message}`);
  }

  const validatedRows = z.array(RawScheduleRowSchema).min(1).parse(parsed.data);

  let prevMins = -1;
  return validatedRows.map((row, rowIdx) => {
    const [hh, mm] = row.time.split(':').map(Number);
    const totalMins = hh * 60 + mm;
    if (totalMins < prevMins) {
      throw new Error(
        `[Schema Error] ${fileName} row ${rowIdx + 2} time '${row.time}' is out of chronological order.`
      );
    }
    prevMins = totalMins;
    const trimmedMapQuery = row.mapQuery?.trim();
    return trimmedMapQuery
      ? { time: row.time, title: row.title, subtitle: row.subtitle, mapQuery: trimmedMapQuery }
      : { time: row.time, title: row.title, subtitle: row.subtitle };
  });
}

export function loadHoneymoonData(
  themesInput: unknown = rawThemes,
  csvRegistry: Record<string, string> = rawCsvFiles
): { daysData: DayData[]; sceneGroups: SceneGroupConfig[] } {
  const validatedDoc = ThemesDocumentSchema.parse(themesInput);

  const daysData: DayData[] = validatedDoc.days.map((theme) => {
    const matchKey = Object.keys(csvRegistry).find((k) => k.endsWith('/' + theme.csvFile));
    if (!matchKey) {
      throw new Error(`Missing CSV file: src/content/days/${theme.csvFile}`);
    }
    const items = parseAndValidateDayCsv(csvRegistry[matchKey], theme.csvFile);
    return {
      ...theme,
      topSkyHex: extractTopSkyHex(theme.skyGrad),
      items
    };
  });

  return {
    daysData,
    sceneGroups: validatedDoc.sceneGroups
  };
}
