#!/usr/bin/env node
/**
 * 从 GitHub 官方标签拉取 Twemoji 图形资源到 public/twemoji/<version>/assets/（svg + 72x72）。
 * 需一次性网络访问；仓库已提交资源时可跳过。
 *
 * Usage: node scripts/vendor-twemoji-assets.mjs
 * (run from frontend/)
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, '..');
const VERSION = '14.0.2';
const SVG_DIR = join(FRONTEND_ROOT, 'public', 'twemoji', VERSION, 'assets', 'svg');

if (existsSync(SVG_DIR) && readdirSync(SVG_DIR).length > 0) {
  console.log('[vendor-twemoji] assets already present, skip.');
  process.exit(0);
}

const cacheDir = join(FRONTEND_ROOT, 'node_modules', '.cache');
const tarball = join(cacheDir, `twemoji-${VERSION}.tar.gz`);
const url = `https://github.com/twitter/twemoji/archive/refs/tags/v${VERSION}.tar.gz`;

mkdirSync(cacheDir, { recursive: true });
console.log('[vendor-twemoji] downloading', url);
execSync(`curl -fsSL -o "${tarball}" "${url}"`, { stdio: 'inherit' });

const extractRoot = join(cacheDir, `twemoji-extract-${VERSION}`);
rmSync(extractRoot, { recursive: true, force: true });
mkdirSync(extractRoot, { recursive: true });
execSync(`tar -xzf "${tarball}" -C "${extractRoot}"`, { stdio: 'inherit' });

const assetsSrc = join(extractRoot, `twemoji-${VERSION}`, 'assets');
const destParent = join(FRONTEND_ROOT, 'public', 'twemoji', VERSION);
rmSync(join(destParent, 'assets'), { recursive: true, force: true });
mkdirSync(destParent, { recursive: true });
execSync(`cp -R "${assetsSrc}" "${destParent}/"`, { stdio: 'inherit' });
console.log('[vendor-twemoji] done →', join(destParent, 'assets'));
try {
  execSync('node scripts/prune-twemoji-assets.mjs', {
    cwd: FRONTEND_ROOT,
    stdio: 'inherit',
  });
} catch (e) {
  console.warn('[vendor-twemoji] prune failed (optional):', e?.message || e);
}
