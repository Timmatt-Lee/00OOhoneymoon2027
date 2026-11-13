import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';

type SubsetFontFn = (
  buffer: Buffer,
  text: string,
  options?: { targetFormat?: 'sfnt' | 'woff' | 'woff2' }
) => Promise<Buffer>;

const nodeRequire = createRequire(import.meta.url);

const LAUNCHER_ICON_PATTERN = /^icon(-maskable)?-\d+\.png$/;
const SOURCE_TEXT_EXT_PATTERN = /\.(json|csv|scss|ts)$/;
const SAFETY_PUNCTUATION = '0123456789。，、；：「」『』（）！？—…・↗～《》【】℃°';
const PRODUCTION_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'"
].join('; ');

function collectTextFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(fullPath));
    } else if (entry.isFile() && SOURCE_TEXT_EXT_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function buildDynamicGlyphString(projectRoot: string): string {
  const charSet = new Set<string>();
  for (let cp = 0x20; cp <= 0x7e; cp++) {
    charSet.add(String.fromCodePoint(cp));
  }
  for (const ch of SAFETY_PUNCTUATION) {
    charSet.add(ch);
  }

  const scanFiles = [
    path.join(projectRoot, 'index.html'),
    path.join(projectRoot, 'public/manifest.json'),
    ...collectTextFiles(path.join(projectRoot, 'src'))
  ];

  for (const filePath of scanFiles) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const ch of content) {
      if (ch >= ' ') {
        charSet.add(ch);
      }
    }
  }

  return Array.from(charSet).sort().join('');
}

function collectPrecacheAssets(baseDir: string, currentDir = baseDir): string[] {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const collected: string[] = [];
  for (const entry of entries) {
    const isExcluded =
      entry.name.startsWith('.') ||
      entry.name === 'sw.js' ||
      entry.name === 'apple-touch-icon.png' ||
      LAUNCHER_ICON_PATTERN.test(entry.name);
    if (isExcluded) continue;

    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectPrecacheAssets(baseDir, fullPath));
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, fullPath).split(path.sep).join('/');
      collected.push(`./${rel}`);
    }
  }
  return collected.sort();
}

function minifyRawSvgPlugin(): Plugin {
  return {
    name: 'minify-raw-svg',
    enforce: 'pre',
    load(id) {
      const isRawSvg = id.endsWith('.svg?raw');
      if (!isRawSvg) return null;
      const svgPath = id.slice(0, -4);
      const rawSvg = fs.readFileSync(svgPath, 'utf8');
      const minified = rawSvg
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .trim();
      return `export default ${JSON.stringify(minified)};`;
    }
  };
}

function devMasterFontServerPlugin(): Plugin {
  const masterFontPath = path.resolve(import.meta.dirname, 'src/assets/fonts/Huninn-Regular.woff2');
  return {
    name: 'dev-master-font-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const cleanUrl = req.url?.split('?')[0] ?? '';
        const isHuninnRequest = cleanUrl.endsWith('/fonts/Huninn-Regular.woff2');
        if (!isHuninnRequest) {
          next();
          return;
        }
        const fontBytes = fs.readFileSync(masterFontPath);
        res.setHeader('Content-Type', 'font/woff2');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(fontBytes);
      });
    }
  };
}

