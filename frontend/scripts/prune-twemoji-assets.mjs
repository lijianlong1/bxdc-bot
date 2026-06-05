#!/usr/bin/env node
/**
 * 仅保留 Twemoji 白名单对应的 svg / 72x72 文件；集合与
 * `src/constants/twemojiCoveredEmoji.ts` 中并集一致（修改时请同步）。
 *
 * Usage: node scripts/prune-twemoji-assets.mjs
 * (run from frontend/)
 */
import { readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import twemoji from 'twemoji';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, '..');
const VERSION = '14.0.2';

/** @type {readonly string[]} — keep in sync with twemojiCoveredEmoji.AVATAR_EMOJI_CHOICES */
const AVATAR_EMOJI_CHOICES = [
  '👤',
  '🤖',
  '😀',
  '😊',
  '😎',
  '🥳',
  '🤓',
  '🐱',
  '🐶',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🦁',
  '🐸',
  '🦄',
  '🐧',
  '🐙',
  '🌸',
  '🌙',
  '⭐',
  '🌈',
  '🔥',
  '💧',
  '🚀',
  '🎨',
  '📚',
  '🎮',
  '🍎',
  '☕',
  '🎁',
  '💎',
  '🔔',
  '🌊',
  '🌻',
  '🍀',
  '🎸',
  '🏀',
  '⚽',
  '🎲',
];

const BUILTIN_SKILL_EMOJIS = ['🔌', '🧮', '🐧', '✨'];
const EXTENDED_SKILL_EMOJI_POOL = [
  '🧩',
  '⚙️',
  '📦',
  '🛠️',
  '🔧',
  '📡',
  '🎯',
  '💡',
  '🌐',
  '📎',
];
const MESSAGE_UI_EMOJIS = ['🤔'];

const TWEMOJI_COVERED_EMOJIS = [
  ...new Set([
    ...AVATAR_EMOJI_CHOICES,
    ...BUILTIN_SKILL_EMOJIS,
    ...EXTENDED_SKILL_EMOJI_POOL,
    ...MESSAGE_UI_EMOJIS,
  ]),
];

function twemojiAssetFilenameFromCodepoint(code) {
  return code.replace(/-fe0f$/i, '');
}

function collectBasenames() {
  const set = new Set();
  for (const e of TWEMOJI_COVERED_EMOJIS) {
    const code = twemoji.convert.toCodePoint(e);
    const base = twemojiAssetFilenameFromCodepoint(code);
    set.add(base);
  }
  return set;
}

function pruneDir(dir, ext, keep) {
  if (!existsSync(dir)) {
    console.warn('[prune-twemoji] skip missing dir', dir);
    return { removed: 0, kept: 0 };
  }
  let removed = 0;
  let kept = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(ext)) continue;
    const base = name.slice(0, -ext.length);
    if (keep.has(base)) {
      kept++;
      continue;
    }
    unlinkSync(join(dir, name));
    removed++;
  }
  return { removed, kept };
}

const keep = collectBasenames();
const assetsRoot = join(FRONTEND_ROOT, 'public', 'twemoji', VERSION, 'assets');
const svgDir = join(assetsRoot, 'svg');
const pngDir = join(assetsRoot, '72x72');

const svg = pruneDir(svgDir, '.svg', keep);
const png = pruneDir(pngDir, '.png', keep);

console.log(
  `[prune-twemoji] keep basenames (${keep.size}): ${[...keep].sort().join(', ')}`,
);
console.log(`[prune-twemoji] svg: kept ${svg.kept}, removed ${svg.removed}`);
console.log(`[prune-twemoji] 72x72: kept ${png.kept}, removed ${png.removed}`);
