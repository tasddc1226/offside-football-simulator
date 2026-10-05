import { readdirSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { koSources, ns, resolveLocale, setLocale, AUTO_DETECT } from './core';
import { en } from './en/index';

// 모든 한국어 네임스페이스와 같은 이름의 영어 사전을 불러온다(ns 이름 중복이면 여기서 터진다).
// 파일 이름 = ns() 이름 = 영어 파일의 export 이름 = en/index.ts의 키.
const files = readdirSync(new URL('./ko', import.meta.url))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.slice(0, -3));
const enFiles: Record<string, Record<string, unknown>> = {};
for (const f of files) {
  await import(`./ko/${f}.ts`);
  enFiles[f] = (await import(`./en/${f}.ts`)) as Record<string, unknown>;
}

afterEach(() => setLocale('ko'));

describe('i18n core', () => {
  it('읽을 때마다 지금 언어의 문구를 고르고, 영어에 없으면 한국어로', () => {
    const t = ns('__test', { a: '가', b: (p: { n: number }) => `${p.n}개` });
    expect(t.a).toBe('가');
    setLocale('en', { __test: { b: (p: { n: number }) => `${p.n} items` } });
    expect(t.a).toBe('가');
    expect(t.b({ n: 2 })).toBe('2 items');
    setLocale('ko');
    expect(t.b({ n: 2 })).toBe('2개');
  });

  it('같은 이름의 네임스페이스는 둘 수 없다', () => {
    ns('__dup', { a: 'x' });
    expect(() => ns('__dup', { a: 'y' })).toThrow();
  });

  it('고른 언어가 우선, 아니면 기기 언어(자동 감지가 켜졌을 때)', () => {
    expect(resolveLocale('en', ['ko-KR'])).toBe('en');
    expect(resolveLocale('ko', ['en-US'])).toBe('ko');
    expect(resolveLocale(null, ['ko-KR', 'en-US'])).toBe('ko');
    expect(resolveLocale('fr', [])).toBe('ko');
    expect(resolveLocale(null, ['en-US'])).toBe(AUTO_DETECT ? 'en' : 'ko');
    expect(resolveLocale(null, ['ja-JP'])).toBe(AUTO_DETECT ? 'en' : 'ko');
  });
});

describe('영어 사전', () => {
  it('파일 이름과 네임스페이스 이름이 같고, en/index.ts가 모두 묶는다', () => {
    const names = [...koSources().keys()].filter((n) => !n.startsWith('__'));
    expect(names.sort()).toEqual([...files].sort());
    expect(Object.keys(en).sort()).toEqual([...files].sort());
  });

  it.each(files)('%s: 키·값 종류가 같고 영어에 한글이 남지 않는다', (name) => {
    const ko = koSources().get(name)!;
    const d = enFiles[name]![name] as Record<string, unknown>;
    expect(d, `en/${name}.ts must export const ${name}`).toBeTypeOf('object');
    expect(Object.keys(d).sort()).toEqual(Object.keys(ko).sort());
    for (const [key, v] of Object.entries(ko)) {
      const e = d[key];
      expect(typeof e, `${name}.${key}`).toBe(typeof v);
      if (typeof e === 'string') {
        if ((v as string).trim()) expect(e.trim(), `${name}.${key}`).not.toBe('');
        expect(e, `${name}.${key}`).not.toMatch(/[가-힣]/);
      }
    }
  });
});
