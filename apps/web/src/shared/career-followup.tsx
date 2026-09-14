import type {
  CareerState,
  ClubMeetingGoalResult,
  ClubMeetingState,
  InjuryEpisode,
} from '@offside/domain';
import { Card } from '@offside/ui';
import {
  ATTRIBUTE_LABELS,
  INJURY_BODY_PART_LABELS,
  INJURY_EPISODE_STATUS_LABELS,
  INJURY_SEVERITY_LABELS,
  REHAB_PLAN_LABELS,
} from './labels.js';

export type CareerFollowUpKind = 'CLUB_MEETING' | 'INJURY' | 'LOAN';

export type CareerFollowUpReceipt = {
  id: string;
  kind: CareerFollowUpKind;
  title: string;
  stage: string;
  response: string;
  action: string;
  source: string;
  terminal: boolean;
  sortRevision: number;
};

const MEETING_REQUEST_LABELS: Record<ClubMeetingState['request'], string> = {
  PLAYING_TIME: '출전 기회 요청',
  LOAN: '임대 요청',
  TRANSFER: '이적 요청',
};

const MEETING_REFUSAL_LABELS: Record<string, string> = {
  TRUST_TOO_LOW: '현재 감독 신뢰 기준으로 요청이 받아들여지지 않았습니다.',
  ROLE_OR_TRUST: '현재 역할 또는 감독 신뢰 기준으로 임대 요청이 받아들여지지 않았습니다.',
  RELATIONSHIP_STABLE: '구단은 현재 계약 관계를 유지하기로 답했습니다.',
};

function signedDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function meetingGoalForSeason(
  state: CareerState,
  seasonIndex: number,
): ClubMeetingGoalResult | null {
  return (
    state.seasonHistory.find((summary) => summary.index === seasonIndex)?.result.clubMeetingGoal ??
    null
  );
}

function meetingReceipt(state: CareerState, meeting: ClubMeetingState): CareerFollowUpReceipt {
  const goal = meetingGoalForSeason(state, meeting.seasonIndex);
  const settledRevision = state.seasonHistory.find(
    (summary) => summary.index === meeting.seasonIndex,
  )?.settledAtRevision;
  const requestLabel = MEETING_REQUEST_LABELS[meeting.request];
  const response =
    meeting.response === 'REFUSED'
      ? (MEETING_REFUSAL_LABELS[meeting.reason] ?? '구단이 요청을 받아들이지 않았습니다.')
      : `구단이 요청을 받아들였습니다. 감독 신뢰 ${signedDelta(meeting.immediateEffect.managerTrustDelta)} · 사기 ${signedDelta(meeting.immediateEffect.moraleDelta)}`;

  let stage = '응답 완료';
  let action = '면담 응답이 저장되었습니다.';
  let terminal = meeting.response === 'REFUSED';

  const goalAction =
    goal === null
      ? null
      : `출전 기준 ${Math.round(goal.targetMinutesShareBp / 100)}% · 실제 ${Math.round(goal.actualMinutesShareBp / 100)}% · ${goal.status === 'MET' ? '목표 달성' : '목표 미달'}`;

  if (meeting.response === 'ACCEPTED' && meeting.preferredOfferKind !== null) {
    switch (meeting.preferenceStatus) {
      case 'PENDING':
        stage = '제안 탐색 대기';
        action = `시즌 결산 뒤 ${meeting.preferredOfferKind === 'LOAN' ? '임대' : '이적'} 제안을 탐색합니다.`;
        terminal = false;
        break;
      case 'OFFERED':
        stage = '제안 탐색 완료';
        action = `${meeting.preferredOfferKind === 'LOAN' ? '임대' : '이적'} 후보가 확인되었습니다. 실제 계약 여부는 별도 선택과 계약 기록으로 확인합니다.`;
        terminal = false;
        break;
      case 'NO_CANDIDATE':
        stage = '탐색 종료';
        action = '조건에 맞는 제안이 없어 이번 요청이 종료되었습니다.';
        terminal = true;
        break;
      case 'CANCELLED':
        stage = '요청 종료';
        action = '계약 만료 또는 소속 변경으로 이전 요청이 종료되었습니다.';
        terminal = true;
        break;
      case null:
        break;
    }
    if (goalAction !== null) action = `${action} · 시즌 목표 평가: ${goalAction}`;
  } else if (goalAction !== null) {
    stage = '시즌 목표 평가 완료';
    action = goalAction;
    terminal = true;
  } else if (meeting.response === 'ACCEPTED') {
    stage = '시즌 목표 진행 중';
    action = `시즌 종료 후 출전 기준 ${Math.round(meeting.goal.targetMinutesShareBp / 100)}%를 확인합니다.`;
    terminal = false;
  }

  return {
    id: `meeting-${meeting.seasonIndex}`,
    kind: 'CLUB_MEETING',
    title: `${meeting.seasonIndex}시즌 · ${requestLabel}`,
    stage,
    response,
    action,
    source: `구단 면담 응답 · 시즌 ${meeting.seasonIndex}`,
    terminal,
    sortRevision: settledRevision ?? state.timeline.at(-1)?.revision ?? meeting.seasonIndex,
  };
}

