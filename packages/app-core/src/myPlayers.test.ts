import { describe, expect, it } from 'vitest';
import { myPlayerNation } from './myPlayers.js';

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
