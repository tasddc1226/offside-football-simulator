import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readJson(url: URL): unknown {
  return JSON.parse(readFileSync(url, 'utf8'));
}

describe('career-06-settled fixture: domain 원본과 드리프트 없음', () => {
  it('career-06-settled.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/career-06-settled.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-06-settled/career-06-settled.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });

  it('career-06-settled-season.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/career-06-settled-season.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-06-settled/career-06-settled-season.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });

  it('career-06-settled.golden.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/career-06-settled.golden.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-06-settled/career-06-settled.golden.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });
});
