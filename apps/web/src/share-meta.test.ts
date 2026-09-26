import type { PublicHofEntry } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { BRAND_VERSION, CAREER_OG_BANDS, createHeadMarkup } from '../scripts/seo.mjs';
import { POS } from './game/data.js';
import { LEGEND_BANDS } from './game/legend-bands.js';
import { POS_LABEL } from './game/pos-label.js';
import { careerShareMeta, injectShareMeta, OG_VERSION } from './share-meta.js';

const entry = {
  id: '0f8a3b52-6c1d-4e0a-9b7e-1a2b3c4d5e6f',
  name: '손흥<민>',
  pos: 'FW',
  number: 7,
  retireAge: 36,
  peak: 88,
  legendScore: 612,
  apps: 540,
  goals: 231,
  assists: 98,
  trophies: 6,
  awards: 3,
  caps: 110,
  ballon: 0,
  lastClub: '토트넘',
  retiredAt: '2026-09-26T00:00:00.000Z',
  hasDetail: true,
  title: null,
} as unknown as PublicHofEntry;

describe('careerShareMeta', () => {
  it('이름·등급·기록으로 제목과 설명을 만든다', () => {
    const m = careerShareMeta(entry, 'https://offside-lab.com');
    expect(m.title).toBe('손흥<민> · 월드클래스 레전드 (레전드 612점)');
    expect(m.description).toContain(
      '36세 은퇴 · 540경기 231골 98도움 · 트로피 6개 · 마지막 소속 토트넘.',
    );
    expect(m.image).toBe(`https://offside-lab.com/og-career-lg_world-${BRAND_VERSION}.png`);
    expect(m.url).toBe(`https://offside-lab.com/career/${entry.id}`);
  });

  it('이름이 없으면 익명 표기, 소속이 없으면 소속을 뺀다', () => {
    const m = careerShareMeta(
      { ...entry, name: null, number: null, lastClub: '', legendScore: 10 },
      'https://x.test',
    );
    expect(m.title).toBe('익명의 공격수 · 평범한 축구 커리어 (레전드 10점)');
    expect(m.description).not.toContain('마지막 소속');
  });

  it('포지션 이름·이미지 버전·등급 이미지가 게임·빌드 설정과 맞다', () => {
    for (const [pos, label] of Object.entries(POS_LABEL))
      expect(POS[pos as keyof typeof POS].label).toBe(label);
    expect(OG_VERSION).toBe(BRAND_VERSION);
    expect(CAREER_OG_BANDS.map(([id, , rarity]) => [id, rarity])).toEqual(
      LEGEND_BANDS.map(([id, , rarity]) => [id, rarity]),
    );
  });
});

describe('injectShareMeta', () => {
  const shell = `<html><head><title>오프사이드</title>${createHeadMarkup({ indexingEnabled: false }, '/', true)}</head></html>`;

  it('제목·설명·og 메타를 바꾸고 og:url을 붙인다(이스케이프 포함)', () => {
    const html = injectShareMeta(shell, careerShareMeta(entry, 'https://offside-lab.com'));
    expect(html).toContain('<title>손흥&lt;민&gt; · 월드클래스 레전드 (레전드 612점)</title>');
    expect(html).toContain(
      '<meta property="og:title" content="손흥&lt;민&gt; · 월드클래스 레전드 (레전드 612점)"',
    );
    expect(html).toMatch(/<meta name="description" content="36세 은퇴/);
    expect(html).toMatch(/<meta property="og:description" content="36세 은퇴/);
    expect(html).toContain(
      `<meta property="og:image" content="https://offside-lab.com/og-career-lg_world-${BRAND_VERSION}.png"`,
    );
    expect(html).toContain(
      `<meta property="og:url" content="https://offside-lab.com/career/${entry.id}" />`,
    );
    expect(html.match(/og:url/g)).toHaveLength(1);
    expect(html).toContain('noindex');
  });

  // T-10-034: 치환 문자열로 넣으면 이름 속 `$'`·`$&`가 문서 나머지를 제목 안으로 끌어왔다.
  it('이름에 $ 치환 패턴이 있어도 그대로 들어간다', () => {
    const html = injectShareMeta(
      shell,
      careerShareMeta({ ...entry, name: "A$'B$&C$1" } as PublicHofEntry, 'https://offside-lab.com'),
    );
    expect(html).toContain("<title>A$'B$&amp;C$1 · ");
    expect(html).toContain(`<meta property="og:title" content="A$'B$&amp;C$1 · `);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.length).toBeLessThan(shell.length + 1000);
  });
});
