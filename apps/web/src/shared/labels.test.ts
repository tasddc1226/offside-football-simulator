// T-4-009 D-57: Phase 4 라벨 함수(순수 함수) 단위 테스트. 화면이 아직 없으므로 입력→출력만 본다.
import type { ChapterTrigger, RelationshipLogEntry } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import {
  careerTagLabel,
  chapterTriggerLabel,
  effectExpiresAtLabel,
  INJURY_BODY_PART_LABELS,
  INJURY_EPISODE_STATUS_LABELS,
  INJURY_SEVERITY_LABELS,
  managerTrustTierLabel,
  mediaTierLabel,
  NATIONAL_TEAM_CALL_UP_LABELS,
  popularityTierLabel,
  REHAB_PLAN_LABELS,
  relationshipDirection,
  relationshipDirectionArrow,
  relationshipReasonLabel,
  relationTierLabel,
  resultTagLabel,
} from './labels.js';

function logEntry(target: RelationshipLogEntry['target'], delta: number): RelationshipLogEntry {
  return { target, delta, sourceId: 'src', reasonTag: null, seasonIndex: 0, step: 1 };
}

describe('relationTierLabel', () => {
  it('경계값(20/40/60/80)을 포함해 5단계로 나눈다', () => {
    expect(relationTierLabel(0)).toBe('매우 낮음');
    expect(relationTierLabel(19)).toBe('매우 낮음');
    expect(relationTierLabel(20)).toBe('낮음');
    expect(relationTierLabel(39)).toBe('낮음');
    expect(relationTierLabel(40)).toBe('보통');
    expect(relationTierLabel(59)).toBe('보통');
    expect(relationTierLabel(60)).toBe('높음');
    expect(relationTierLabel(79)).toBe('높음');
    expect(relationTierLabel(80)).toBe('매우 높음');
    expect(relationTierLabel(100)).toBe('매우 높음');
  });
});

describe('managerTrustTierLabel', () => {
  it('relationTierLabel과 같은 경계를 쓴다', () => {
    expect(managerTrustTierLabel(39)).toBe(relationTierLabel(39));
    expect(managerTrustTierLabel(40)).toBe(relationTierLabel(40));
  });
});

describe('popularityTierLabel·mediaTierLabel', () => {
  it('0~10000 경계(2000/4000/6000/8000)로 5단계로 나눈다', () => {
    expect(popularityTierLabel(0)).toBe('매우 낮음');
    expect(popularityTierLabel(1999)).toBe('매우 낮음');
    expect(popularityTierLabel(2000)).toBe('낮음');
    expect(popularityTierLabel(5000)).toBe('보통');
    expect(popularityTierLabel(8000)).toBe('매우 높음');
    expect(popularityTierLabel(10000)).toBe('매우 높음');
  });

  it('mediaTierLabel도 같은 경계를 쓴다', () => {
    expect(mediaTierLabel(3000)).toBe('낮음');
    expect(mediaTierLabel(9000)).toBe('매우 높음');
  });
});

describe('relationshipDirection·relationshipDirectionArrow', () => {
  it('축별 delta 합의 부호로 방향을 고른다', () => {
    const log: RelationshipLogEntry[] = [
      logEntry('managerTrust', 5),
      logEntry('managerTrust', -2),
      logEntry('fans', -10),
      logEntry('captain', 3),
      logEntry('captain', -3),
    ];
    expect(relationshipDirection(log, 'managerTrust')).toBe('UP');
    expect(relationshipDirection(log, 'fans')).toBe('DOWN');
    expect(relationshipDirection(log, 'captain')).toBe('FLAT'); // 합이 정확히 0
    expect(relationshipDirection(log, 'agent')).toBe('FLAT'); // 기록 없음
  });

  it('화살표 문자열은 ↑/→/↓ 중 하나다', () => {
    const log: RelationshipLogEntry[] = [logEntry('rival', 4)];
    expect(relationshipDirectionArrow(log, 'rival')).toBe('↑');
    expect(relationshipDirectionArrow([], 'rival')).toBe('→');
    expect(relationshipDirectionArrow([logEntry('rival', -1)], 'rival')).toBe('↓');
  });
});

describe('부상·재활·회복 라벨', () => {
  it('부위 5종·심각도 3종·재활 계획 3종·회복 상태 4종을 전부 정의한다', () => {
    expect(Object.keys(INJURY_BODY_PART_LABELS)).toHaveLength(5);
    expect(Object.keys(INJURY_SEVERITY_LABELS)).toHaveLength(3);
    expect(Object.keys(REHAB_PLAN_LABELS)).toHaveLength(3);
    expect(Object.keys(INJURY_EPISODE_STATUS_LABELS)).toHaveLength(4);
    expect(INJURY_BODY_PART_LABELS.KNEE).toBe('무릎');
    expect(INJURY_SEVERITY_LABELS.MAJOR).toBe('중상');
    expect(REHAB_PLAN_LABELS.EARLY).toBe('조기 복귀');
    expect(INJURY_EPISODE_STATUS_LABELS.REHAB).toBe('재활 중');
  });
});

