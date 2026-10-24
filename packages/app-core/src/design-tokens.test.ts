import { describe, expect, it } from 'vitest';
import { DARK, LIGHT, tokensCss, type Colors } from './design-tokens';

// 웹 tokens.css는 이 스냅샷 파일이다. 토큰을 바꾸면 `vitest run design-tokens -u`로 다시 만든다.
it('웹 tokens.css가 토큰과 같다', async () => {
  await expect(tokensCss()).toMatchFileSnapshot('../../../apps/web/src/tokens.css');
});

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (sh: number) => {
    const c = ((n >> sh) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(16) + 0.7152 * ch(8) + 0.0722 * ch(0);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe.each([
  ['라이트', LIGHT],
  ['다크', DARK],
] as [string, Colors][])('%s 글자 대비 4.5:1 이상', (_, c) => {
  const text = ['ink', 'muted', 'accentText', 'good', 'bad', 'up', 'down'] as const;
  it.each(text)('%s — 카드 · 바탕 위', (k) => {
    expect(contrast(c[k], c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c[k], c.bg)).toBeGreaterThanOrEqual(4.5);
  });
  // 주의 색은 칩 · 안내 글자로 카드 안에만 쓴다(라이트 바탕 위는 4.49:1이라 바탕에 바로 놓지 않는다).
  it('warn — 카드 위', () => {
    expect(contrast(c.warn, c.surface)).toBeGreaterThanOrEqual(4.5);
  });
  it('accent 위 글자', () => {
    expect(contrast(c.accentInk, c.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('그라운드 위 글자', () => {
    expect(contrast(c.onPitch, c.pitch)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.pitchAccent, c.pitch)).toBeGreaterThanOrEqual(4.5);
  });
});
