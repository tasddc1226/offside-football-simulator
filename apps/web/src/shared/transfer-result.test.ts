import type { CareerState } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import {
  committedTransferRevision,
  isCurrentTransferResultRevision,
  resolveTransferResultView,
  transferResultNextScreen,
} from './transfer-result.js';

function makeState(overrides: Partial<CareerState> = {}): CareerState {
  return {
    careerId: 'car-result',
    status: 'ACTIVE',
    player: { profile: { baseOvr: 64 } },
    context: { tacticalFit: 77, squadStatus: 60, positionProficiency: 80 },
    contract: {
      id: 'CTR-2',
      offerId: 'OFR-2',
      teamId: 'team-new',
      teamName: '새 팀',
      leagueTier: 1,
      lengthSeasons: 2,
      wageMinorPerWeek: 1000,
      signingBonusMinor: 0,
      rolePromise: 'ROTATION',
      shirtNumber: 7,
      signatureType: 'AUTO',
      signedAtRevision: 2,
      kind: 'PERMANENT',
      appearancePromise: { minutesShareBp: 4500 },
      positionPlan: 'W',
      suspended: false,
      loan: null,
      promiseBreaches: 0,
    },
    clubHistory: [
      { teamId: 'team-old', teamName: '옛 팀', leagueTier: 1, kind: 'PERMANENT', fromSeasonIndex: 0, toSeasonIndex: 1, endReason: 'TRANSFERRED', contractId: 'CTR-1' },
      { teamId: 'team-new', teamName: '새 팀', leagueTier: 1, kind: 'PERMANENT', fromSeasonIndex: 1, toSeasonIndex: null, endReason: null, contractId: 'CTR-2' },
    ],
    timeline: [{ revision: 2, kind: 'TRANSFERRED', refId: 'CTR-2' }],
    relationshipLog: [{ target: 'fans', delta: -5, sourceId: 'unrelated-event', reasonTag: '과거 이벤트 사유', seasonIndex: 0, step: 2 }],
    season: null,
    ...overrides,
  } as CareerState;
}

describe('T-3-005 SCR-020 result projection', () => {
  it('전환과 연결되지 않은 과거 relationshipLog reasonTag를 새 이적 사유로 쓰지 않는다', () => {
    const view = resolveTransferResultView(makeState(), 2);
    expect(view?.reasonTag).toContain('새 구단 제안과 계약 조건을 확정했습니다.');
    expect(view?.reasonTag).toContain('전술 적합도 77');
    expect(view?.reasonTag).toContain('경쟁 상태: 프리시즌에서 확정');
    expect(view?.reasonTag).toContain('새 소속 전환에 따른 현재 관계 상태를 저장했습니다.');
    expect(view?.reasonTag).not.toContain('과거 이벤트 사유');
  });

  it('저장된 context·season에서 전술 적합도와 경쟁 상태를 복원하고 결과 문구에 고정한다', () => {
    const view = resolveTransferResultView(
      makeState({
        season: {
          teamId: 'team-new',
          selection: { candidates: [{ id: 'PLAYER', rank: 2, appearance: 'SUB' }] },
        } as CareerState['season'],
      }),
      2,
    );
    expect(view?.contract).toMatchObject({ tacticalFit: 77, competition: '현재 선발 경쟁 2위 · 교체' });
    expect(view?.reasonTag).toContain('전술 적합도 77 · 경쟁 상태: 현재 선발 경쟁 2위 · 교체');
  });

  it('후속 이적 뒤 예전 rev URL은 최신 contract와 섞이지 않도록 거부한다', () => {
    const state = makeState({
      contract: { ...makeState().contract!, id: 'CTR-3', offerId: 'OFR-3', teamId: 'team-third', teamName: '세 번째 팀' },
      clubHistory: [
        ...makeState().clubHistory,
        { teamId: 'team-third', teamName: '세 번째 팀', leagueTier: 1, kind: 'PERMANENT', fromSeasonIndex: 2, toSeasonIndex: null, endReason: null, contractId: 'CTR-3' },
      ],
      timeline: [
        { revision: 2, kind: 'TRANSFERRED', refId: 'CTR-2', age: 18, step: 7 },
        { revision: 3, kind: 'TRANSFERRED', refId: 'CTR-3', age: 19, step: 7 },
      ],
    });
    expect(resolveTransferResultView(state, 2)).toBeNull();
    expect(resolveTransferResultView(state, 3)?.newTeam).toBe('세 번째 팀');
  });

  it('같은 latest transfer라도 이후 비이적 명령으로 record revision이 커진 옛 URL은 거부한다', () => {
    const state = makeState({
      timeline: [
        { revision: 2, kind: 'TRANSFERRED', refId: 'CTR-2', age: 18, step: 7 },
        { revision: 3, kind: 'SEASON_STARTED', refId: null, age: 18, step: 1 },
      ],
    });
    expect(resolveTransferResultView(state, 2)).not.toBeNull();
    expect(isCurrentTransferResultRevision(state, 3, 2)).toBe(false);
    expect(isCurrentTransferResultRevision(state, 2, 2)).toBe(true);
  });

  it('response-loss 복구는 transition revision이 현재 record revision일 때만 허용한다', () => {
    expect(committedTransferRevision(makeState(), 2, 'OFR-2')).toBe(2);
    expect(committedTransferRevision(makeState(), 3, 'OFR-2')).toBeNull();
  });

  it('활성 시즌 중 결과 CTA는 대시보드, 결산 뒤에만 프리시즌이다', () => {
    expect(transferResultNextScreen(makeState({ season: {} as CareerState['season'] }))).toBe('DASHBOARD');
    expect(transferResultNextScreen(makeState({ season: null }))).toBe('PRESEASON');
  });
});
