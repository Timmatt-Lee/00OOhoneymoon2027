import { describe, it, expect } from 'vitest';
import { formatTokyoDate, parseDayHash, formatDayHash, resolveInitialDayIndex } from './tripDate';

const MOCK_DAYS = [
  { date: '2027-03-02' },
  { date: '2027-03-03' },
  { date: '2027-03-04' },
  { date: '2027-03-05' },
  { date: '2027-03-06' }
];

describe('tripDate utilities', () => {
  it('formats timestamps into Asia/Tokyo YYYY-MM-DD calendar date regardless of UTC offset', () => {
    // 2027-03-05T16:30:00Z is 2027-03-06 01:30 JST (+09:00)
    expect(formatTokyoDate(new Date('2027-03-05T16:30:00Z'))).toBe('2027-03-06');
    expect(formatTokyoDate(new Date('2027-03-02T03:00:00Z'))).toBe('2027-03-02');
  });

  it('parses valid #day-N hashes and rejects malformed or out-of-bounds hashes', () => {
    expect(parseDayHash('#day-1', 12)).toBe(0);
    expect(parseDayHash('#DAY-12', 12)).toBe(11);
    expect(parseDayHash('#day-0', 12)).toBeNull();
    expect(parseDayHash('#day-13', 12)).toBeNull();
    expect(parseDayHash('#other', 12)).toBeNull();
    expect(parseDayHash('', 12)).toBeNull();
    expect(formatDayHash(4)).toBe('#day-5');
  });

  it('resolves initial day from hash first, then Asia/Tokyo date, otherwise defaults to Day 1', () => {
    // Hash takes highest precedence even outside trip dates
    expect(resolveInitialDayIndex(MOCK_DAYS, '#day-4', new Date('2026-11-11T00:00:00Z'))).toBe(3);

    // During honeymoon in JST, automatically selects matching day
    expect(resolveInitialDayIndex(MOCK_DAYS, '', new Date('2027-03-04T02:00:00Z'))).toBe(2);

    // Outside honeymoon window without hash -> defaults to index 0 (Day 1)
    expect(resolveInitialDayIndex(MOCK_DAYS, '')).toBe(0);
    expect(resolveInitialDayIndex(MOCK_DAYS, '#day-99', new Date('2028-01-01T00:00:00Z'))).toBe(0);
  });
});
