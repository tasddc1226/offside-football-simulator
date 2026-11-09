import { describe, expect, it } from 'vitest';
import { campaignQuery } from '@offside/contracts/acquisition';
import { careerShareUrl, publicDocPath } from './links.js';

describe('T-11-588 언어별 공개 문서 · 공유 링크', () => {
  it('가이드 · FAQ는 한국어면 지금 주소, 다른 언어면 /<언어>/ 아래로 연다', () => {
    expect(publicDocPath('/guide/', 'ko')).toBe('/guide/');
    expect(publicDocPath('/faq/', 'ja')).toBe('/ja/faq/');
    expect(publicDocPath('/guide/', 'zh')).toBe('/zh/guide/');
  });
  it('공유 링크는 한국어가 아니면 ?lang=을 붙이고, 공유한 곳을 허용 목록 UTM으로 붙인다(T-11-676)', () => {
    expect(careerShareUrl('https://offside-lab.com', 'abc', 'app', 'ko')).toBe(
      'https://offside-lab.com/career/abc?utm_source=offside_app&utm_medium=share&utm_campaign=career_share',
    );
    expect(careerShareUrl('https://offside-lab.com', 'abc', 'web', 'en')).toBe(
      'https://offside-lab.com/career/abc?lang=en&utm_source=offside_web&utm_medium=share&utm_campaign=career_share',
    );
  });
  it('공유 링크의 UTM은 유입 허용 목록을 그대로 통과한다(T-11-676)', () => {
    const url = careerShareUrl('https://offside-lab.com', 'abc', 'app', 'ja');
    expect(campaignQuery(url)).toBe(
      '?utm_source=offside_app&utm_medium=share&utm_campaign=career_share',
    );
  });
});
