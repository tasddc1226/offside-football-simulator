import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readJson(url: URL): unknown {
  return JSON.parse(readFileSync(url, 'utf8'));
}

describe('career-10-transfer fixture: domain 원본과 드리프트 없음', () => {
  it('career-10-transfer.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/career-10-transfer.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-10-transfer/career-10-transfer.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });

  it('career-10-transfer.golden.json이 domain __fixtures__ 원본과 같다', () => {
    const domainOriginal = readJson(new URL('../../domain/src/__fixtures__/career-10-transfer.golden.json', import.meta.url));
    const fixturesCopy = readJson(new URL('./career-10-transfer/career-10-transfer.golden.json', import.meta.url));
    expect(fixturesCopy).toEqual(domainOriginal);
  });
});
