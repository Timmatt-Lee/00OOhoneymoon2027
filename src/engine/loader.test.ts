import { describe, it, expect } from 'vitest';
import rawThemes from '../content/day-themes.json';
import { parseAndValidateDayCsv, parseRfc4180CsvRows, loadHoneymoonData } from './loader';

describe('loader engine', () => {
  it('parses 3-column and 4-column CSV schedules with CRLF, BOM, blank lines, quoted commas, and escaped quotes', () => {
    const threeCol = parseAndValidateDayCsv(
      '\uFEFFtime,title,subtitle\r\n08:00,Breakfast,Yummy hotel buffet\r\n\r\n10:30,"Train, JR","Say ""Hello"" Hokkaido"\n   ',
      '01_0302.csv'
    );
    expect(threeCol).toEqual([
      { time: '08:00', title: 'Breakfast', subtitle: 'Yummy hotel buffet' },
      { time: '10:30', title: 'Train, JR', subtitle: 'Say "Hello" Hokkaido' }
    ]);

    const fourCol = parseAndValidateDayCsv(
      'time,title,subtitle,mapQuery\n09:00,Zoo,Penguin walk, Asahiyama Zoo \n12:00,Lunch,Secret spot,   ',
      '04_0305.csv'
    );
    expect(fourCol).toEqual([
      { time: '09:00', title: 'Zoo', subtitle: 'Penguin walk', mapQuery: 'Asahiyama Zoo' },
      { time: '12:00', title: 'Lunch', subtitle: 'Secret spot' }
    ]);

    // Empty trailing call without trailing newline vs with trailing newline
    expect(parseRfc4180CsvRows('a,b\n1,2\n', 'test.csv')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ]);
  });

  it('rejects malformed headers, RFC-4180 quote errors, wrong column counts, empty rows, invalid 24h times, empty fields, and duplicate/non-monotonic times', () => {
    expect(() => parseAndValidateDayCsv('bad,header\n08:00,A,B', 'bad.csv')).toThrow(
      /exact header/
    );
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n   \n', 'empty.csv')).toThrow(
      /at least one schedule row/
    );
    expect(() =>
      parseAndValidateDayCsv('time,title,subtitle\n08:00,"unclosed quote,B', 'bad.csv')
    ).toThrow(/CSV Parse Error.*unclosed quoted field/);
    expect(() =>
      parseAndValidateDayCsv('time,title,subtitle\n08:00,"closed"extra,B', 'bad.csv')
    ).toThrow(/CSV Parse Error.*after closing quote/);
    expect(() =>
      parseAndValidateDayCsv('time,title,subtitle\n08:00,mid"quote,B', 'bad.csv')
    ).toThrow(/CSV Parse Error.*inside unquoted field/);
    expect(() =>
      parseAndValidateDayCsv('time,title,subtitle\n08:00,A,B,ExtraCol', 'bad.csv')
    ).toThrow(/CSV Parse Error.*expected 3 columns/);

    expect(() => parseAndValidateDayCsv('time,title,subtitle\n8:00,A,B', 'bad.csv')).toThrow(
      /24h HH:MM/
    );
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n24:00,A,B', 'bad.csv')).toThrow(
      /24h HH:MM/
    );
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n09:00,,B', 'bad.csv')).toThrow(
      /Title and subtitle cannot be empty/
    );
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n09:00,A,', 'bad.csv')).toThrow(
      /Title and subtitle cannot be empty/
    );

    // Duplicate timestamp & backward timestamp both violate strict monotonic order
    expect(() =>
      parseAndValidateDayCsv('time,title,subtitle\n11:00,A,B\n11:00,C,D', 'bad.csv')
    ).toThrow(/chronological order/);
    expect(() =>
      parseAndValidateDayCsv('time,title,subtitle\n11:00,A,B\n10:59,C,D', 'bad.csv')
    ).toThrow(/chronological order/);
  });

  it('loads all 12 days and strictly validates malformed themes JSON documents', () => {
    const { daysData, sceneGroups } = loadHoneymoonData();
    expect(daysData).toHaveLength(12);
    expect(sceneGroups).toHaveLength(5);
    expect(daysData[0].topSkyHex).toBe('#070B19');
    expect(daysData[11].topSkyHex).toBe('#FDBA74');

    expect(() => loadHoneymoonData(rawThemes, {})).toThrow(/Missing CSV file/);
    expect(() => loadHoneymoonData(null)).toThrow(/root must be an object/);
    expect(() => loadHoneymoonData([])).toThrow(/root must be an object/);
    expect(() => loadHoneymoonData({ days: [], sceneGroups: rawThemes.sceneGroups })).toThrow(
      /12 days/
    );
    expect(() => loadHoneymoonData({ days: rawThemes.days, sceneGroups: [] })).toThrow(
      /5 sceneGroups/
    );

    const nonObjDays = [null, ...rawThemes.days.slice(1)];
    expect(() =>
      loadHoneymoonData({ days: nonObjDays, sceneGroups: rawThemes.sceneGroups })
    ).toThrow(/days\[0\] must be an object/);

    const invalidThemeDays = [
      { ...rawThemes.days[0], planeAction: 'fly-away' },
      ...rawThemes.days.slice(1)
    ];
    expect(() =>
      loadHoneymoonData({ days: invalidThemeDays, sceneGroups: rawThemes.sceneGroups })
    ).toThrow(/failed theme schema validation/);

    const nonObjGroups = [null, ...rawThemes.sceneGroups.slice(1)];
    expect(() => loadHoneymoonData({ days: rawThemes.days, sceneGroups: nonObjGroups })).toThrow(
      /sceneGroups\[0\] must be an object/
    );

    const invalidGroups = [
      { ...rawThemes.sceneGroups[0], widthPx: 0 },
      ...rawThemes.sceneGroups.slice(1)
    ];
    expect(() => loadHoneymoonData({ days: rawThemes.days, sceneGroups: invalidGroups })).toThrow(
      /failed sceneGroup validation/
    );
  });
});
