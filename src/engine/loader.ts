import rawThemes from '../content/day-themes.json';
import { extractTopSkyHex } from '../utils/themeColor';
import type {
  DayData,
  PlaneAction,
  PresetsDocument,
  RawSceneVisualPreset,
  ScheduleItem,
  SceneGroupConfig
} from '../types/schedule';

const VALID_CSV_HEADERS = new Set(['time,title,subtitle', 'time,title,subtitle,mapQuery']);
const TIME_24H_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CSV_FILENAME_PATTERN = /^\d{2}_\d{4}\.csv$/;
const VALID_PLANE_ACTIONS = new Set<string>(['none', 'arrive', 'depart']);

const rawCsvFiles = import.meta.glob<string>('../content/days/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true
});

function checkIsRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function checkIsIntInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= min && val <= max;
}

function checkIsFiniteMin(val: unknown, min: number): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= min;
}

function checkIsNonEmptyString(val: unknown, minLen = 1): val is string {
  return typeof val === 'string' && val.length >= minLen;
}

function checkMatchesPattern(val: unknown, pattern: RegExp): val is string {
  return typeof val === 'string' && pattern.test(val);
}

function checkIsPlaneAction(val: unknown): val is PlaneAction {
  return typeof val === 'string' && VALID_PLANE_ACTIONS.has(val);
}

