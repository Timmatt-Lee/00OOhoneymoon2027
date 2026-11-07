import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import themes from '../../src/content/day-themes.json';
import { parseAndValidateDayCsv } from '../../src/engine/loader';

const rootDir = path.resolve(__dirname, '../..');

describe('Honeymoon Data & Asset Schema Integrity', () => {
  it('validates src/content/day-themes.json has 12 days and 5 scene groups', () => {
    expect(themes.days).toHaveLength(12);
    expect(themes.sceneGroups).toHaveLength(5);
    themes.days.forEach((d, idx) => {
      expect(d.day).toBe(idx + 1);
      expect(d.csvFile).toMatch(/^\d{2}_\d{4}\.csv$/);
      expect(d.mapQuery.length).toBeGreaterThan(0);
      expect(d.skyGrad).toContain('linear-gradient');
    });
  });

  it('validates all 12 daily CSV files in src/content/days/ conform to strict time,title,subtitle schema via PapaParse + Zod', () => {
    for (const dayTheme of themes.days) {
      const csvPath = path.join(rootDir, 'src', 'content', 'days', dayTheme.csvFile);
      expect(fs.existsSync(csvPath), `Missing ${dayTheme.csvFile}`).toBe(true);
      const raw = fs.readFileSync(csvPath, 'utf8');
      const items = parseAndValidateDayCsv(raw, dayTheme.csvFile);
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items.length).toBeLessThanOrEqual(8);
    }
  });

  it('rejects malformed CSV rows or out-of-order times', () => {
    expect(() => parseAndValidateDayCsv('wrong,header\n08:00,A,B', 'bad.csv')).toThrow(/exact header/);
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n8:00,A,B', 'bad.csv')).toThrow(/24h HH:MM/);
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n10:00,A,B\n09:00,C,D', 'bad.csv')).toThrow(/chronological/);
  });

  it('verifies all 18 pure SVG scene assets exist in src/assets/scenes/', () => {
    const scenesDir = path.join(rootDir, 'src', 'assets', 'scenes');
    const svgFiles = fs.readdirSync(scenesDir).filter((f) => f.endsWith('.svg'));
    expect(svgFiles.length).toBe(18);
    for (const f of svgFiles) {
      const content = fs.readFileSync(path.join(scenesDir, f), 'utf8').replace(/^\uFEFF/, '').trim();
      expect(content.startsWith('<svg')).toBe(true);
      expect(content.endsWith('</svg>')).toBe(true);
    }
  });

  it('ensures no legacy schedule.json, data/, or .mjs files exist in the repository', () => {
    expect(fs.existsSync(path.join(rootDir, 'schedule.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'public', 'schedule.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'data'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'scripts'))).toBe(false);
  });
});
