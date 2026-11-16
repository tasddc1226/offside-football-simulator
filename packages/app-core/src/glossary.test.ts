import { afterEach, describe, expect, it } from 'vitest';
import { GLOSSARY, TERM_HELP, glossaryGroups, term } from './glossary.js';
import { en } from './i18n/en/index.js';
import { ja } from './i18n/ja/index.js';
import { zh } from './i18n/zh/index.js';
import { setLocale } from './i18n/core.js';

const ids = GLOSSARY.flatMap((g) => [...g.terms]);

describe('T-11-732 용어 사전', () => {
  afterEach(() => setLocale('ko'));

  it('용어는 한 번씩만 나오고 묶음 순서대로 펼쳐진다', () => {
    expect(new Set(ids).size).toBe(ids.length);
    const groups = glossaryGroups();
    expect(groups.map((g) => g.id)).toEqual(GLOSSARY.map((g) => g.id));
    expect(groups[0]!.name).toBe('게임 숫자');
    expect(groups[0]!.terms[0]).toEqual(term('ovr'));
    expect(term('ovr').term).toBe('OVR');
  });

  it('"?" 버튼이 띄우는 용어는 모두 사전에 있다', () => {
    for (const list of Object.values(TERM_HELP)) for (const id of list) expect(ids).toContain(id);
  });

  it('네 언어 모두 용어 · 설명이 비지 않고, 설명을 대시로 잇지 않는다', () => {
    for (const [lang, dict] of [
      ['ko', undefined],
      ['en', en],
      ['ja', ja],
      ['zh', zh],
    ] as const) {
      setLocale(lang, dict);
      for (const g of glossaryGroups()) {
        expect(g.name.trim()).not.toBe('');
        for (const t of g.terms) {
          expect(t.term.trim(), `${lang} ${t.id}`).not.toBe('');
          expect(t.desc.length, `${lang} ${t.id}`).toBeGreaterThan(5);
          expect(t.desc, `${lang} ${t.id}`).not.toMatch(/—/);
        }
      }
    }
    setLocale('en', en);
    expect(term('loan').term).toBe('Loan');
    setLocale('ja', ja);
    expect(term('market').term).toBe('移籍市場');
    setLocale('zh', zh);
    expect(term('cleanSheet').term).toBe('零失球');
  });
});