export function parseRfc4180CsvRows(csvText: string, fileName: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let isInQuotes = false;
  let isAfterClosingQuote = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (isInQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          isInQuotes = false;
          isAfterClosingQuote = true;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (isAfterClosingQuote && ch !== ',' && ch !== '\n') {
      throw new Error(`[CSV Parse Error] ${fileName}: unexpected character after closing quote.`);
    }

    if (ch === '"') {
      if (currentField.length > 0) {
        throw new Error(`[CSV Parse Error] ${fileName}: unexpected quote inside unquoted field.`);
      }
      isInQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
      isAfterClosingQuote = false;
    } else if (ch === '\n') {
      currentRow.push(currentField);
      currentField = '';
      isAfterClosingQuote = false;
      const isBlankSingleCell = currentRow.length === 1 && currentRow[0].trim() === '';
      if (!isBlankSingleCell) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += ch;
    }
  }

  if (isInQuotes) {
    throw new Error(`[CSV Parse Error] ${fileName}: unclosed quoted field.`);
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    const isBlankTrailing = currentRow.length === 1 && currentRow[0].trim() === '';
    if (!isBlankTrailing) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function validateDayTheme(raw: unknown, index: number): RawSceneVisualPreset {
  if (!checkIsRecord(raw)) {
    throw new Error(`[Schema Error] days[${index}] must be an object.`);
  }
  const {
    day,
    date,
    csvFile,
    label,
    isDark,
    isSnowTinted,
    isOnsenSteam,
    isNightGlow,
    planeAction,
    groupIdx,
    localIdx,
    mapQuery,
    skyGrad
  } = raw;

  const isValidFields = [
    checkIsIntInRange(day, 1, 12),
    checkMatchesPattern(date, ISO_DATE_PATTERN),
    checkMatchesPattern(csvFile, CSV_FILENAME_PATTERN),
    checkIsNonEmptyString(label),
    typeof isDark === 'boolean',
    typeof isSnowTinted === 'boolean',
    typeof isOnsenSteam === 'boolean',
    typeof isNightGlow === 'boolean',
    checkIsPlaneAction(planeAction),
    checkIsIntInRange(groupIdx, 0, 4),
    checkIsIntInRange(localIdx, 0, 11),
    checkIsNonEmptyString(mapQuery),
    checkIsNonEmptyString(skyGrad, 10)
  ].every(Boolean);

  if (!isValidFields) {
    throw new Error(`[Schema Error] days[${index}] failed theme schema validation.`);
  }

  return {
    day: day as number,
    date: date as string,
    csvFile: csvFile as string,
    label: label as string,
    isDark: isDark as boolean,
    isSnowTinted: isSnowTinted as boolean,
    isOnsenSteam: isOnsenSteam as boolean,
    isNightGlow: isNightGlow as boolean,
    planeAction: planeAction as PlaneAction,
    groupIdx: groupIdx as number,
    localIdx: localIdx as number,
    mapQuery: mapQuery as string,
    skyGrad: skyGrad as string
  };
}

function validateSceneGroup(raw: unknown, index: number): SceneGroupConfig {
  if (!checkIsRecord(raw)) {
    throw new Error(`[Schema Error] sceneGroups[${index}] must be an object.`);
  }
  const { groupIdx, startDay, endDay, panStepPx, widthPx } = raw;
  const isValidGroup = [
    checkIsIntInRange(groupIdx, 0, 4),
    checkIsIntInRange(startDay, 0, 11),
    checkIsIntInRange(endDay, 0, 11),
    checkIsFiniteMin(panStepPx, 0),
    checkIsFiniteMin(widthPx, Number.MIN_VALUE)
  ].every(Boolean);

  if (!isValidGroup) {
    throw new Error(`[Schema Error] sceneGroups[${index}] failed sceneGroup validation.`);
  }
  return {
    groupIdx: groupIdx as number,
    startDay: startDay as number,
    endDay: endDay as number,
    panStepPx: panStepPx as number,
    widthPx: widthPx as number
  };
}

function validateThemesDocument(input: unknown): PresetsDocument {
  if (!checkIsRecord(input)) {
    throw new Error('[Schema Error] day-themes.json root must be an object.');
  }
  if (!Array.isArray(input.days) || input.days.length !== 12) {
    throw new Error('[Schema Error] day-themes.json must contain exactly 12 days.');
  }
  if (!Array.isArray(input.sceneGroups) || input.sceneGroups.length !== 5) {
    throw new Error('[Schema Error] day-themes.json must contain exactly 5 sceneGroups.');
  }
  return {
    days: input.days.map((item, idx) => validateDayTheme(item, idx)),
    sceneGroups: input.sceneGroups.map((grp, idx) => validateSceneGroup(grp, idx))
  };
}

export function parseAndValidateDayCsv(rawCsv: string, fileName: string): ScheduleItem[] {
  const normalized = rawCsv.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const firstLine = normalized.trimStart().split('\n')[0].trim();
  if (!VALID_CSV_HEADERS.has(firstLine)) {
    throw new Error(
      `[Schema Error] ${fileName} must start with exact header 'time,title,subtitle' or 'time,title,subtitle,mapQuery', got '${firstLine}'`
    );
  }

  const rows = parseRfc4180CsvRows(normalized.trimStart(), fileName);
  const expectedColCount = rows[0].length;
  if (rows.length < 2) {
    throw new Error(`[Schema Error] ${fileName} must contain at least one schedule row.`);
  }

  let prevMinuteOfDay = -1;
  return rows.slice(1).map((cells, rowIdx) => {
    if (cells.length !== expectedColCount) {
      throw new Error(
        `[CSV Parse Error] ${fileName} row ${rowIdx + 2}: expected ${expectedColCount} columns, got ${cells.length}.`
      );
    }

    const [time, title, subtitle] = cells;
    const rawMapQuery = expectedColCount === 4 ? cells[3] : undefined;

    if (!TIME_24H_PATTERN.test(time)) {
      throw new Error(
        `[Schema Error] ${fileName} row ${rowIdx + 2}: Time must be 24h HH:MM format, got '${time}'.`
      );
    }
    if (!checkIsNonEmptyString(title) || !checkIsNonEmptyString(subtitle)) {
      throw new Error(
        `[Schema Error] ${fileName} row ${rowIdx + 2}: Title and subtitle cannot be empty.`
      );
    }

    const [hh, mm] = time.split(':').map(Number);
    const minuteOfDay = hh * 60 + mm;
    if (minuteOfDay <= prevMinuteOfDay) {
      throw new Error(
        `[Schema Error] ${fileName} row ${rowIdx + 2} time '${time}' is out of chronological order.`
      );
    }
    prevMinuteOfDay = minuteOfDay;

    const trimmedMapQuery = rawMapQuery?.trim();
    return trimmedMapQuery
      ? { time, title, subtitle, mapQuery: trimmedMapQuery }
      : { time, title, subtitle };
  });
}

export function loadHoneymoonData(
  themesInput: unknown = rawThemes,
  csvRegistry: Record<string, string> = rawCsvFiles
): { daysData: DayData[]; sceneGroups: SceneGroupConfig[] } {
  const validatedDoc = validateThemesDocument(themesInput);

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
