import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { koSources, setLocale } from '@offside/contracts/i18n';
import '../event-registry.js';
import { EVENTS, eventById } from '../events-data.js';
import { playCareer } from '../__fixtures__/play-career.js';
import type { GameState } from '../types.js';
import { tn } from './names.js';
import { en } from './en/index.js';
import { ja } from './ja/index.js';

// T-11-106 게임 엔진 문구. 네임스페이스(i18n/ko ↔ i18n/en), 이벤트 문구(_events), 저장된 이름 대응표(_names)를 검사하고,
// 같은 시드를 한국어·영어로 돌려 문구 말고는 결과가 똑같은지(언어가 게임을 바꾸지 않는지) 확인한다.
const HANGUL = /[가-힣]/;
const files = readdirSync(new URL('./ko', import.meta.url))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.slice(0, -3));
// T-11-140 일본어(ja)도 영어와 같은 검사를 받는다.
const LANGS = [
  ['en', en],
  ['ja', ja],
] as const;
const dictFiles: Record<string, Record<string, Record<string, unknown>>> = { en: {}, ja: {} };
for (const f of files) {
  await import(`./ko/${f}.ts`);
  for (const [lang] of LANGS)
    dictFiles[lang]![f] = (await import(`./${lang}/${f}.ts`)) as Record<string, unknown>;
}

afterEach(() => setLocale('ko'));

const CAREERS = 16;
/** 언어에 따라 달라도 되는 것 — 로그 문장(쓴 시점의 언어로 남는다)과 이어서 열 결정(이적 시장 안내문 등). */
function strip(s: GameState) {
  return JSON.stringify({ ...s, cid: '', log: s.log.map((l) => l.kind), pending: null });
}

describe('게임 문구 사전', () => {
  it('묶음이 생성 스크립트 결과와 같다', () => {
    execFileSync('node', [
      new URL('../../../../tooling/scripts/i18n-index.mjs', import.meta.url).pathname,
      '--check',
    ]);
    const names = [...koSources().keys()].filter((n) => files.includes(n));
    expect(names.sort()).toEqual([...files].sort());
  });

  it.each(LANGS.flatMap(([lang]) => files.map((f) => [lang, f] as const)))(
    '%s/%s: 키·값 종류가 같고 한글이 남지 않는다',
    (lang, name) => {
      const ko = koSources().get(name)!;
      const d = dictFiles[lang]![name]![name] as Record<string, unknown>;
      expect(d, `${lang}/${name}.ts must export const ${name}`).toBeTypeOf('object');
      expect(Object.keys(d).sort()).toEqual(Object.keys(ko).sort());
      for (const [key, v] of Object.entries(ko)) {
        const e = d[key];
        expect(typeof e, `${name}.${key}`).toBe(typeof v);
        if (typeof e === 'string') expect(e, `${name}.${key}`).not.toMatch(HANGUL);
      }
    },
  );

  it.each(LANGS)('모든 이벤트에 %s 문구가 있고 선택지 수가 같다', (_lang, dict) => {
    const missing = EVENTS.filter((e) => !dict.__events[e.id]).map((e) => e.id);
    expect(missing).toEqual([]);
    for (const e of EVENTS) {
      const t = dict.__events[e.id]!;
      expect(t.choices.length, e.id).toBe(e.choices.length);
      expect(!!t.choices.some((c, i) => !c.fail !== !e.choices[i]!.fail), e.id).toBe(false);
      for (const v of [t.title, ...t.choices.flatMap((c) => [c.label, c.ok, c.fail])])
        if (typeof v === 'string') expect(v, e.id).not.toMatch(HANGUL);
    }
  });
});

describe('언어별 결정성', () => {
  it(`같은 시드면 한국어·영어 커리어 ${CAREERS}개의 결과가 문구 말고는 같다`, () => {
    for (let i = 0; i < CAREERS; i++) {
      setLocale('ko');
      const ko = playCareer(i);
      for (const [lang, dict] of LANGS) {
        setLocale(lang, dict);
        expect(strip(playCareer(i)), `${lang} career ${i}`).toBe(strip(ko));
      }
    }
  });

  it.each(LANGS)('%s로 진행한 커리어의 로그와 저장된 이름에 한글이 남지 않는다', (lang, dict) => {
    setLocale(lang, dict);
    const left = new Set<string>();
    const see = (v: string | undefined) => {
      if (v && HANGUL.test(v)) left.add(v);
    };
    for (let i = 0; i < CAREERS; i++) {
      const s = playCareer(i);
      for (const l of s.log) {
        see(l.t);
        see(l.text);
      }
      const names = [
        ...s.trophies.flatMap((x) => [x.t, x.club]),
        ...s.awards.map((x) => x.t),
        ...(s.miles ?? []).map((x) => x.t),
        ...s.storyLog.flatMap((x) => [x.name, x.ending]),
        ...s.career.flatMap((r) => [
          r.club,
          r.league,
          ...r.honors,
          ...(r.comps ?? []).flatMap((c) => [c.name, c.stage]),
        ]),
        ...s.nat.tours.flatMap((t) => [t.name, t.stage]),
      ];
      for (const n of names) see(tn(n));
    }
    expect([...left].slice(0, 40)).toEqual([]);
  });

  it.each(LANGS)('%s 이벤트 정의는 원래 정의의 조건·효과를 그대로 쓴다', (lang, dict) => {
    setLocale(lang, dict);
    for (const e of EVENTS) {
      const t = eventById(e.id)!;
      expect(t.cond).toBe(e.cond);
      t.choices.forEach((c, i) => expect(c.ok.fx).toBe(e.choices[i]!.ok.fx));
    }
  });
});
