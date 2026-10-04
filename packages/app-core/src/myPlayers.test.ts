import { describe, expect, it } from 'vitest';
import { retireValue } from '@offside/contracts/market-value';
import { myPlayerNation, myPlayerValue } from './myPlayers.js';

describe('내 은퇴 선수 국적', () => {
  it.each(['BR', 'GB-ENG', 'KR'])('새 로컬·다른 기기 계정·병합 기록의 %s를 보존한다', (nation) => {
    expect(myPlayerNation({ nation })).toBe(nation);
    expect(myPlayerNation(undefined, { nation })).toBe(nation);
    expect(myPlayerNation({}, { nation })).toBe(nation);
    expect(myPlayerNation({ nation }, {})).toBe(nation);
    expect(myPlayerNation({ nation }, { nation: null })).toBe(nation);
  });

  it('기록된 로컬 국적을 보존하고 국적 없는 옛 기록에는 나라를 추측하지 않는다', () => {
    expect(myPlayerNation({ nation: 'BR' }, { nation: 'KR' })).toBe('BR');
    expect(myPlayerNation({}, {})).toBeUndefined();
    expect(myPlayerNation({ nation: null }, { nation: null })).toBeUndefined();
    expect(myPlayerNation({ nation: 'invalid' }, { nation: 'GB-ENG' })).toBe('GB-ENG');
    expect(myPlayerNation({ nation: 'invalid' })).toBeUndefined();
    expect(myPlayerNation()).toBeUndefined();
  });
});

describe('내 은퇴 선수 은퇴 가치', () => {
  const career = [
    { league: 'K리그1', ovr: 70, age: 24 },
    { league: 'K리그1', ovr: 75, age: 27 },
  ];
  it('계정 값을 먼저 쓰고, 없으면 이 기기 시즌 기록으로 계산한다', () => {
    expect(myPlayerValue({ score: 300, detail: { career } }, { value: 123_000 })).toBe(123_000);
    expect(myPlayerValue({ score: 300, detail: { career } }, { value: null })).toBe(
      retireValue(career, 300),
    );
    expect(myPlayerValue({ score: 300, detail: { career } })).toBeGreaterThan(0);
  });
  it('계정 값도 시즌 기록도 없으면 0', () => {
    expect(myPlayerValue({ score: 300 })).toBe(0);
    expect(myPlayerValue(undefined, {})).toBe(0);
  });
});