function buildFontCspAndSwPlugin(): Plugin {
  const projectRoot = import.meta.dirname;
  const masterFontPath = path.resolve(projectRoot, 'src/assets/fonts/Huninn-Regular.woff2');

  return {
    name: 'build-font-csp-and-sw',
    apply: 'build',
    transform(code, id) {
      const isStylesheet = /\.(css|scss)(\?.*)?$/.test(id) && !id.includes('?html-proxy');
      if (!isStylesheet || !code.includes('/fonts/Huninn-Regular.woff2')) {
        return null;
      }
      return {
        code: code.replace(
          /(?<!\.)\/fonts\/Huninn-Regular\.woff2/g,
          '../fonts/Huninn-Regular.woff2'
        ),
        map: null
      };
    },
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: PRODUCTION_CSP
            },
            injectTo: 'head-prepend'
          }
        ];
      }
    },
    async writeBundle(options) {
      const outDir = options.dir ?? path.resolve(projectRoot, 'dist');

      // 1. Automatically subset master CJK WOFF2 font to exact repository glyph set with content hash
      const subsetFont = nodeRequire('subset-font') as SubsetFontFn;
      const masterBuffer = fs.readFileSync(masterFontPath);
      const glyphText = buildDynamicGlyphString(projectRoot);
      const subsetBuffer = await subsetFont(masterBuffer, glyphText, { targetFormat: 'woff2' });
      const fontHash = crypto.createHash('sha256').update(subsetBuffer).digest('hex').slice(0, 8);
      const hashedFontFileName = `Huninn-Regular-${fontHash}.woff2`;
      const assetsOutDir = path.join(outDir, 'assets');
      fs.mkdirSync(assetsOutDir, { recursive: true });
      fs.writeFileSync(path.join(assetsOutDir, hashedFontFileName), subsetBuffer);

      const indexHtmlPath = path.join(outDir, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        const updatedHtml = fs
          .readFileSync(indexHtmlPath, 'utf8')
          .replace(/(?:\.\/|\/)fonts\/Huninn-Regular\.woff2/g, `./assets/${hashedFontFileName}`);
        fs.writeFileSync(indexHtmlPath, updatedHtml, 'utf8');
      }

      for (const entryName of fs.readdirSync(assetsOutDir)) {
        if (!entryName.endsWith('.css')) continue;
        const cssFilePath = path.join(assetsOutDir, entryName);
        const updatedCss = fs
          .readFileSync(cssFilePath, 'utf8')
          .replace(/(?:\.\.?\/|\/)fonts\/Huninn-Regular\.woff2/g, `./${hashedFontFileName}`);
        fs.writeFileSync(cssFilePath, updatedCss, 'utf8');
      }

      // 2. Build Service Worker with true SHA-256 content digest across precached assets + SW source
      const assetUrls = collectPrecacheAssets(outDir);
      const swTsPath = path.resolve(projectRoot, 'src/pwa/sw.ts');
      const rawSwTs = fs
        .readFileSync(swTsPath, 'utf8')
        .replace(/^export /gm, '')
        .replace(/^declare const __SW_.*$/gm, '');

      const hash = crypto.createHash('sha256');
      for (const relUrl of assetUrls) {
        const fileBytes = fs.readFileSync(path.join(outDir, relUrl.slice(2)));
        hash.update(relUrl);
        hash.update('\0');
        hash.update(fileBytes);
        hash.update('\0');
      }
      hash.update(rawSwTs);
      const cacheName = `honeymoon-2027-${hash.digest('hex').slice(0, 12)}`;

      const injectedSource = [
        `const __SW_CACHE_NAME__ = ${JSON.stringify(cacheName)};`,
        `const __SW_PRECACHE_URLS__ = ${JSON.stringify(assetUrls)};`,
        rawSwTs
      ].join('\n');

      const transformed = await transformWithEsbuild(injectedSource, 'sw.ts', {
        loader: 'ts',
        target: 'es2022',
        minify: true
      });

      fs.writeFileSync(path.join(outDir, 'sw.js'), transformed.code, 'utf8');
    }
  };
}

export default defineConfig({
  base: './',
  build: {
    modulePreload: {
      polyfill: false
    },
    rollupOptions: {
      external: [/^(?:\.\.?\/|\/)fonts\/Huninn-Regular\.woff2$/]
    }
  },
  plugins: [minifyRawSvgPlugin(), devMasterFontServerPlugin(), buildFontCspAndSwPlugin()],
  server: {
    port: 5173,
    open: false
  }
});
