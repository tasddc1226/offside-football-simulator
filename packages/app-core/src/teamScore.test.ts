import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from './i18n/core.js';
import { en } from './i18n/en/index.js';
import { ja } from './i18n/ja/index.js';
import { zh } from './i18n/zh/index.js';
import { cupText as C } from './i18n/ko/cup.js';
import { friendText as F } from './i18n/ko/friend.js';
import { seasonRecapText as L } from './i18n/ko/seasonRecap.js';
import { teamMatchText as M } from './i18n/ko/teamMatch.js';
import { teamScoreLabel } from './teamScore.js';

describe('T-11-800 팀 점수 이름(시즌 1 레이팅 · 시즌 2부터 RP)', () => {
  afterEach(() => setLocale('ko'));

  it('프리시즌 · 시즌 1은 레이팅 문구, 시즌 2부터는 RP 문구를 고른다', () => {
    const dict = { name: '레이팅', nameRp: 'RP' };
    expect(teamScoreLabel(0, dict, 'name')).toBe('레이팅');
    expect(teamScoreLabel(1, dict, 'name')).toBe('레이팅');
    expect(teamScoreLabel(2, dict, 'name')).toBe('RP');
    expect(teamScoreLabel(3, dict, 'name')).toBe('RP');
  });

  it('결산 숫자 칸 · 공유 카드 순위 · 친선전 칩 · 친구 안내 · 컵 규칙을 시즌으로 가른다', () => {
    expect([teamScoreLabel(1, L, 'rating'), teamScoreLabel(2, L, 'rating')]).toEqual([
      '레이팅',
      'RP',
    ]);
    expect([teamScoreLabel(1, L, 'teamRank'), teamScoreLabel(2, L, 'teamRank')]).toEqual([
      '레이팅 순위',
      'RP 순위',
    ]);
    expect(teamScoreLabel(1, M, 'friendlyNote')).toBe('친선전이라 레이팅은 그대로예요.');
    expect(teamScoreLabel(2, M, 'friendlyNote')).toBe('친선전이라 RP는 그대로예요.');
    expect(teamScoreLabel(2, F, 'info')({ left: 3, per: 10 })).toBe(
      '친선전은 RP와 전적에 들어가지 않아요. 오늘 남은 친선전 3/10',
    );
    expect(teamScoreLabel(1, C, 'ruleLock')({ time: '20:00' })).toContain('전적·레이팅');
    expect(teamScoreLabel(2, C, 'ruleLock')({ time: '20:00' })).toContain('전적·RP');
  });

  it('지금 언어로 읽는다(영어 · 일본어 · 번체 중국어도 시즌 2부터 RP)', () => {
    setLocale('en', en);
    expect([teamScoreLabel(1, L, 'honorTeam'), teamScoreLabel(2, L, 'honorTeam')]).toEqual([
      'Team rating',
      'Team RP',
    ]);
    setLocale('ja', ja);
    expect([teamScoreLabel(1, L, 'honorTeam'), teamScoreLabel(2, L, 'honorTeam')]).toEqual([
      'チームレーティング',
      'チームRP',
    ]);
    setLocale('zh', zh);
    expect([teamScoreLabel(1, L, 'honorTeam'), teamScoreLabel(2, L, 'honorTeam')]).toEqual([
      '球隊積分',
      '球隊 RP',
    ]);
  });
});