function historicalMeetingReceipts(state: CareerState): CareerFollowUpReceipt[] {
  return state.seasonHistory.flatMap((summary) => {
    const goal = summary.result.clubMeetingGoal;
    if (goal === undefined || state.clubMeeting?.seasonIndex === summary.index) return [];
    return [
      {
        id: `meeting-history-${summary.index}`,
        kind: 'CLUB_MEETING' as const,
        title: `${summary.index}시즌 · ${MEETING_REQUEST_LABELS[goal.request]}`,
        stage: '시즌 목표 평가 완료',
        response:
          goal.response === 'ACCEPTED'
            ? '구단이 요청을 받아들였습니다.'
            : '구단이 요청을 받아들이지 않았습니다.',
        action: `출전 기준 ${Math.round(goal.targetMinutesShareBp / 100)}% · 실제 ${Math.round(goal.actualMinutesShareBp / 100)}% · ${goal.status === 'MET' ? '목표 달성' : '목표 미달'}`,
        source: `시즌 ${summary.index} 결산에 보존된 면담 목표`,
        terminal: true,
        sortRevision: summary.settledAtRevision,
      },
    ];
  });
}

function injuryAction(episode: InjuryEpisode): string {
  const rehab =
    episode.rehab === null ? '재활 선택 대기' : `${REHAB_PLAN_LABELS[episode.rehab]} 선택`;
  if (episode.status === 'ACTIVE' || episode.status === 'REHAB') {
    return episode.remainingMatches === undefined
      ? `${rehab} · 결장 기간 기록 없음`
      : `${rehab} · ${episode.remainingMatches}경기 뒤 다시 확인`;
  }
  const sequel = episode.permanentDelta;
  const sequelText =
    sequel === null
      ? '후유증 판정 대기'
      : sequel.length === 0
        ? '영구 능력치 변화 없음'
        : `영구 능력치 변화 ${sequel.map((entry) => `${ATTRIBUTE_LABELS[entry.key]} ${signedDelta(entry.delta)}`).join(' · ')}`;
  if (episode.status === 'RECURRED') return `${rehab} · 재발 판정 발생 · ${sequelText}`;
  return `${rehab} · ${sequelText}`;
}

function injuryReceipt(state: CareerState, episode: InjuryEpisode): CareerFollowUpReceipt {
  const rehabEntry = state.timeline.find(
    (entry) => entry.kind === 'REHAB_CHOSEN' && entry.refId === episode.id,
  );
  const sourceEntry =
    rehabEntry === undefined
      ? undefined
      : state.timeline.find(
          (entry) => entry.kind === 'EVENT_RESOLVED' && entry.revision === rehabEntry.revision,
        );
  const sourceEvent = sourceEntry?.refId?.split(':')[0];
  const terminal =
    episode.status === 'RECURRED' ||
    (episode.status === 'RECOVERED' && episode.recurrenceChecksRemaining === 0);
  return {
    id: `injury-${episode.id}`,
    kind: 'INJURY',
    title: `${episode.occurredAt.seasonIndex}시즌 · ${INJURY_BODY_PART_LABELS[episode.bodyPart]} ${INJURY_SEVERITY_LABELS[episode.severity]} 부상`,
    stage: INJURY_EPISODE_STATUS_LABELS[episode.status],
    response:
      episode.rehab === null
        ? '아직 재활 방법을 선택하지 않았습니다.'
        : `${REHAB_PLAN_LABELS[episode.rehab]}을 선택했습니다.`,
    action: injuryAction(episode),
    source: `시즌 ${episode.occurredAt.seasonIndex} step ${episode.occurredAt.step} 부상 기록${sourceEvent === undefined ? '' : ` · 선택 source ${sourceEvent}`}`,
    terminal,
    sortRevision:
      rehabEntry?.revision ?? episode.occurredAt.seasonIndex * 100 + episode.occurredAt.step,
  };
}

