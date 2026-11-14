import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { z } from 'zod';
import themes from '../../src/content/day-themes.json';
import { parseAndValidateDayCsv, loadHoneymoonData } from '../../src/engine/loader';

const rootDir = path.resolve(__dirname, '../..');

const ManifestSchema = z.object({
  name: z.string(),
  short_name: z.string(),
  background_color: z.string()
});

const SPOILER_HOTEL_PATTERN = /Suimeikaku|Takinoya|Nikko|水明閣|瀧乃家/i;
const COVERAGE_IGNORE_PATTERN = /\b(v8|istanbul|c8)\s+ignore\b/i;
const NON_PRINTABLE_ASCII_PATTERN = /[^\x20-\x7E\t\r\n]/;

function walkDirectory(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const collectedPaths: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectedPaths.push(...walkDirectory(fullPath));
    } else if (entry.isFile()) {
      collectedPaths.push(fullPath);
    }
  }
  return collectedPaths.sort();
}

function extractTsComments(sourceText: string): string[] {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    sourceText
  );
  const comments: string[] = [];
  const templateBraceStack: number[] = [];
  let braceDepthCount = 0;

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.TemplateHead) {
      templateBraceStack.push(braceDepthCount);
    } else if (token === ts.SyntaxKind.OpenBraceToken) {
      braceDepthCount++;
    } else if (token === ts.SyntaxKind.CloseBraceToken) {
      if (
        templateBraceStack.length > 0 &&
        templateBraceStack[templateBraceStack.length - 1] === braceDepthCount
      ) {
        templateBraceStack.pop();
        token = scanner.reScanTemplateToken(false);
        continue;
      }
      braceDepthCount--;
    } else if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      comments.push(scanner.getTokenText());
    }
    token = scanner.scan();
  }
  return comments;
}

