import { afterEach, describe, expect, it } from 'vitest';
import { setLatestBalance } from '@offside/game/balance';
import { customLeagues } from './clubCustom.js';

// T-11-457 구단명 설정은 시즌 2 리그를 newLeagues가 켜질 때까지 숨긴다.
describe('구단명 설정 리그 목록', () => {
  afterEach(() => setLatestBalance(null));
  const ids = () => customLeagues().map((l) => l.id);
  it('꺼져 있으면 새 리그가 없고, 서버 최신 밸런스에서 켜면 함께 보인다', () => {
    expect(ids()).not.toContain('bra');
    expect(ids().at(-1)).toBe('pl');
    setLatestBalance({ version: 2, values: { newLeagues: 1 } });
    expect(ids()).toEqual(expect.arrayContaining(['csl', 'spl', 'bra', 'por']));
  });
});
