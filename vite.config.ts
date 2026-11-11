import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';

function collectRelativeAssets(baseDir: string, currentDir = baseDir): string[] {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const collected: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'sw.js') continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectRelativeAssets(baseDir, fullPath));
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, fullPath).split(path.sep).join('/');
      collected.push(`./${rel}`);
    }
  }
  return collected.sort();
}

function buildTypedServiceWorkerPlugin(): Plugin {
  return {
    name: 'build-typed-service-worker',
    apply: 'build',
    async writeBundle(options) {
      const outDir = options.dir ?? path.resolve(import.meta.dirname, 'dist');
      const assetUrls = ['./', ...collectRelativeAssets(outDir)];
      const hash = crypto.createHash('sha256');
      for (const relUrl of assetUrls) {
        hash.update(relUrl);
        if (relUrl !== './') {
          const stat = fs.statSync(path.join(outDir, relUrl.slice(2)));
          hash.update(String(stat.size));
        }
      }
      const cacheName = `honeymoon-2027-${hash.digest('hex').slice(0, 10)}`;

      const swTsPath = path.resolve(import.meta.dirname, 'src/pwa/sw.ts');
      const rawSwTs = fs
        .readFileSync(swTsPath, 'utf8')
        .replace(/^export /gm, '')
        .replace(/^declare const __SW_.*$/gm, '');

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
  plugins: [buildTypedServiceWorkerPlugin()],
  server: {
    port: 5173,
    open: false
  }
});
