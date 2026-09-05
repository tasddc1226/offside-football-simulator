import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readJson(url: URL): unknown {
  return JSON.parse(readFileSync(url, 'utf8'));
}

describe('career-13-integration fixture: domain 원본과 드리프트 없음', () => {
  it('career-13-integration.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/career-13-integration.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-13-integration/career-13-integration.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });

  it('career-13-integration.golden.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/career-13-integration.golden.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-13-integration/career-13-integration.golden.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });
});
