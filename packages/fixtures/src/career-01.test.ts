import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readJson(url: URL): unknown {
  return JSON.parse(readFileSync(url, 'utf8'));
}

describe('career-01 fixture: domain 원본과 드리프트 없음', () => {
  it('career-01.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/career-01.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-01/career-01.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });

  it('career-01.golden.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/career-01.golden.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-01/career-01.golden.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });

  it('ruleset-proto.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/ruleset-proto.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-01/ruleset-proto.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });
});