describe('대표팀 callUp 라벨', () => {
  it('ACCEPT·DECLINE·CONDITIONAL 3종을 정의한다', () => {
    expect(NATIONAL_TEAM_CALL_UP_LABELS).toEqual({
      ACCEPT: '소집 수락',
      DECLINE: '소집 거절',
      CONDITIONAL: '조건부 참가',
    });
  });
});

describe('effectExpiresAtLabel', () => {
  const context = { currentStep: 5, seasonIndex: 1 };

  it('null은 만료 없음', () => {
    expect(effectExpiresAtLabel(null, context)).toBe('만료 없음');
  });

  it('AT_STEP은 currentStep과의 차이를 스텝 단위로 보여준다', () => {
    expect(effectExpiresAtLabel({ kind: 'AT_STEP', step: 7 }, context)).toBe('2스텝 뒤 만료');
    expect(effectExpiresAtLabel({ kind: 'AT_STEP', step: 5 }, context)).toBe('이번 스텝에 만료');
    expect(effectExpiresAtLabel({ kind: 'AT_STEP', step: 3 }, context)).toBe('이번 스텝에 만료');
  });

  it('AT_SEASON_END·AT_SEASON_INDEX', () => {
    expect(effectExpiresAtLabel({ kind: 'AT_SEASON_END' }, context)).toBe('이번 시즌 결산 때 만료');
    expect(effectExpiresAtLabel({ kind: 'AT_SEASON_INDEX', index: 3 }, context)).toBe('2시즌 뒤 만료');
    expect(effectExpiresAtLabel({ kind: 'AT_SEASON_INDEX', index: 1 }, context)).toBe('다음 시즌 시작 전 만료');
  });

  it('content 원본 형태(STEPS_AFTER·SEASONS_AFTER)도 방어적으로 처리한다', () => {
    expect(effectExpiresAtLabel({ kind: 'STEPS_AFTER', steps: 2 }, context)).toBe('2스텝 뒤 만료');
    expect(effectExpiresAtLabel({ kind: 'SEASONS_AFTER', seasons: 1 }, context)).toBe('1시즌 뒤 만료');
  });
});

describe('relationshipReasonLabel (T-7-005 이슈 #142)', () => {
  it('카탈로그 3종을 한국어로 바꾼다', () => {
    expect(relationshipReasonLabel('PROMISE_BREACH')).toBe('출전 약속 미이행');
    expect(relationshipReasonLabel('NATIONAL_TEAM_ACCEPT')).toBe('대표팀 소집 수락');
    expect(relationshipReasonLabel('CAPTAIN_MEDIATION')).toBe('주장 중재');
  });

  it('LEGACY_ 접두 키는 은퇴 평가로 묶는다', () => {
    expect(relationshipReasonLabel('LEGACY_ACHIEVEMENT')).toBe('은퇴 평가');
    expect(relationshipReasonLabel('LEGACY_LONGEVITY')).toBe('은퇴 평가');
  });

  it('미등록 대문자 스네이크 키는 내부 식별자로 보고 숨긴다', () => {
    expect(relationshipReasonLabel('SOME_UNKNOWN_INTERNAL_TAG')).toBe('최근 변화');
  });

  it('resultTagLabel 카탈로그에 있는 한글 스네이크 태그는 그 라벨을 재사용한다', () => {
    expect(relationshipReasonLabel('증명')).toBe('증명');
    expect(relationshipReasonLabel('팀_우선')).toBe('팀 우선');
  });

  it('null은 최근 변화다', () => {
    expect(relationshipReasonLabel(null)).toBe('최근 변화');
  });
});

describe('T-7-010 이슈 144·D-68: 승격 표현을 승격권(순위 기록)으로 정합', () => {
  it('resultTagLabel: 승격_기여 태그는 승격권 기여로 표시한다(리그 이동으로 오독되지 않도록)', () => {
    expect(resultTagLabel('승격_기여')).toBe('승격권 기여');
  });

  it('careerTagLabel: TAG-PROMOTION-EXPERT는 도메인 라벨(승격 전문가) 대신 승격권 전문가로 덮어쓴다', () => {
    expect(careerTagLabel('TAG-PROMOTION-EXPERT', '승격 전문가')).toBe('승격권 전문가');
  });

  it('careerTagLabel: 덮어쓸 라벨이 없는 태그는 도메인 라벨을 그대로 쓴다', () => {
    expect(careerTagLabel('TAG-SOME-OTHER', '기타 태그')).toBe('기타 태그');
  });
});

describe('chapterTriggerLabel TAG 분기 (T-7-005 #105)', () => {
  it('프로_데뷔 tag는 재사용 챕터용 별도 제목을 쓴다(진짜 데뷔전과 다른 문구)', () => {
    const trigger: ChapterTrigger = { kind: 'TAG', tag: '프로_데뷔' };
    expect(chapterTriggerLabel(trigger)).toBe('데뷔 이후의 무대');
    expect(chapterTriggerLabel({ kind: 'DEBUT' })).toBe('프로 데뷔전');
  });

  it('미등록 태그는 원시 키를 그대로 반환하지 않고 안전한 일반 제목으로 떨어진다', () => {
    const trigger: ChapterTrigger = { kind: 'TAG', tag: 'internal_unmapped_tag' };
    expect(chapterTriggerLabel(trigger)).toBe('핵심 경기');
    expect(chapterTriggerLabel(trigger)).not.toBe('internal_unmapped_tag');
  });
});
