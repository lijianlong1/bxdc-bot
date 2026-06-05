import { describe, expect, it } from 'vitest';
import {
  emojiToTwemojiSvgUrl,
  resolveTwemojiAssetsBase,
  twemojiAssetFilenameFromCodepoint,
  TWEMOJI_PACKAGE_VERSION,
} from './twemojiAvatar';

describe('resolveTwemojiAssetsBase', () => {
  it('joins BASE_URL with twemoji path and does not use https CDN', () => {
    expect(resolveTwemojiAssetsBase('/', undefined)).toBe(`/twemoji/${TWEMOJI_PACKAGE_VERSION}/assets/`);
    expect(resolveTwemojiAssetsBase('/app/', undefined)).toBe(`/app/twemoji/${TWEMOJI_PACKAGE_VERSION}/assets/`);
  });

  it('normalizes trailing slash on base', () => {
    expect(resolveTwemojiAssetsBase('/', undefined)).toBe(`/twemoji/${TWEMOJI_PACKAGE_VERSION}/assets/`);
  });

  it('uses VITE_TWEMOJI_ASSETS_BASE override when set', () => {
    expect(resolveTwemojiAssetsBase('/', 'https://cdn.example.com/tw/')).toBe('https://cdn.example.com/tw/');
    expect(resolveTwemojiAssetsBase('/', 'https://cdn.example.com/tw')).toBe('https://cdn.example.com/tw/');
  });
});

describe('twemojiAssetFilenameFromCodepoint', () => {
  it('strips trailing VS16 for Twemoji 14 on-disk filenames', () => {
    expect(twemojiAssetFilenameFromCodepoint('2699-fe0f')).toBe('2699');
    expect(twemojiAssetFilenameFromCodepoint('1f6e0-fe0f')).toBe('1f6e0');
  });
});

describe('emojiToTwemojiSvgUrl', () => {
  it('builds relative svg path under default base', () => {
    const url = emojiToTwemojiSvgUrl('🤖');
    expect(url).toMatch(new RegExp(`/twemoji/${TWEMOJI_PACKAGE_VERSION}/assets/svg/[a-f0-9-]+\\.svg$`));
    expect(url?.startsWith('http')).toBe(false);
  });

  it('uses basename without redundant -fe0f for gear emoji', () => {
    const url = emojiToTwemojiSvgUrl('⚙️');
    expect(url).toContain(`/svg/2699.svg`);
  });
});