describe('00OO Hokkaido Honeymoon 2027 — Repository Integrity, Privacy & Architecture Suite', () => {
  it('1. validates PWA manifest.json and index.html metadata, live status region, and locked portrait viewport', () => {
    const rawManifest: unknown = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'public/manifest.json'), 'utf8')
    );
    const manifest = ManifestSchema.parse(rawManifest);
    expect(manifest.name).toBe('00OO 北海道蜜月 2027');
    expect(manifest.short_name).toBe('00OO 北海道蜜月 2027');
    expect(manifest.background_color).toBe('#ffffff');

    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    expect(indexHtml).toContain('<title>00OO 北海道蜜月 2027</title>');
    expect(indexHtml).toContain('content="00OO 北海道蜜月 2027"');
    expect(indexHtml).toContain('maximum-scale=1.0, user-scalable=no');
    expect(indexHtml).toContain('id="day-live-status"');
    expect(indexHtml).toContain('<canvas id="fx-canvas"');
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

  it('4. verifies all 18 inlined SVGs have unique IDs, valid url(#...) refs, xMidYMax meet + overflow="hidden", and full-bleed horizons', () => {
    const scenesDir = path.join(rootDir, 'src/assets/scenes');
    const svgFiles = fs
      .readdirSync(scenesDir)
      .filter((fileName) => fileName.endsWith('.svg'))
      .sort();
    expect(svgFiles).toHaveLength(18);

    const globalIds = new Map<string, string>();
    let sceneLayerCount = 0;

    for (const file of svgFiles) {
      const content = fs.readFileSync(path.join(scenesDir, file), 'utf8').trim();
      expect(content.startsWith('<svg')).toBe(true);
      expect(content.endsWith('</svg>')).toBe(true);

      const grpMatch = /^group(\d)-(bg|mid|fg)\.svg$/.exec(file);
      if (grpMatch) {
        sceneLayerCount++;
        const gIdx = Number(grpMatch[1]);
        const layerKind = grpMatch[2];
        const expectedW = themes.sceneGroups[gIdx].widthPx;
        expect(content, `${file} viewBox mismatch`).toContain(`viewBox="0 0 ${expectedW} 205"`);
        expect(content, `${file} must use xMidYMax meet`).toContain(
          'preserveAspectRatio="xMidYMax meet"'
        );
        expect(content, `${file} must not use slice`).not.toContain('slice');
        expect(content, `${file} must set overflow="hidden"`).toContain('overflow="hidden"');

        if (layerKind === 'bg' || layerKind === 'mid') {
          expect(content, `${file} must extend left horizon to -1400`).toContain('-1400');
        }
      }

      const localIds = new Set<string>();
      for (const m of content.matchAll(/\bid="([^"]+)"/g)) {
        const id = m[1];
        const isDuplicateId = globalIds.has(id);
        expect(
          isDuplicateId,
          `Duplicate SVG id="${id}" found in ${file} and ${globalIds.get(id) ?? ''}`
        ).toBe(false);
        globalIds.set(id, file);
        localIds.add(id);
      }

      for (const ref of content.matchAll(/url\(#([^)]+)\)/g)) {
        const isLocalRefPresent = localIds.has(ref[1]);
        expect(isLocalRefPresent, `${file} references missing url(#${ref[1]})`).toBe(true);
      }
    }

    expect(sceneLayerCount).toBe(15);
  });

  it('5. enforces zero spoiler hotel names across all SVG scenes and itinerary content files', () => {
    const auditedFiles = [
      ...walkDirectory(path.join(rootDir, 'src/assets/scenes')),
      ...walkDirectory(path.join(rootDir, 'src/content'))
    ];
    expect(auditedFiles.length).toBeGreaterThanOrEqual(30);

    for (const filePath of auditedFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const relPath = path.relative(rootDir, filePath);
      const isSpoilerDetected = SPOILER_HOTEL_PATTERN.test(content);
      expect(isSpoilerDetected, `Spoiler hotel string leaked in ${relPath}`).toBe(false);
    }
  });

  it('6. enforces ASCII-only English comments in SVGs and TypeScript sources and zero coverage-ignore directives', () => {
    const svgFiles = walkDirectory(path.join(rootDir, 'src/assets/scenes')).filter((filePath) =>
      filePath.endsWith('.svg')
    );
    for (const svgPath of svgFiles) {
      const content = fs.readFileSync(svgPath, 'utf8');
      const relPath = path.relative(rootDir, svgPath);
      for (const match of content.matchAll(/<!--[\s\S]*?-->/g)) {
        const isNonAscii = NON_PRINTABLE_ASCII_PATTERN.test(match[0]);
        expect(isNonAscii, `Non-ASCII XML comment in ${relPath}: ${match[0]}`).toBe(false);
      }
    }

    const tsFiles = walkDirectory(path.join(rootDir, 'src')).filter((filePath) =>
      filePath.endsWith('.ts')
    );
    for (const tsPath of tsFiles) {
      const content = fs.readFileSync(tsPath, 'utf8');
      const relPath = path.relative(rootDir, tsPath);
      for (const comment of extractTsComments(content)) {
        const isNonAscii = NON_PRINTABLE_ASCII_PATTERN.test(comment);
        expect(isNonAscii, `Non-ASCII comment in ${relPath}: ${comment}`).toBe(false);
        const isCoverageIgnored = COVERAGE_IGNORE_PATTERN.test(comment);
        expect(isCoverageIgnored, `Forbidden coverage ignore directive in ${relPath}`).toBe(false);
      }
    }
  });

  it('7. enforces strict co-location of unit tests alongside every runtime module in src/', () => {
    const srcFiles = walkDirectory(path.join(rootDir, 'src'));
    const runtimeModules = srcFiles.filter((filePath) => {
      const relPath = path.relative(rootDir, filePath).split(path.sep).join('/');
      const isRuntimeTs =
        relPath.endsWith('.ts') &&
        !relPath.endsWith('.test.ts') &&
        !relPath.endsWith('.d.ts') &&
        !relPath.startsWith('src/types/');
      return isRuntimeTs;
    });

    expect(runtimeModules.length).toBeGreaterThanOrEqual(16);

    for (const modulePath of runtimeModules) {
      const expectedTestPath = modulePath.replace(/\.ts$/, '.test.ts');
      const relModule = path.relative(rootDir, modulePath);
      const isCoLocatedPresent = fs.existsSync(expectedTestPath);
      expect(isCoLocatedPresent, `Missing co-located unit test for ${relModule}`).toBe(true);
    }
  });

  it('8. ensures zero legacy untyped JS, SVG @keyframes stylesheets, duplicate public fonts, or obsolete test directories exist in the repo', () => {
    expect(fs.existsSync(path.join(rootDir, 'src/styles/_animations.scss'))).toBe(false);
    const scssFiles = walkDirectory(path.join(rootDir, 'src/styles')).filter((filePath) =>
      filePath.endsWith('.scss')
    );
    for (const scssPath of scssFiles) {
      const scssContent = fs.readFileSync(scssPath, 'utf8');
      expect(scssContent).not.toContain('@keyframes');
    }

    expect(fs.existsSync(path.join(rootDir, 'public/sw.js'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'public/fonts/Huninn-Regular.woff2'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'tests/unit'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'schedule.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'public/schedule.json'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'data'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'scripts'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'test-results'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, '.githooks'))).toBe(false);
  });
});
