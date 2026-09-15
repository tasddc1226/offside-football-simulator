// UX-014 커리어 상단 헤더의 순수 파생값 단위 테스트: 역할 라벨(계약 squad role·신인·무소속)·OVR
// (프로필 확정 전 null)·이름. CareerState는 이 세 함수가 실제로 읽는 필드만 채운 최소 픽스처를
// 쓴다(engine으로 실제 상태를 재현하기엔 이 단위 테스트에 과하다 — index.test.tsx가 그 경로를 다룬다).
import type { CareerState } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { careerHeaderName, careerHeaderOvr, careerHeaderRoleLabel } from './career-header-data.js';

function makeState(overrides: {
  profile?: { name: string; baseOvr: number } | null;
  draftName?: string | null;
  contract?: { rolePromise: 'STARTER' | 'ROTATION' | 'BENCH' | 'RESERVE' } | null;
  seasonSquadRole?: 'STARTER' | 'ROTATION' | 'BENCH' | 'RESERVE';
  seasonHistoryLength?: number;
}): CareerState {
  return {
    player: {
      profile: overrides.profile === undefined ? null : overrides.profile,
      draft: { name: overrides.draftName ?? null },
    },
    contract: overrides.contract ?? null,
    season: overrides.seasonSquadRole === undefined ? null : { squadRole: overrides.seasonSquadRole },
    seasonHistory: new Array(overrides.seasonHistoryLength ?? 0).fill(null),
  } as unknown as CareerState;
}

describe('careerHeaderName', () => {
  it('확정된 profile 이름을 우선한다', () => {
    expect(careerHeaderName(makeState({ profile: { name: '김서준', baseOvr: 53 }, draftName: '드래프트명' }))).toBe(
      '김서준',
    );
  });

  it('profile이 없으면 draft 이름, 둘 다 없으면 대체 문구를 쓴다', () => {
    expect(careerHeaderName(makeState({ profile: null, draftName: '드래프트명' }))).toBe('드래프트명');
    expect(careerHeaderName(makeState({ profile: null, draftName: null }))).toBe('이름 없는 선수');
  });
});

describe('careerHeaderOvr', () => {
  it('profile이 확정되면 baseOvr, 아니면 null(헤더가 "OVR —"로 표시)', () => {
    expect(careerHeaderOvr(makeState({ profile: { name: '김서준', baseOvr: 53 } }))).toBe(53);
    expect(careerHeaderOvr(makeState({ profile: null }))).toBeNull();
  });
});

describe('careerHeaderRoleLabel', () => {
  it('시즌이 진행 중이면 계약이 아니라 season.squadRole을 쓴다(선발 경쟁 결과 반영)', () => {
    expect(
      careerHeaderRoleLabel(makeState({ contract: { rolePromise: 'BENCH' }, seasonSquadRole: 'STARTER' })),
    ).toBe('주전');
  });

  it('시즌이 없으면 계약의 rolePromise를 쓴다', () => {
    expect(careerHeaderRoleLabel(makeState({ contract: { rolePromise: 'ROTATION' } }))).toBe('로테이션');
  });

  it('계약 전이고 과거 시즌 기록도 없으면 "신인"이다', () => {
    expect(careerHeaderRoleLabel(makeState({ contract: null, seasonHistoryLength: 0 }))).toBe('신인');
  });

  it('계약 전이지만 과거 시즌을 치른 적이 있으면(임대 복귀·방출 등) "무소속"이다', () => {
    expect(careerHeaderRoleLabel(makeState({ contract: null, seasonHistoryLength: 2 }))).toBe('무소속');
  });
});
