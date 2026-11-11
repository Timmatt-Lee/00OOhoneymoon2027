import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import themes from '../../src/content/day-themes.json';
import { parseAndValidateDayCsv, loadHoneymoonData } from '../../src/engine/loader';

const rootDir = path.resolve(__dirname, '../..');

const ManifestSchema = z.object({
  name: z.string(),
  short_name: z.string()
});

describe('00OO Hokkaido Honeymoon 2027 — Data, SVG Geometry & Architecture Suite', () => {
  it('1. validates PWA manifest.json and index.html metadata match "00OO 北海道蜜月 2027"', () => {
    const rawManifest: unknown = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'public/manifest.json'), 'utf8')
    );
    const manifest = ManifestSchema.parse(rawManifest);
    expect(manifest.name).toBe('00OO 北海道蜜月 2027');
    expect(manifest.short_name).toBe('00OO 北海道蜜月 2027');

    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    expect(indexHtml).toContain('<title>00OO 北海道蜜月 2027</title>');
    expect(indexHtml).toContain('content="00OO 北海道蜜月 2027"');
    expect(indexHtml).toContain('<canvas id="fx-canvas"');
    expect(indexHtml).not.toContain('user-scalable=no');
  });

  it('2. validates loadHoneymoonData() integrates all 12 CSVs with contiguous dates & checks parallax pan bounds', () => {
    const { daysData, sceneGroups } = loadHoneymoonData();
    expect(daysData).toHaveLength(12);
    expect(sceneGroups).toHaveLength(5);
    expect(daysData[0].date).toBe('2027-03-02');
    expect(daysData[11].date).toBe('2027-03-13');

    for (const day of daysData) {
      const grp = sceneGroups[day.groupIdx];
      expect(day.day - 1).toBeGreaterThanOrEqual(grp.startDay);
      expect(day.day - 1).toBeLessThanOrEqual(grp.endDay);
      const maxShift = (day.day - 1 - grp.startDay) * grp.panStepPx;
      expect(
        maxShift + 400,
        `Group ${grp.groupIdx} Day ${day.day} pans past SVG widthPx (${grp.widthPx})`
      ).toBeLessThanOrEqual(grp.widthPx);
    }
  });

  it('3. rejects malformed CSV headers, invalid 24h times, empty fields, and non-chronological schedules', () => {
    expect(() => parseAndValidateDayCsv('wrong,header\n08:00,A,B', 'bad.csv')).toThrow(
      /exact header/
    );
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n8:00,A,B', 'bad.csv')).toThrow(
      /24h HH:MM/
    );
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n24:00,A,B', 'bad.csv')).toThrow(
      /24h HH:MM/
    );
    expect(() => parseAndValidateDayCsv('time,title,subtitle\n09:00,,B', 'bad.csv')).toThrow();
    expect(() =>
      parseAndValidateDayCsv('time,title,subtitle\n10:30,A,B\n10:00,C,D', 'bad.csv')
    ).toThrow(/chronological/);
  });

  it('4. verifies all 18 inlined SVGs have globally unique IDs, valid clipPath url(#...) references, and matching viewBox widths', () => {
    const scenesDir = path.join(rootDir, 'src/assets/scenes');
    const svgFiles = fs.readdirSync(scenesDir).filter((f) => f.endsWith('.svg'));
    expect(svgFiles).toHaveLength(18);

    const globalIds = new Map<string, string>();

    for (const file of svgFiles) {
      const content = fs.readFileSync(path.join(scenesDir, file), 'utf8').trim();
      expect(content.startsWith('<svg')).toBe(true);
      expect(content.endsWith('</svg>')).toBe(true);

      const grpMatch = /^group(\d)-(bg|mid|fg)\.svg$/.exec(file);
      if (grpMatch) {
        const gIdx = Number(grpMatch[1]);
        const expectedW = themes.sceneGroups[gIdx].widthPx;
        expect(content).toContain(`viewBox="0 0 ${expectedW} 205"`);
        expect(content).toContain('preserveAspectRatio="xMidYMax slice"');
      }

      const localIds = new Set<string>();
      for (const m of content.matchAll(/\bid="([^"]+)"/g)) {
        const id = m[1];
        expect(
          globalIds.has(id),
          `Duplicate SVG id="${id}" found in ${file} and ${globalIds.get(id) ?? ''}`
        ).toBe(false);
        globalIds.set(id, file);
        localIds.add(id);
      }

      for (const ref of content.matchAll(/url\(#([^)]+)\)/g)) {
        expect(localIds.has(ref[1]), `${file} references missing url(#${ref[1]})`).toBe(true);
      }
    }
  });

  it('5. ensures zero legacy untyped JS or obsolete artifacts exist in the repo', () => {
    expect(fs.existsSync(path.join(rootDir, 'public/sw.js'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'schedule.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'public/schedule.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'data'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'scripts'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'test-results'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, '.githooks'))).toBe(false);
  });
});
