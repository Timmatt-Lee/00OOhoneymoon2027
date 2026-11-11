const TOKYO_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const DAY_HASH_PATTERN = /^#day-(\d{1,2})$/i;

export function formatTokyoDate(date: Date): string {
  const parts = TOKYO_DATE_FORMATTER.formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    else if (part.type === 'month') month = part.value;
    else if (part.type === 'day') day = part.value;
  }
  return `${year}-${month}-${day}`;
}

export function parseDayHash(hash: string, dayCount: number): number | null {
  const match = DAY_HASH_PATTERN.exec(hash.trim());
  if (!match) {
    return null;
  }
  const parsedDay = Number(match[1]);
  if (parsedDay < 1 || parsedDay > dayCount) {
    return null;
  }
  return parsedDay - 1;
}

export function formatDayHash(dayIdx: number): string {
  return `#day-${dayIdx + 1}`;
}

export function resolveInitialDayIndex(
  daysData: readonly { date: string }[],
  hash: string,
  now: Date = new Date()
): number {
  const fromHash = parseDayHash(hash, daysData.length);
  if (fromHash !== null) {
    return fromHash;
  }
  const tokyoToday = formatTokyoDate(now);
  const matchedIdx = daysData.findIndex((d) => d.date === tokyoToday);
  return matchedIdx >= 0 ? matchedIdx : 0;
}
