import type { CareerState } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import {
  committedTransferRevision,
  isCurrentTransferResultRevision,
  latestTransferRevision,
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

  // T-4-011: SCR-020 잔류(STAY) 결과 — INTEREST 시장에서 안전 잔류를 수락하면 `buildStayState`가
  // 계약·clubHistory를 바꾸지 않고 `OFFER_REJECTED(refId 'ALL')`만 남긴다.
  it('INTEREST 시장 안전 잔류(OFFER_REJECTED ALL)를 STAY 결과로 재구성하고 관계·평판 변화 없음을 명시한다', () => {
    const state = makeState({
      timeline: [
        { revision: 2, kind: 'TRANSFERRED', refId: 'CTR-2', age: 18, step: 7 },
        { revision: 3, kind: 'SEASON_STARTED', refId: null, age: 18, step: 1 },
        { revision: 24, kind: 'OFFER_REJECTED', refId: 'ALL', age: 19, step: 12 },
      ],
    });
    const view = resolveTransferResultView(state, 24, 3);
    expect(view?.kind).toBe('STAY');
    expect(view?.kindLabel).toBe('잔류');
    expect(view?.previousTeam).toBe('새 팀');
    expect(view?.newTeam).toBe('새 팀');
    expect(view?.title).toContain('새 팀에 잔류합니다');
    expect(view?.contract).not.toBeNull();
    expect(view?.baseOvr.before).toBe(view?.baseOvr.after);
    expect(view?.reasonTag).toContain('관심을 보인 구단 3곳의 제안');
    expect(view?.reasonTag).toContain('남은 계약 1시즌');
    expect(view?.reasonTag).toContain('시장 사유: 타 구단 관심');
    expect(view?.reasonTag).toContain('관계·평판 변화는 없습니다.');
  });

  it('interestedClubCount 없이(새로고침·딥링크) 재구성해도 STAY 카드는 개수 없이 그대로 렌더된다', () => {
    const state = makeState({
      timeline: [
        { revision: 2, kind: 'TRANSFERRED', refId: 'CTR-2', age: 18, step: 7 },
        { revision: 24, kind: 'OFFER_REJECTED', refId: 'ALL', age: 19, step: 12 },
      ],
    });
    const view = resolveTransferResultView(state, 24);
    expect(view?.kind).toBe('STAY');
    expect(view?.reasonTag).toContain('관심을 보인 구단들의 제안');
    expect(view?.reasonTag).not.toContain('undefined');
  });

  it('EXPIRED 시장 안전 잔류(재계약, CONTRACT_RENEWED)는 STAY가 아니라 기존 RENEWAL 결과로 남는다', () => {
    const state = makeState({
      timeline: [
        { revision: 2, kind: 'TRANSFERRED', refId: 'CTR-2', age: 18, step: 7 },
        { revision: 24, kind: 'CONTRACT_RENEWED', refId: 'CTR-2', age: 20, step: 12 },
      ],
    });
    const view = resolveTransferResultView(state, 24);
    expect(view?.kind).toBe('RENEWAL');
    expect(view?.kindLabel).not.toBe('잔류');
  });

  it('시즌 중 사전 재계약은 현재 계약이 아니라 저장된 nextContract 조건과 적용 시점을 보여준다', () => {
    const current = makeState().contract!;
    const future = {
      ...current,
      id: 'CTR-FUTURE',
      offerId: 'OFR-17-0',
      lengthSeasons: 2,
      wageMinorPerWeek: 840_000,
      rolePromise: 'STARTER' as const,
      appearancePromise: { minutesShareBp: 6500 },
      signedAtRevision: 18,
      signedSeasonIndex: 2,
    };
    const state = makeState({
      season: { teamId: current.teamId } as CareerState['season'],
      nextContract: future,
      timeline: [{ revision: 18, kind: 'CONTRACT_RENEWED', refId: future.id, age: 18, step: 7 }],
    });

    const view = resolveTransferResultView(state, 18);
    expect(view?.contract).toMatchObject({
      lengthSeasons: 2,
      wageMinorPerWeek: 840_000,
      role: '주전',
      appearanceSharePercent: 65,
      appliesAt: '이번 시즌 종료 후 적용',
    });
    expect(view?.title).toBe('새 팀과 계약을 갱신했습니다');
    expect(committedTransferRevision(state, 18, 'OFR-17-0')).toBe(18);
  });

  it('개별 제안 거절(refId != ALL)은 시장이 아직 열려 있다는 뜻이라 결과 화면 전환으로 취급하지 않는다', () => {
    const state = makeState({
      timeline: [
        { revision: 2, kind: 'TRANSFERRED', refId: 'CTR-2', age: 18, step: 7 },
        { revision: 24, kind: 'OFFER_REJECTED', refId: 'OFR-24-1', age: 19, step: 12 },
      ],
    });
    expect(resolveTransferResultView(state, 24)).toBeNull();
    expect(latestTransferRevision(state)).toBe(2);
  });
});
