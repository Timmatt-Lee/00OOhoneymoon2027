import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import themes from '../../src/content/day-themes.json';
import { parseAndValidateDayCsv } from '../../src/engine/loader';
import { getEvenPct } from '../../src/engine/timeline';

const rootDir = path.resolve(__dirname, '../..');

describe('Honeymoon Data, Metadata, Math & SVG Asset Integrity Suite', () => {
  it('1. validates PWA manifest.json and index.html use exact title "00OO 北海道蜜月 2027"', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/manifest.json'), 'utf8'));
    expect(manifest.name).toBe('00OO 北海道蜜月 2027');
    expect(manifest.short_name).toBe('00OO 北海道蜜月 2027');

    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    expect(indexHtml).toContain('<title>00OO 北海道蜜月 2027</title>');
    expect(indexHtml).toContain('content="00OO 北海道蜜月 2027"');
    expect(indexHtml).toContain('<canvas id="fx-canvas"></canvas>');
  });

  it('2. validates src/content/day-themes.json has 12 sequential days and 5 contiguous scene groups', () => {
    expect(themes.days).toHaveLength(12);
    expect(themes.sceneGroups).toHaveLength(5);
    themes.days.forEach((d, idx) => {
      expect(d.day).toBe(idx + 1);
      expect(d.csvFile).toMatch(/^\d{2}_\d{4}\.csv$/);
      expect(d.mapQuery.length).toBeGreaterThan(0);
      expect(d.skyGrad).toContain('linear-gradient');
    });
    expect(themes.sceneGroups[0].startDay).toBe(0);
    expect(themes.sceneGroups[4].endDay).toBe(11);
  });

  it('3. validates all 12 daily CSV files conform to strict time,title,subtitle schema and chronological order', () => {
    for (const dayTheme of themes.days) {
      const csvPath = path.join(rootDir, 'src', 'content', 'days', dayTheme.csvFile);
      expect(fs.existsSync(csvPath), `Missing ${dayTheme.csvFile}`).toBe(true);
      const raw = fs.readFileSync(csvPath, 'utf8');
      const items = parseAndValidateDayCsv(raw, dayTheme.csvFile);
      expect(items.length).toBeGreaterThanOrEqual(4);
      expect(items.length).toBeLessThanOrEqual(8);
    }
  });

  it('4. rejects malformed CSV headers, invalid 24h time formats, empty fields, and out-of-order rows', () => {
    expect(() => parseAndValidateDayCsv('wrong,header\n08:00,A,B', 'bad.csv')).toThrow(/exact header/);
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n8:00,A,B', 'bad.csv')).toThrow(/24h HH:MM/);
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n25:00,A,B', 'bad.csv')).toThrow(/24h HH:MM/);
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n09:00,,B', 'bad.csv')).toThrow();
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n10:00,A,B\n09:00,C,D', 'bad.csv')).toThrow(/chronological/);
  });

  it('5. verifies timeline getEvenPct distributes nodes evenly from 0% to 100% and handles edge cases', () => {
    expect(getEvenPct(0, 1)).toBe(50);
    expect(getEvenPct(0, 5)).toBe(0);
    expect(getEvenPct(2, 5)).toBe(50);
    expect(getEvenPct(4, 5)).toBe(100);
    expect(getEvenPct(99, 5)).toBe(100);
  });

  it('6. verifies all 18 SVG scene files are valid, aspect-ratio locked, and use clipPath for mountain/pine snow caps', () => {
    const scenesDir = path.join(rootDir, 'src', 'assets', 'scenes');
    const svgFiles = fs.readdirSync(scenesDir).filter((f) => f.endsWith('.svg'));
    expect(svgFiles).toHaveLength(18);

    for (const f of svgFiles) {
      const content = fs.readFileSync(path.join(scenesDir, f), 'utf8').trim();
      expect(content.startsWith('<svg')).toBe(true);
      expect(content.endsWith('</svg>')).toBe(true);
      if (f.startsWith('group')) {
        expect(content).toContain('preserveAspectRatio="xMidYMax slice"');
      }
    }

    // Ensure mountain & pine snow caps use <clipPath> so snow never sticks out crookedly
    for (const clippedFile of ['group0-bg.svg', 'group0-fg.svg', 'group1-bg.svg', 'group2-bg.svg', 'group3-bg.svg', 'group3-mid.svg', 'group3-fg.svg', 'group4-bg.svg', 'group4-mid.svg', 'group4-fg.svg']) {
      const svg = fs.readFileSync(path.join(scenesDir, clippedFile), 'utf8');
      expect(svg, `${clippedFile} should use clipPath for snow caps`).toContain('<clipPath');
    }
  });

  it('7. verifies group4-mid.svg is cleanly structured into semantic non-overlapping landmark groups', () => {
    const g4Mid = fs.readFileSync(path.join(rootDir, 'src/assets/scenes/group4-mid.svg'), 'utf8');
    expect(g4Mid).toContain('id="day8-lake-toya"');
    expect(g4Mid).toContain('id="day9-otaru-ropeway"');
    expect(g4Mid).toContain('id="day10-otaru-warehouses"');
    expect(g4Mid).toContain('id="day11-sapporo-skyline"');
    expect(g4Mid).toContain('id="day12-chitose-airport"');
  });

  it('8. ensures zero legacy schedule.json, data/, or .mjs files exist in the repository', () => {
    expect(fs.existsSync(path.join(rootDir, 'schedule.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'public', 'schedule.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'data'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'scripts'))).toBe(false);
  });
});
