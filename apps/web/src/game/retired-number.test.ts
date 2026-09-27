import { RN_LEAGUE_NAME, RN_LEAGUE_TIER } from '@offside/contracts/retired-numbers';
import { describe, expect, it } from 'vitest';
import { LEAGUES } from './data.js';

// T-10-076 영구결번 판정은 서버만 한다(기준값을 웹 번들에 싣지 않는다). 판정 규칙이 가진 리그 등급 표가 게임과
// 어긋나지 않는지만 여기서 본다.
describe('영구결번 판정 규칙 (T-10-076)', () => {
  it('판정 규칙의 리그 등급이 게임 리그 표와 같다', () => {
    expect(RN_LEAGUE_TIER).toEqual(Object.fromEntries(LEAGUES.map((l) => [l.name, l.tier])));
    expect(RN_LEAGUE_NAME).toEqual(Object.fromEntries(LEAGUES.map((l) => [l.id, l.name])));
  });
});
