// 플레이 안내 문구 묶음(이슈 163·164·166) — 표시 전용. 이미 저장된 상태값(직전 결산 결과·부상
// 에피소드 이력)과 도메인이 export한 순수 헬퍼(assessCareerRetirement)만 읽는다. 새 시뮬레이션·rng
// 소비·숨김값(truePotential 등) 노출은 없다(ADR-003·06 정찰 범위 규칙).
import type { ReactNode } from 'react';
import {
  assessCareerRetirement,
  RETIREMENT_POLICY,
  type AttributeKey,
  type CareerState,
  type GrowthCause,
  type InjuryBodyPart,
  type InjuryEpisode,
  type InjurySeverity,
  type RetirementPolicy,
  type SeasonResult,
} from '@offside/domain';
import { ATTRIBUTE_GROUP_LABEL_KO, attributeGroups, type AttributeGroupId } from './attribute-groups.js';

const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function latestResult(state: CareerState): SeasonResult | null {
  return state.seasonHistory[state.seasonHistory.length - 1]?.result ?? null;
}

/** 원인별 centi 합(결산 화면 `findTopCause`와 같은 집계 — 여기서는 한 원인만 본다). */
function causeCentiSum(result: SeasonResult, cause: GrowthCause): number {
  let sum = 0;
  for (const entry of result.attributeDeltas) {
    for (const candidate of entry.causes) {
      if (candidate.cause === cause) sum += candidate.centi;
    }
  }
  return sum;
}

function formatCenti(centi: number): string {
  const value = (centi / 100).toFixed(1);
  return centi > 0 ? `+${value}` : value;
}

// ---------------------------------------------------------------------------------------------
// 이슈 163 잠재력 상한 사전 안내(프리시즌 훈련 계획 카드)
// ---------------------------------------------------------------------------------------------

export type PotentialCapNotice = {
  /** 직전 결산 시즌 번호(`SeasonResult.index`). */
  seasonNumber: number;
  /** 결산이 `POTENTIAL_CAP` 원인으로 성장을 깎은 능력(ATTRIBUTE_KEYS 순). */
  attributeKeys: AttributeKey[];
};

/** 직전 결산의 `attributeDeltas`에 잠재력 상한(POTENTIAL_CAP) 원인이 기록된 능력만 모은다. 결산 화면이
 * "잠재력 상한 -1.0"으로 이미 노출한 같은 필드라 숨김값을 새로 드러내지 않는다. 없으면 null. */
export function potentialCapNotice(state: CareerState): PotentialCapNotice | null {
  const result = latestResult(state);
  if (result === null) return null;
  const attributeKeys = result.attributeDeltas
    .filter((entry) => entry.causes.some((cause) => cause.cause === 'POTENTIAL_CAP' && cause.centi < 0))
    .map((entry) => entry.key);
  if (attributeKeys.length === 0) return null;
  return { seasonNumber: result.index, attributeKeys };
}

// ---------------------------------------------------------------------------------------------
// 이슈 164 부상 재발 표시(재활 선택 화면 "진단과 복귀 계획")
// ---------------------------------------------------------------------------------------------

export type InjuryRecurrenceNotice = {
  bodyPart: InjuryBodyPart;
  /** 같은 부위 재발 사슬 길이(직전 RECURRED 에피소드 수). 1이면 첫 재발. */
  chainLength: number;
  /** 바로 직전(재발 원인이 된) 에피소드의 심각도. */
  priorSeverity: InjurySeverity;
  /** 현재 에피소드 심각도(재발은 한 단계 높다). */
  severity: InjurySeverity;
  /** 현재 에피소드에 저장된 재발 위험(bp). */
  recurrenceRiskBp: number;
};

/** 현재 부상이 이전 부상의 재발인지 — 도메인 `onMatchRecurrence`가 원 에피소드를 `RECURRED`로 닫고 같은
 * 부위의 새 에피소드를 바로 뒤에 붙이므로, 직전 항목들이 같은 부위·RECURRED인 동안 사슬을 센다(도메인
 * `recurrenceChainLength`와 같은 규칙, barrel 미export라 읽기 전용으로 다시 적었다). 재발이 아니면 null. */
export function injuryRecurrenceNotice(
  episodes: readonly InjuryEpisode[],
  episodeId: string,
): InjuryRecurrenceNotice | null {
  const index = episodes.findIndex((episode) => episode.id === episodeId);
  if (index < 0) return null;
  const current = episodes[index]!;
  let chainLength = 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    const prior = episodes[i]!;
    if (prior.bodyPart !== current.bodyPart || prior.status !== 'RECURRED') break;
    chainLength += 1;
  }
  if (chainLength === 0) return null;
  const prior = episodes[index - 1]!;
  return {
    bodyPart: current.bodyPart,
    chainLength,
    priorSeverity: prior.severity,
    severity: current.severity,
    recurrenceRiskBp: current.recurrenceRiskBp,
  };
}