function loanReceipts(state: CareerState): CareerFollowUpReceipt[] {
  return state.clubHistory.flatMap((stint, stintIndex) => {
    if (stint.kind !== 'LOAN') return [];
    const loanedEntry = state.timeline.find(
      (entry) => entry.kind === 'LOANED' && entry.refId === stint.contractId,
    );
    const summaries = state.seasonHistory.filter(
      (summary) =>
        summary.teamId === stint.teamId &&
        summary.index >= stint.fromSeasonIndex &&
        (stint.toSeasonIndex === null || summary.index <= stint.toSeasonIndex),
    );
    const matches = summaries.reduce(
      (sum, summary) =>
        sum +
        Math.max(
          0,
          summary.result.playerStats.appearances.total -
            summary.result.playerStats.appearances.zeroMinute,
        ),
      0,
    );
    const minutes = summaries.reduce(
      (sum, summary) => sum + summary.result.selectionSummary.minutes,
      0,
    );
    const action =
      stint.endReason === 'RETURNED'
        ? '원소속 복귀가 소속 이력에 저장되었습니다.'
        : stint.toSeasonIndex === null
          ? '임대 시즌 종료 후 복귀 결정을 확인합니다.'
          : '임대 소속 이력이 종료되었습니다. 당시 선택은 별도 연결 기록이 없어 추정하지 않습니다.';
    const stage =
      stint.endReason === 'RETURNED'
        ? '원소속 복귀 완료'
        : stint.toSeasonIndex === null
          ? '임대 진행 중'
          : '임대 종료';
    return [
      {
        id: `loan-${stint.contractId}-${stintIndex}`,
        kind: 'LOAN' as const,
        title: `${stint.fromSeasonIndex}시즌 · ${stint.teamName} 임대`,
        stage,
        response:
          summaries.length === 0
            ? '임대 계약은 저장되었지만 아직 결산된 출전 기록이 없습니다.'
            : `임대 결산 ${summaries.length}시즌 · 출전 ${matches}경기 · ${minutes}분`,
        action,
        source: `소속 이력 · 임대 계약 · ${summaries.length > 0 ? '시즌 결산' : '결산 대기'}`,
        terminal: stint.toSeasonIndex !== null,
        sortRevision: loanedEntry?.revision ?? stint.fromSeasonIndex,
      },
    ];
  });
}

/**
 * 저장된 도메인 상태를 읽기 전용 후속 결과로 투영한다. 연결 근거가 없는 계약 성공이나 과거 역할은
 * 추정하지 않으며, 구버전 저장처럼 optional 필드가 없으면 있는 기록만 돌려준다.
 */
export function buildCareerFollowUpReceipts(state: CareerState): CareerFollowUpReceipt[] {
  return [
    ...historicalMeetingReceipts(state),
    ...(state.clubMeeting === undefined ? [] : [meetingReceipt(state, state.clubMeeting)]),
    ...state.health.episodes.map((episode) => injuryReceipt(state, episode)),
    ...loanReceipts(state),
  ].sort((a, b) => b.sortRevision - a.sortRevision || a.id.localeCompare(b.id));
}

const KIND_LABELS: Record<CareerFollowUpKind, string> = {
  CLUB_MEETING: '구단 면담',
  INJURY: '부상과 복귀',
  LOAN: '임대와 복귀',
};

const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

export function CareerFollowUpReceipts({
  receipts,
  emptyMessage = '아직 저장된 후속 결과가 없습니다.',
  limit,
}: {
  receipts: readonly CareerFollowUpReceipt[];
  emptyMessage?: string;
  limit?: number;
}) {
  const visible = limit === undefined ? receipts : receipts.slice(0, limit);
  if (visible.length === 0) {
    return (
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        {emptyMessage}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-os-3" aria-label="선택 후속 결과">
      {visible.map((receipt) => (
        <li key={receipt.id}>
          <Card className="flex flex-col gap-os-2">
            <div className="flex items-start justify-between gap-os-2">
              <div className="min-w-0">
                <p className="os-eyebrow">{KIND_LABELS[receipt.kind]}</p>
                <h3 className="break-words font-os font-semibold text-os-text">{receipt.title}</h3>
              </div>
              <span
                className="shrink-0 rounded-os-s bg-os-surface-2 px-os-2 py-os-1 font-os text-os-text-2"
                style={CAPTION_STYLE}
              >
                {receipt.terminal ? '완료' : '진행 중'}
              </span>
            </div>
            <dl className="grid gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
              <div>
                <dt className="font-semibold text-os-text">단계</dt>
                <dd>{receipt.stage}</dd>
              </div>
              <div>
                <dt className="font-semibold text-os-text">응답</dt>
                <dd>{receipt.response}</dd>
              </div>
              <div>
                <dt className="font-semibold text-os-text">후속 행동</dt>
                <dd>{receipt.action}</dd>
              </div>
              <div>
                <dt className="font-semibold text-os-text">기록 출처</dt>
                <dd>{receipt.source}</dd>
              </div>
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}
