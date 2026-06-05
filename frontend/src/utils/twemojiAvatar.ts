import twemoji from 'twemoji';

/** 与 `public/twemoji/<version>/assets` 及 npm `twemoji` 包版本对齐。 */
export const TWEMOJI_PACKAGE_VERSION = '14.0.2';

/**
 * 纯函数：解析 Twemoji 资源根（含尾部 `/`），便于单测。
 */
export function resolveTwemojiAssetsBase(
  viteBaseUrl: string,
  viteOverride: string | undefined,
  version: string = TWEMOJI_PACKAGE_VERSION,
): string {
  if (typeof viteOverride === 'string' && viteOverride.trim()) {
    const t = viteOverride.trim();
    return t.endsWith('/') ? t : `${t}/`;
  }
  const base = viteBaseUrl || '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}twemoji/${version}/assets/`;
}

/**
 * Twemoji 静态资源根（含尾部 `/`），形如 `/twemoji/14.0.2/assets/` 或带 base 前缀。
 * 默认同源，不依赖外网 CDN；内网部署时随构建产物一并提供。
 */
export function getTwemojiAssetsBase(): string {
  return resolveTwemojiAssetsBase(
    import.meta.env.BASE_URL || '/',
    import.meta.env.VITE_TWEMOJI_ASSETS_BASE as string | undefined,
  );
}

/**
 * Twemoji 14 资源文件名常省略末尾的 `-fe0f`（VS16），与 {@link twemoji.convert.toCodePoint} 不一致时需归一。
 * 仅处理末尾一段，避免破坏含 ZWJ 的序列。
 */
export function twemojiAssetFilenameFromCodepoint(code: string): string {
  return code.replace(/-fe0f$/i, '');
}

function buildTwemojiUrl(emoji: string, folder: 'svg' | '72x72', ext: string): string | null {
  if (!emoji || emoji.startsWith('http') || emoji.startsWith('data:')) {
    return null;
  }
  try {
    const code = twemoji.convert.toCodePoint(emoji);
    if (!code) return null;
    const file = twemojiAssetFilenameFromCodepoint(code);
    return `${getTwemojiAssetsBase()}${folder}/${file}${ext}`;
  } catch {
    return null;
  }
}

/**
 * Twemoji SVG URL（用 codepoint 直链，避免 parse+正则 在部分构建/环境下取不到 src）。
 */
export function emojiToTwemojiSvgUrl(emoji: string): string | null {
  return buildTwemojiUrl(emoji, 'svg', '.svg');
}

/** PNG 备选（SVG 加载失败时降级）。 */
export function emojiToTwemojiPngUrl(emoji: string): string | null {
  return buildTwemojiUrl(emoji, '72x72', '.png');
}

/** 无 emoji 字形的占位图（避免 SVG 里写字符导致显示成系统彩色 emoji） */
export function neutralAvatarPlaceholderDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="#e8e8e8" rx="8"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * 头像展示 URL：优先 Twemoji SVG，失败路径由 img @error 再试 PNG / 占位。
 */
export function avatarDisplayUrl(emoji: string): string {
  const safe = emoji || '👤';
  if (safe.startsWith('http') || safe.startsWith('data:')) {
    return safe;
  }
  const tw = emojiToTwemojiSvgUrl(safe);
  if (tw) return tw;
  return neutralAvatarPlaceholderDataUri();
}
