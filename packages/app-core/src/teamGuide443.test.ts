// T-11-443 구단주 팀 · 컵 · 감독 안내 다듬기 — 감독 확정 확인 줄, 컵 신청 확인 · 편성 버튼, 상대 레이팅 차이,
// 장면 남은 초 읽기, 방출 목록 한 줄.
import { describe, expect, it } from 'vitest';
import { cupEnterConfirmLines, cupEntryTeamAction } from './cupEntry.js';
import { cupText as C } from './i18n/ko/cup.js';
import { managerText as MG } from './i18n/ko/manager.js';
import { teamLiveText as TL } from './i18n/ko/teamLive.js';
import { teamMomentsText as TM } from './i18n/ko/teamMoments.js';
import { finishConfirmLines } from './manager.js';
import { releaseRowInfo } from './market.js';
import { MOMENT_SPEAK_LAST, liveSkipLabel, momentTimerSpoken } from './teamMoments.js';
import { ratingGap } from './teamText.js';

describe('finishConfirmLines', () => {
  it('감독 칸에 앉힐 수 있다는 줄과 되돌릴 수 없다는 줄', () => {
    expect(finishConfirmLines()).toEqual([MG.finishSeat, MG.finishFinal]);
  });
});

describe('cupEntryTeamAction', () => {
  const el = (reason: string | null, ok = false) => ({ ok, reason, filled: 3 }) as never;
  it('팀이 없으면 팀 만들기, 편성으로 풀리는 이유면 편성으로 가기', () => {
    expect(cupEntryTeamAction(el('no-team'))).toBe(C.toMakeTeam);
    for (const r of ['not-enough', 'listed', 'over-cap'])
      expect(cupEntryTeamAction(el(r))).toBe(C.toLineup);
  });
  it('편성으로 풀리지 않는 이유 · 신청 가능 · 정보 없음이면 버튼 없음', () => {
    for (const r of ['full', 'closed', 'entered-other'])
      expect(cupEntryTeamAction(el(r))).toBeNull();
    expect(cupEntryTeamAction(el(null, true))).toBeNull();
    expect(cupEntryTeamAction(null)).toBeNull();
  });
});

describe('cupEnterConfirmLines', () => {
  it('구간 상한이 있으면 상한 줄을 넣는다', () => {
    expect(cupEnterConfirmLines({ ovrMax: 80 })).toEqual([
      C.enterLockNote,
      C.divisionLockNote({ cap: 80 }),
      C.enterAskWithdraw,
    ]);
    expect(cupEnterConfirmLines({ ovrMax: null })).toEqual([C.enterLockNote, C.enterAskWithdraw]);
  });
});

describe('ratingGap', () => {
  it('상대 − 내 팀 차이를 부호와 함께', () => {
    expect(ratingGap(1200, 1232)).toMatchObject({ d: 32, text: '+32' });
    expect(ratingGap(1200, 1185)).toMatchObject({ d: -15, text: '−15' });
    expect(ratingGap(1200, 1200)).toMatchObject({ d: 0, text: '±0' });
  });
  it('스크린리더 문장', () => {
    expect(ratingGap(1200, 1232).aria).toContain('32');
    expect(ratingGap(1200, 1185).aria).toContain('15');
    expect(ratingGap(1200, 1200).aria).toBeTruthy();
  });
});

describe('momentTimerSpoken', () => {
  it('마지막 몇 초 전까지는 같은 문장이라 다시 읽히지 않는다', () => {
    const first = momentTimerSpoken(15, 15);
    for (let s = 15; s > MOMENT_SPEAK_LAST; s--) expect(momentTimerSpoken(s, 15)).toBe(first);
    expect(first).toBe(TM.timer({ s: 15 }));
  });
  it('마지막 몇 초는 초마다 바뀐다', () => {
    const last = [3, 2, 1].map((s) => momentTimerSpoken(s, 15));
    expect(new Set(last).size).toBe(3);
    expect(last[0]).toBe(TM.timerLast({ s: 3 }));
  });
});

describe('liveSkipLabel', () => {
  it('남은 장면이 있으면 감독에게 맡긴다고 적는다', () => {
    expect(liveSkipLabel(2)).toBe(TM.skipToManager);
    expect(liveSkipLabel(0)).toBe(TL.skip);
  });
});

describe('releaseRowInfo', () => {
  it('세부 포지션 · 최고 OVR · 레전드 점수', () => {
    const t = releaseRowInfo({ pos: 'FW', dpos: 'ST', peak: 84, legendScore: 1234 });
    expect(t).toContain('ST');
    expect(t).toContain('84');
    expect(t).toMatch(/1,?234/);
  });
  it('세부 포지션이 없으면 기본 자리로', () => {
    expect(releaseRowInfo({ pos: 'GK', dpos: null, peak: 70, legendScore: null })).toContain('GK');
  });
});
