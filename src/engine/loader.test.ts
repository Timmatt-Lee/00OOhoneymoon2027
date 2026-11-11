import { describe, it, expect } from 'vitest';
import rawThemes from '../content/day-themes.json';
import { parseAndValidateDayCsv, loadHoneymoonData } from './loader';

describe('loader engine', () => {
  it('parses both 3-column and 4-column CSV schedules with CRLF normalization and trimmed mapQuery', () => {
    const threeCol = parseAndValidateDayCsv(
      'time,title,subtitle\r\n08:00,Breakfast,Yummy hotel buffet\r\n10:30,Train,JR Express',
      '01_0302.csv'
    );
    expect(threeCol).toEqual([
      { time: '08:00', title: 'Breakfast', subtitle: 'Yummy hotel buffet' },
      { time: '10:30', title: 'Train', subtitle: 'JR Express' }
    ]);

    const fourCol = parseAndValidateDayCsv(
      'time,title,subtitle,mapQuery\n09:00,Zoo,Penguin walk, Asahiyama Zoo \n12:00,Lunch,Secret spot,   ',
      '04_0305.csv'
    );
    expect(fourCol).toEqual([
      { time: '09:00', title: 'Zoo', subtitle: 'Penguin walk', mapQuery: 'Asahiyama Zoo' },
      { time: '12:00', title: 'Lunch', subtitle: 'Secret spot' }
    ]);
  });

  it('rejects malformed headers, unclosed CSV quotes, invalid times, and non-chronological rows', () => {
    expect(() => parseAndValidateDayCsv('bad,header\n08:00,A,B', 'bad.csv')).toThrow(
      /exact header/
    );
    expect(() =>
      parseAndValidateDayCsv('time,title,subtitle\n08:00,"unclosed quote,B', 'bad.csv')
    ).toThrow(/CSV Parse Error/);
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n8:00,A,B', 'bad.csv')).toThrow(
      /24h HH:MM/
    );
    expect(() =>
      parseAndValidateDayCsv('time,title,subtitle\n11:00,A,B\n10:59,C,D', 'bad.csv')
    ).toThrow(/chronological order/);
  });

  it('loads all 12 days with extracted topSkyHex and throws when a referenced CSV is missing', () => {
    const { daysData, sceneGroups } = loadHoneymoonData();
    expect(daysData).toHaveLength(12);
    expect(sceneGroups).toHaveLength(5);
    expect(daysData[0].topSkyHex).toBe('#070B19');
    expect(daysData[11].topSkyHex).toBe('#FDBA74');

    expect(() => loadHoneymoonData(rawThemes, {})).toThrow(/Missing CSV file/);
  });
});