// ---------------------------------------------------------------------------------------------
// 이슈 166 은퇴 압력 예고(프리시즌 요약)
// ---------------------------------------------------------------------------------------------

export type RetirementPressureNotice = {
  /** 은퇴 압력 0~100(`assessCareerRetirement` total). */
  total: number;
  status: 'WATCH' | 'REVIEW';
  /** 직전 결산의 연령 하락(AGE_DECLINE) centi 합. 기록이 없으면 null. */
  ageDeclineCenti: number | null;
  /** 직전 결산 능력 그룹별 AGE_DECLINE centi 합(0인 그룹은 제외, 기술·신체·정신 순). */
  groupDeclines: Array<{ id: AttributeGroupId; centi: number }>;
};

/** 은퇴 압력이 룰셋 정책의 관찰 기준(`watchThreshold`, 현재 40) 이상이면 예고 데이터를 만든다. 압력은
 * 도메인이 export한 순수 평가 함수로만 구하고(rng 없음), 근거는 직전 결산에 이미 저장된 연령 하락
 * 기록이다 — 다음 시즌 하락 폭을 새로 시뮬레이션하지 않는다. */
export function retirementPressureNotice(
  state: CareerState,
  policy: RetirementPolicy = RETIREMENT_POLICY,
): RetirementPressureNotice | null {
  const result = latestResult(state);
  if (result === null) return null;
  let assessment: ReturnType<typeof assessCareerRetirement>;
  try {
    assessment = assessCareerRetirement(state, 'UNDECIDED', policy);
  } catch {
    // 오래된 스냅샷의 결산 값이 정책 검증 범위를 벗어나면 안내를 숨긴다(프리시즌 화면은 계속 동작).
    return null;
  }
  if (assessment === null || assessment.total === null) return null;
  if (assessment.total < policy.watchThreshold) return null;
  const status = assessment.status === 'REVIEW' ? 'REVIEW' : 'WATCH';

  const groupDeclines: RetirementPressureNotice['groupDeclines'] = [];
  for (const group of attributeGroups()) {
    let centi = 0;
    for (const entry of result.attributeDeltas) {
      if (!group.keys.includes(entry.key)) continue;
      for (const cause of entry.causes) {
        if (cause.cause === 'AGE_DECLINE') centi += cause.centi;
      }
    }
    if (centi !== 0) groupDeclines.push({ id: group.id, centi });
  }
  const ageDeclineSum = causeCentiSum(result, 'AGE_DECLINE');
  return {
    total: assessment.total,
    status,
    ageDeclineCenti: ageDeclineSum === 0 ? null : ageDeclineSum,
    groupDeclines,
  };
}

/** "연령 -3.0 · 기술 -1.0 · 신체 -2.0" 형태의 근거 한 줄. 연령 하락 기록이 없으면 null. */
export function retirementEvidenceText(notice: RetirementPressureNotice): string | null {
  if (notice.ageDeclineCenti === null) return null;
  const parts = [`연령 ${formatCenti(notice.ageDeclineCenti)}`];
  for (const group of notice.groupDeclines) {
    parts.push(`${ATTRIBUTE_GROUP_LABEL_KO[group.id]} ${formatCenti(group.centi)}`);
  }
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------------------------
// 공통 카드: 아이콘+라벨 병행(색만으로 의미 전달 금지), 모션 없음, 문장 2줄 이내.
// ---------------------------------------------------------------------------------------------

export interface GuidanceCardProps {
  /** 카드 라벨(예: "잠재력 상한 안내"). 아이콘과 나란히 os-eyebrow로 보인다. */
  label: string;
  /** 본문 한 문장. */
  children: ReactNode;
  /** 보조 한 줄(근거·수치). */
  detail?: ReactNode;
  /** 링크·버튼 같은 후속 동작. */
  action?: ReactNode;
  className?: string;
}

export function GuidanceCard({ label, children, detail, action, className }: GuidanceCardProps) {
  const classes = ['os-panel flex flex-col gap-os-2', className].filter(Boolean).join(' ');
  return (
    <aside className={classes} role="note" aria-label={label}>
      <p className="os-eyebrow flex items-center gap-os-1">
        <span aria-hidden="true" className="text-os-warning">
          ▲
        </span>
        {label}
      </p>
      <p className="font-os text-os-text" style={BODY_STYLE}>
        {children}
      </p>
      {detail !== undefined ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {detail}
        </p>
      ) : null}
      {action}
    </aside>
  );
}
