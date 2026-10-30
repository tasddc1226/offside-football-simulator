import { describe, expect, it } from 'vitest';
import { careerShareUrl, publicDocPath } from './links.js';

describe('T-11-588 언어별 공개 문서 · 공유 링크', () => {
  it('가이드 · FAQ는 한국어면 지금 주소, 다른 언어면 /<언어>/ 아래로 연다', () => {
    expect(publicDocPath('/guide/', 'ko')).toBe('/guide/');
    expect(publicDocPath('/faq/', 'ja')).toBe('/ja/faq/');
    expect(publicDocPath('/guide/', 'zh')).toBe('/zh/guide/');
  });
  it('공유 링크는 한국어가 아니면 ?lang=을 붙인다', () => {
    expect(careerShareUrl('https://offside-lab.com', 'abc', 'ko')).toBe(
      'https://offside-lab.com/career/abc',
    );
    expect(careerShareUrl('https://offside-lab.com', 'abc', 'en')).toBe(
      'https://offside-lab.com/career/abc?lang=en',
    );
  });
});
