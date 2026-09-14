// SCR-029 커리어 대시보드. 다섯 구역 탭 + "다음 결정" 카드. 대시보드에서는 어떤 명령도 확정하지
// 않는다 — advance/settleSeason은 결정이 아니라 "진행"이며(다음에 뭐가 뜰지는 도메인이 정한다),
// 결정 확정은 전용 화면(SCR-007·008·009·010·012·013·014)에서만 일어난다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useIsMutating } from '@tanstack/react-query';
import {
  deriveTacticalRoom,
  standingsFromLedger,
  type RelationTarget,
  type CareerState,
  type CompetitionRecord,
  type FootballSeason,
  type RoleProposal,
  type Ruleset,
  type TimelineEntry,
} from '@offside/domain';
import {
  Button,
  buttonClassName,
  buttonStyle,
  Card,
  CareerTimeline,
  DashboardSection,
  ErrorState,
  StatusStrip,
  SwipeSurface,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
  type CareerTimelineItem,
} from '@offside/ui';
import { contentForCareer, rulesetForCareer } from '../engine/content.js';
import { recordSeasonSettled, sumStepSummaries, trackStepPassed } from '../engine/funnel.js';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { useEngine } from '../engine/use-engine.js';
import { screenForCareer } from '../shared/career-route.js';
import { archetypeName, currentTeamName } from '../shared/current-team.js';
import {
  positionHeaderField,
  POSITION_LABELS,
  ROLE_DECISION_LABEL_KO,
  ROLE_PROMISE_SENTENCE,
  ROLE_PROPOSAL_TYPE_LABEL_KO,
  popularityTierLabel,
  relationshipReasonLabel,
  relationTierLabel,
  relationshipDirectionArrow,
  resultTagLabels,
  SEASON_PHASE_LABEL_KO,
  SQUAD_ROLE_LABELS,
  TIMELINE_KIND_LABEL_KO,
} from '../shared/labels.js';
import { markStatsRevealed, readRevealedStats } from '../shared/revealed-stats.js';
import { platform } from '../platform/index.js';
import { SCREEN_ROUTES } from '../routes.js';
import { SeasonTimeline } from '../shared/season-timeline.js';
import { buildScheduleRows } from '../shared/season-schedule.js';
import { cupProgressLabel, opponentDisplayName } from '../shared/competition-labels.js';
import { eventOutcomeTitle } from '../shared/legacy-event-copy.js';
import { familiarityPercentLabel, SelectionRankingList } from '../shared/tactical-room.js';
import type { TeamNameOverrides } from '../shared/team-names.js';
import { useReducedMotion, useUiStore } from '../shared/ui-store.js';
import { MotionPanel, type ScreenDirection } from '../shared/screen-motion.js';
import { buildCurrentContractSummary, MARKET_REASON_LABEL_KO } from '../shared/transfer-view.js';
import { GamePending } from '../shared/game-presentation.js';
import { LeagueStandingsTable, leagueStandingSummary } from '../shared/league-standings.js';
import { buildCareerClock, type CareerClockView } from '../shared/career-clock.js';
import {
  careerStartYear,
  extractCalendarStartYear,
  seasonYearLabel,
  seasonYearLabelWithOrdinal,
} from '../shared/season-year.js';
import { useServiceSeason } from '../engine/service-season.js';
import {
  conditionTileItems,
  proStatusStripItems,
  u18StatusStripItems,
  type ConditionTileItem,
} from '../shared/status-strip.js';

const DASHBOARD_TABS = ['home', 'schedule', 'player', 'contract', 'records'] as const;
type DashboardTab = (typeof DASHBOARD_TABS)[number];
type DashboardSearch = { signed?: boolean; view?: DashboardTab };
type ChapterPending = Extract<CareerState['pending'], { kind: 'CHAPTER' }>;

export const Route = createFileRoute('/career/$careerId/')({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => {
    const view = DASHBOARD_TABS.find((candidate) => candidate === search.view);
    return { ...(search.signed === true ? { signed: true } : {}), ...(view ? { view } : {}) };
  },
  component: CareerDashboard,
});

const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

const RELATION_LABELS: Record<RelationTarget, string> = {
  managerTrust: '감독',
  captain: '주장단',
  rival: '경쟁자',
  fans: '팬',
  agent: '에이전트',
};

function relationshipRows(state: CareerState, revealNumbers: boolean) {
  return (Object.keys(RELATION_LABELS) as RelationTarget[]).map((target) => ({
    target,
    label: RELATION_LABELS[target],
    value: state.relationships[target],
    direction: relationshipDirectionArrow(state.relationshipLog, target),
    display: revealNumbers ? `${state.relationships[target]}` : relationTierLabel(state.relationships[target]),
  }));
}

function chapterCardLabel(
  state: CareerState,
  pending: ChapterPending,
  ruleset: Ruleset,
  teamNameOverrides: TeamNameOverrides,
): string {
  if (pending.trigger === 'NATIONAL_DEBUT') {
    const opponentName = pending.virtualOpponent?.opponentName;
    return opponentName === undefined ? '대표팀 데뷔전' : `대표팀 데뷔전 — ${opponentName}`;
  }

  const opponent = state.season?.matches.find((candidate) => candidate.id === pending.matchId)?.opponent;
  const opponentName =
    opponent === undefined ? undefined : opponentDisplayName(opponent, ruleset, teamNameOverrides);
  return opponentName === undefined ? '핵심 경기' : `핵심 경기 — ${opponentName}`;
}

function timelineSentence(entry: TimelineEntry, state: CareerState): string {
  switch (entry.kind) {
    case 'SERVICE_STARTED': return '복무 경로를 선택하다';
    case 'SERVICE_COMPLETED': return '복무를 마치고 다음 시즌을 준비하다';
    case 'INTERNATIONAL_TOURNAMENT': return 'U23 국제대회를 마치다';
    case 'MENTORED': return '후배와 경험을 나누다';
    case 'RETIRED':
      return entry.refId === 'COACH_EPILOGUE' ? '선수 생활을 마치고 지도자로 새 출발' : '선수 생활을 마치다';
    case 'CAREER_CONFIRMED':
      return '선수 생활 시작';
    case 'CONTRACT_SIGNED':
      return state.contract !== null && entry.refId === state.contract.id
        ? `${state.contract.teamName}과 계약`
        : '계약';
    case 'SEASON_STARTED':
      return '시즌 시작';
    case 'STEP_PASSED':
      return '진행';
    case 'SEASON_SETTLED':
      return '시즌 정산';
    case 'EVENT_RESOLVED': {
      if (entry.refId === null) return '이벤트';
      const [eventId, choiceId, outcomeId] = entry.refId.split(':');
      const definition =
        eventId === undefined ? undefined : contentForCareer(state).eventsById.get(eventId);
      const choice = definition?.choices.find((candidate) => candidate.id === choiceId);
      const outcome = choice?.outcomes.find((candidate) => candidate.id === outcomeId);
      return definition === undefined || choice === undefined || outcome === undefined
        ? '이벤트'
        : `${choice.label} → ${eventOutcomeTitle(definition, outcome)}`;
    }
    // T-2-002 D-34·T-2-004 D-38: exhaustive switch가 typecheck에서 깨져 최소 수정(PR 본문 참고).
    // 화면 전용 문구는 T-2-007(전술실)·T-2-008(챕터 화면)이 다듬는다.
    case 'ROLE_RESOLVED':
      return '역할 결정';
    case 'CHAPTER_RESOLVED':
      return '챕터 판단';
    // T-2-014 D-42: exhaustive switch가 typecheck에서 깨져 최소 수정(PR 본문 참고).
    case 'CAREER_TAG_GRANTED':
      return '커리어 태그 획득';
    // T-3-001: exhaustive switch가 typecheck에서 깨져 최소 수정(PR 본문 참고).
    case 'CONTRACT_RENEWED':
      return '계약 갱신';
    case 'TRANSFERRED':
      return '완전 이적';
    case 'LOANED':
      return '임대 이적';
    case 'LOAN_RETURNED':
      return '임대 복귀';
    case 'OFFER_REJECTED':
      return '제안 거절';
    case 'OFFER_EXPIRED':
      return '제안 만료';
    case 'NEGOTIATED':
      return '조건 협상';
    case 'INJURED':
      return '부상';
    case 'REHAB_CHOSEN':
      return '재활 선택';
    case 'RECOVERED':
      return '부상 회복';
    case 'INJURY_RECURRED':
      return '부상 재발';
    case 'MANAGER_CHANGED':
      return '감독 교체';
    case 'NATIONAL_TEAM_CALLED':
      return '국가대표 소집';
    case 'NATIONAL_TEAM_DECLINED':
      return '국가대표 소집 거절';
    case 'CAPTAIN_APPOINTED':
      return '주장 임명';
    case 'CLUB_MEETING_RESOLVED':
      return '구단 면담';
    case 'CLUB_MEETING_GOAL_EVALUATED':
      return '면담 목표 평가';
  }
}

function buildTimelineItems(state: CareerState): CareerTimelineItem[] {
  return [...state.timeline].reverse().map((entry, index) => ({
    // RULE-TIME-002: ADVANCE 한 번이 여러 step을 지나가면 STEP_PASSED 항목 여럿이 같은
    // revision을 공유한다(packages/domain/src/simulate.ts) — revision만으로는 key가
    // 중복될 수 있어 배열 위치를 덧붙인다(T-2-009에서 발견, PR 본문 기록).
    id: `${entry.kind}-${entry.revision}-${index}`,
    age: `${entry.age}세`,
    stage: TIMELINE_KIND_LABEL_KO[entry.kind],
    title: timelineSentence(entry, state),
  }));
}

/** 반복적인 step 통과는 보존하되, 기본 연대기에서는 실제 커리어 사건만 앞세운다. */
function buildCareerMilestoneItems(state: CareerState): CareerTimelineItem[] {
  return buildTimelineItems(state).filter((item) => !item.id.startsWith('STEP_PASSED-'));
}

/** T-2-009 목표 "다이어리에 이번 시즌 연대기 요약을 붙인다": 이번 시즌(진행 중이면 현재, 아니면
 * 방금 결산한 시즌) timeline 구간의 [SEASON_STARTED revision, SEASON_SETTLED revision 또는 끝]. */
function currentSeasonChronicleBounds(
  state: CareerState,
): { startRevision: number; endRevision: number | null } | null {
  const startEntry = [...state.timeline].reverse().find((entry) => entry.kind === 'SEASON_STARTED');
  if (startEntry === undefined) return null;
  const settledEntry = state.timeline.find(
    (entry) => entry.kind === 'SEASON_SETTLED' && entry.revision > startEntry.revision,
  );
  return { startRevision: startEntry.revision, endRevision: settledEntry?.revision ?? null };
}

/** STEP_PASSED은 `state.season.steps[].summary.results`가 있을 때만 "3승 1무"로 세분화한다 — 결산
 * 뒤에는 season이 null이라(step별 경기 기록이 사라진다) 일반 "진행"으로 남는다(데이터 모델 한계,
 * PR 본문에 기록). */
function stepPassedChronicleSentence(entry: TimelineEntry, state: CareerState): string {
  if (state.season === null) return '진행';
  const step = state.season.steps.find((candidate) => candidate.index === entry.step);
  const results = step?.summary?.results ?? [];
  if (results.length === 0) return '진행';
  const wins = results.filter((result) => result.outcome === 'WIN').length;
  const draws = results.filter((result) => result.outcome === 'DRAW').length;
  const losses = results.filter((result) => result.outcome === 'LOSS').length;
  const parts = [
    wins > 0 ? `${wins}승` : null,
    draws > 0 ? `${draws}무` : null,
    losses > 0 ? `${losses}패` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' ') : '진행';
}

function roleResolvedChronicleSentence(entry: TimelineEntry): string {
  const [type, decision] = (entry.refId ?? '').split(':');
  const typeLabel =
    type !== undefined && type in ROLE_PROPOSAL_TYPE_LABEL_KO
      ? ROLE_PROPOSAL_TYPE_LABEL_KO[type as RoleProposal['type']]
      : '역할';
  const decisionLabel =
    decision === 'ACCEPT' || decision === 'DECLINE' ? ROLE_DECISION_LABEL_KO[decision] : '';
  return decisionLabel === '' ? `${typeLabel} 제안` : `${typeLabel} 제안 · ${decisionLabel}`;
}

export type SeasonChronicleItem = {
  id: string;
  sentence: string;
  seasonResultHistoryIndex: number | null;
};

/** SEASON_SETTLED 카드는 이 시즌의 `seasonHistory` 위치를 실어 SCR-015 링크를 만들 수 있게 한다. */
export function buildSeasonChronicleItems(state: CareerState): SeasonChronicleItem[] {
  const bounds = currentSeasonChronicleBounds(state);
  if (bounds === null) return [];
  return state.timeline
    .filter(
      (entry) =>
        entry.revision >= bounds.startRevision &&
        (bounds.endRevision === null || entry.revision <= bounds.endRevision),
    )
    .map((entry, index) => {
      const seasonResultHistoryIndex =
        entry.kind === 'SEASON_SETTLED'
          ? state.seasonHistory.findIndex((summary) => summary.settledAtRevision === entry.revision)
          : -1;
      const sentence =
        entry.kind === 'STEP_PASSED'
          ? stepPassedChronicleSentence(entry, state)
          : entry.kind === 'ROLE_RESOLVED'
            ? roleResolvedChronicleSentence(entry)
            : timelineSentence(entry, state);
      return {
        // RULE-TIME-002: ADVANCE 한 번이 여러 step을 지나가면 STEP_PASSED 항목 여럿이 같은
        // revision을 공유한다(packages/domain/src/simulate.ts) — revision만으로는 key가
        // 중복될 수 있어 배열 위치를 덧붙인다.
        id: `chronicle-${entry.kind}-${entry.revision}-${index}`,
        sentence,
        seasonResultHistoryIndex: seasonResultHistoryIndex < 0 ? null : seasonResultHistoryIndex,
      };
    });
}

/** UX-007 홈 탭 "최근 소식"에서만 걸러낼 무정보 문장 — STEP_PASSED가 결과 없이(휴식 step 등)
 * `stepPassedChronicleSentence`의 기본값으로 떨어진 경우다. 기록 탭 상세 목록(모든 항목)은 그대로
 * 두고 홈 탭 요약만 걸러낸다(다른 소비부는 건드리지 않는다). */
const GENERIC_CHRONICLE_SENTENCE = '진행';

/** 홈 탭 "최근 소식": 정보 없는 항목을 걸러낸 뒤 최근 것부터 최대 3개만 보여준다(중복 제네릭
 * 라벨 노출 방지). 전부 걸러지면 빈 배열을 돌려줘 호출부가 섹션을 숨긴다. */
export function visibleRecentChronicleItems(items: readonly SeasonChronicleItem[]): SeasonChronicleItem[] {
  return items.filter((item) => item.sentence !== GENERIC_CHRONICLE_SENTENCE).slice(-3).reverse();
}

export type PastSeasonLink = { historyIndex: number; seasonNumber: number };

/** 연대기 카드에 이미 나온 시즌(방금 결산한 시즌)은 과거 목록에서 뺀다. */
export function buildPastSeasonLinks(state: CareerState): PastSeasonLink[] {
  const excludeHistoryIndex =
    state.season === null && state.seasonHistory.length > 0 ? state.seasonHistory.length - 1 : null;
  return state.seasonHistory
    .map((summary, historyIndex) => ({ historyIndex, seasonNumber: summary.index }))
    .filter((entry) => entry.historyIndex !== excludeHistoryIndex)
    .reverse();
}

function storedSeasonAgeLabel(state: CareerState, historyIndex: number): string {
  const ageAtStart = state.seasonHistory[historyIndex]?.result.legacy?.ageAtStart;
  return ageAtStart === undefined ? '' : `${ageAtStart}세 · `;
}

/** 계약 전에는 전술실·휴대폰을 잠근다. 계약 직후 처음 열릴 때만 한 줄 설명을 보여준다(브리프:
 * LocalStore kv 'ui:revealed'). */
function useStatsRevealCaption(unlocked: boolean): boolean {
  const engineQuery = useEngine();
  const [show, setShow] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!unlocked || handledRef.current || engineQuery.data === undefined) return;
    handledRef.current = true;
    const store = engineQuery.data.store;
    void (async () => {
      const alreadyRevealed = await readRevealedStats(store);
      if (!alreadyRevealed) {
        setShow(true);
        await markStatsRevealed(store);
      }
    })();
  }, [unlocked, engineQuery.data]);

  return show;
}

/** T-2-007 일정표 구역: 리그는 순위/팀 수, 컵은 라운드를 함께 보여준다(팀의 leagueId·leagueTier로
 * 리그·컵 이름을 룰셋에서 찾는다 — season.competitions는 'LEAGUE'|'CUP' 고정 id만 갖는다). */
function competitionSummaryLine(
  record: CompetitionRecord,
  season: FootballSeason,
  ruleset: Ruleset,
): string {
  const team = ruleset.teams.find((candidate) => candidate.id === season.teamId);
  const winDrawLoss = `${record.won}승 ${record.drawn}무 ${record.lost}패`;
  if (record.kind === 'LEAGUE') {
    const league =
      team === undefined
        ? undefined
        : ruleset.leagues.find((candidate) => candidate.id === team.leagueId);
    const positionText =
      record.position === null ? '—' : `${record.position}위/${league?.teamCount ?? '—'}팀`;
    return `${league?.name ?? '리그'} · ${positionText} · ${winDrawLoss}`;
  }
  const cup =
    team === undefined
      ? undefined
      : ruleset.cups.find((candidate) => candidate.tiers.includes(team.leagueTier));
  const roundText = cupProgressLabel(record.cupRound);
  return `${cup?.name ?? '컵'} · ${roundText} · ${winDrawLoss}`;
}

/** UX-007 다음 행동 히어로: pending 없이 시즌이 진행 중일 때, 아직 안 치른 다음 일정이 경기면
 * "vs 상대팀 · 대회/라운드" 맥락을 만든다. 일정 탭과 같은 buildScheduleRows(같은 소스)에서
 * 파생하고 새 도메인 계산은 하지 않는다 — 탈락 행·이미 치른 행은 건너뛴다. */
export function nextMatchHeroContext(
  season: FootballSeason,
  ruleset: Ruleset,
  teamNameOverrides: TeamNameOverrides,
): string | null {
  const upcoming = buildScheduleRows(season, ruleset, teamNameOverrides).find(
    (row) => !row.eliminated && row.match === null,
  );
  return upcoming === undefined ? null : `vs ${upcoming.opponentName} · ${upcoming.competitionLabel}`;
}

function NextDecisionCard({
  careerId,
  state,
  clock,
  startYear,
}: {
  careerId: string;
  state: CareerState;
  clock: CareerClockView;
  startYear: number;
}) {
  const navigate = useNavigate();
  const advanceMutation = useCareerMutation('advance');
  const settleSeasonMutation = useCareerMutation('settleSeason');
  const teamNameOverrides = useUiStore((uiState) => uiState.teamNameOverrides);
  const [nothingToAdvance, setNothingToAdvance] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const pending = state.pending;
  const advancing = advanceMutation.isPending;
  const settling = settleSeasonMutation.isPending;
  const ruleset = rulesetForCareer(state);

  /** UX-007: 맥락(eyebrow+제목+선택 설명)과 CTA를 한 프레임 안에 묶는다(이중 프레임 제거) — 상태별
   * 분기는 그대로 두고 시각 구조만 통일한다. */
  function hero(heading: string, detail: string | null, children: ReactNode) {
    return (
      <Card className="os-next-action flex flex-col gap-os-4">
        <div className="flex flex-col gap-os-1">
          <p className="os-eyebrow">{clock.progress}</p>
          <h2 id="next-action-title" className="os-section-title">
            {heading}
          </h2>
          {detail !== null ? (
            <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
              {detail}
            </p>
          ) : null}
        </div>
        {children}
      </Card>
    );
  }

  const handleAdvance = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    platform.analytics.track('advance_clicked', { step: state.currentStep });
    try {
      const result = await advanceMutation.mutateAsync({ careerId });
      if (result.ok) {
        const nextState = result.domainSnapshot.state;
        if (nextState.currentStep > state.currentStep && nextState.season !== null) {
          trackStepPassed(nextState.season, careerId);
        }
        const target = screenForCareer(nextState);
        void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
        return;
      }
      const details = result.error.details;
      const reason =
        typeof details === 'object' && details !== null && 'reason' in details
          ? (details as { reason?: unknown }).reason
          : undefined;
      if (reason === 'NOTHING_TO_ADVANCE') {
        setNothingToAdvance(true);
        return;
      }
      setErrorMessage('진행하지 못했습니다. 다시 시도해 주세요.');
    } catch {
      setErrorMessage('진행하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
    }
  };

  const handleSettle = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    // 결산 뒤에는 state.season이 null이 된다 — 정산 대상 시즌은 요청 전에 미리 잡아 둔다.
    const preSettleSeason = state.season;
    try {
      const result = await settleSeasonMutation.mutateAsync({ careerId });
      if (!result.ok) {
        setErrorMessage('시즌을 결산하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      if (preSettleSeason !== null) {
        const { decisionsOpened, matchesPlayed } = sumStepSummaries(preSettleSeason);
        await recordSeasonSettled(careerId, {
          seasonIndex: preSettleSeason.index,
          simulationMode: preSettleSeason.simulationMode,
          decisionsOpened,
          matchesPlayed,
        });
      }
      void navigate({ to: SCREEN_ROUTES['SCR-015'], params: { careerId } });
    } catch {
      setErrorMessage('시즌을 결산하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
    }
  };

  if (pending !== null && (pending.kind === 'EVENT' || pending.kind === 'INJURY' || pending.kind === 'NATIONAL_TEAM')) {
    const target = screenForCareer(state);
    return hero('결정이 기다립니다', null, (
      <Link
        to={SCREEN_ROUTES[target.screenId]}
        params={target.params}
        className={buttonClassName('primary')}
        style={buttonStyle}
      >
        결정하러 가기
      </Link>
    ));
  }

  if (pending !== null && pending.kind === 'OFFERS') {
    return hero(`제안 ${pending.offers.length}건`, null, (
      <Link
        to="/career/$careerId/offers"
        params={{ careerId }}
        className={buttonClassName('primary')}
        style={buttonStyle}
      >
        제안 보기
      </Link>
    ));
  }

  if (pending !== null && pending.kind === 'CONTRACT' && pending.offers.length > 0) {
    return hero(`재계약 제안 ${pending.offers.length}건`, null, (
      <Link to="/career/$careerId/offers" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
        제안 비교
      </Link>
    ));
  }

  if (pending !== null && pending.kind === 'LOAN_RETURN') {
    return hero('임대 복귀 결정', null, (
      <Link to="/career/$careerId/transfer-result" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
        복귀 조건 보기
      </Link>
    ));
  }

  if (pending !== null && pending.kind === 'ROLE_PROPOSAL') {
    return hero('감독 제안이 기다립니다', null, (
      <Link
        to="/career/$careerId/role"
        params={{ careerId }}
        className={buttonClassName('primary')}
        style={buttonStyle}
      >
        제안 보기
      </Link>
    ));
  }

  if (pending !== null && pending.kind === 'SETTLEMENT') {
    return hero('시즌 결산', null, (
      <div className="flex flex-col gap-os-2">
        <div className="flex flex-col gap-os-4">
          <Button
            variant="primary"
            disabled={settleSeasonMutation.isPending}
            onClick={() => void handleSettle()}
          >
            {settling ? '결산 중' : '결산하기'}
          </Button>
          {settling ? (
            <GamePending
              title={`${state.season === null ? '시즌' : seasonYearLabel(startYear, state.season.index)} 기록을 정리하고 있습니다`}
              detail="경기 기록과 성장 결과를 저장한 뒤 시즌 리뷰를 엽니다."
            />
          ) : null}
        </div>
        {errorMessage ? (
          <ErrorState message={errorMessage} onRetry={() => void handleSettle()} />
        ) : null}
      </div>
    ));
  }

  if (pending !== null && pending.kind === 'CHAPTER') {
    return hero(chapterCardLabel(state, pending, ruleset, teamNameOverrides), null, (
      <Link
        to="/career/$careerId/chapter"
        params={{ careerId }}
        search={{ d: pending.resolved.length }}
        className={buttonClassName('primary')}
        style={buttonStyle}
      >
        경기 보기
      </Link>
    ));
  }

  if (pending === null && state.season === null && state.contract !== null) {
    return hero('프리시즌 계획', null, (
      <Link
        to="/career/$careerId/preseason"
        params={{ careerId }}
        className={buttonClassName('primary')}
        style={buttonStyle}
      >
        계획하러 가기
      </Link>
    ));
  }

  // UX-007: 다음 일정이 실제 경기면(탈락·이미 치른 경기가 아니면) "다음 경기" 맥락을 크게 보여준다.
  // 경기가 아니거나 시즌이 없으면 기존 "다음 행동" 문구(clock.detail)를 그대로 유지한다.
  const matchContext = state.season === null ? null : nextMatchHeroContext(state.season, ruleset, teamNameOverrides);

  return hero(matchContext !== null ? '다음 경기' : '다음 행동', matchContext ?? clock.detail, (
    <div className="flex flex-col gap-os-2">
      <Button
        variant="primary"
        onClick={() => void handleAdvance()}
        disabled={nothingToAdvance || advanceMutation.isPending}
      >
        {advancing ? '진행 중' : '진행'}
      </Button>
      {advancing ? (
        <GamePending
          title="시즌을 진행하고 있습니다"
          detail={state.season === null
            ? '다음 일정을 준비하고 있습니다.'
            : `${seasonYearLabel(startYear, state.season.index)} · step ${state.currentStep} 이후 일정을 처리하고 있습니다.`}
        />
      ) : null}
      {nothingToAdvance ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          다음 시즌은 곧 열립니다
        </p>
      ) : null}
      {errorMessage ? (
        <ErrorState message={errorMessage} onRetry={() => void handleAdvance()} />
      ) : null}
    </div>
  ));
}

/** UX-007 컨디션 타일: 폼·체력·사기를 같은 위계의 타일 + 0~100 미터로 보여준다(StatusStrip과 달리
 * 첫 항목을 액센트로 강조하지 않는다 — player 탭 Base OVR과 섞이면 버튼처럼 보인다는 불만,
 * PR 본문 참고). 낮은 값은 색 대신 아이콘+라벨도 같이 보여준다(색약 대응). */
function ConditionTiles({ items }: { items: ConditionTileItem[] }) {
  return (
    <ul className="os-condition-tiles" aria-label="현재 컨디션">
      {items.map((item) => {
        const percent = Math.max(0, Math.min(100, item.value));
        return (
          <li key={item.id} className="flex flex-col gap-os-2 rounded-os-m bg-os-surface-2 p-os-3">
            <div className="flex items-baseline justify-between gap-os-2">
              <span className="font-os text-os-text-2" style={CAPTION_STYLE}>
                {item.label}
              </span>
              <span
                className="os-num font-os font-semibold text-os-text"
                style={{ fontSize: 'var(--os-fs-num-md)', lineHeight: 'var(--os-lh-num-md)' }}
              >
                {item.value}
              </span>
            </div>
            <div
              className="os-condition-meter"
              role="progressbar"
              aria-label={item.label}
              aria-valuenow={item.value}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
            {item.low ? (
              <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                <span aria-hidden="true" className="text-os-warning">▼</span> {item.tierLabel}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function CareerDashboard() {
  const { careerId } = Route.useParams();
  const { signed, view } = Route.useSearch();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const serviceSeasonQuery = useServiceSeason();
  const [showSignedToast, setShowSignedToast] = useState(signed === true);
  const initialisedRef = useRef(false);
  const tab = view ?? 'home';
  const [tabDirection, setTabDirection] = useState<ScreenDirection>('forward');
  const reducedMotion = useReducedMotion();
  const teamNameOverrides = useUiStore((uiState) => uiState.teamNameOverrides);
  const mutating = useIsMutating() > 0;
  const tabIndex = DASHBOARD_TABS.findIndex((value) => value === tab);

  function changeTab(value: string) {
    const nextIndex = DASHBOARD_TABS.findIndex((candidate) => candidate === value);
    if (nextIndex < 0) return;
    setTabDirection(nextIndex < tabIndex ? 'back' : 'forward');
    void navigate({
      to: '/career/$careerId',
      params: { careerId },
      search: { ...(signed === true ? { signed: true } : {}), ...(value === 'home' ? {} : { view: value as DashboardTab }) },
      replace: true,
    });
  }

  useEffect(() => {
    if (initialisedRef.current) return;
    initialisedRef.current = true;
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-029',
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
    if (signed === true) {
      void navigate({
        to: '/career/$careerId',
        params: { careerId },
        search: view ? { view } : {},
        replace: true,
      });
    }
    // 마운트 시 1회만.
  }, []);

  const contractUnlocked = query.data !== undefined && query.data.state.contract !== null;
  const showRevealCaption = useStatsRevealCaption(contractUnlocked);

  if (query.data === undefined) {
    // 부모 레이아웃의 loader가 이미 데이터를 캐시에 채웠다. RESOLVED가 아닌 순간은 사실상 없다.
    return null;
  }

  const { state } = query.data;
  const ruleset = rulesetForCareer(state);
  // 사용자 결정(2026-09-13): 1시즌 = 1년, 커리어 시작 연도부터 "2026 시즌"으로 표기(season-year.ts).
  const startYear = careerStartYear({
    seasonServiceSeasonId: state.season?.serviceSeasonId ?? null,
    currentServiceSeason: serviceSeasonQuery.data,
    calendarStartYear: extractCalendarStartYear(ruleset.leagueCalendar),
  });
  const profile = state.player.profile;
  const draft = state.player.draft;
  const name = profile?.name ?? draft.name ?? '이름 없는 선수';
  const positionField = profile
    ? positionHeaderField(profile.primaryPosition, profile.preferredPosition)
    : { label: '포지션', value: draft.position ? POSITION_LABELS[draft.position] : '—' };
  const hasContract = state.contract !== null;
  const season = state.season;
  const room = deriveTacticalRoom(state, ruleset);
  const seasonChronicleItems = buildSeasonChronicleItems(state);
  const seasonResultItem = seasonChronicleItems.find(
    (item) => item.seasonResultHistoryIndex !== null,
  );
  const pastSeasonLinks = buildPastSeasonLinks(state);
  // C11: SCR-017 상단(MarketSummary)에만 있던 시장 사유·제안 수를 휴대폰 탭에도 조건부로 보여준다
  // (T-3-005 브리프 §1). 대시보드에서는 결정을 확정하지 않으므로 결정 화면으로 가는 링크만 둔다.
  const marketPending =
    state.pending !== null && (state.pending.kind === 'OFFERS' || state.pending.kind === 'CONTRACT')
      ? state.pending
      : null;
  const clock = buildCareerClock(state, startYear);
  const statusItems = hasContract ? proStatusStripItems(state) : u18StatusStripItems(state);
  // UX-007 홈 탭 컨디션 타일: StatusStrip과 별도로 폼·체력·사기를 동일한 위계의 타일+미터로 보여준다
  // (StatusStrip의 "첫 항목 액센트 강조"는 player 탭 Base OVR용이라 여기서는 쓰지 않는다).
  const conditionItems = conditionTileItems(state);
  // RES-BUG-001과 같은 정책: state.tags(라커룸 기억, 콘텐츠 팩 자유 문자열)를 원문 그대로 보여주지
  // 않고 RESULT_TAG_LABEL_KO 카탈로그로 바꾼다 — 미매핑 태그는 숨긴다(내부 식별자 노출 금지).
  const lockerRoomTagLabels = resultTagLabels(state.tags);
  // UX-007 최근 소식: 기록 탭과 같은 seasonChronicleItems를 재사용하되, 정보 없는 항목("진행" 단독
  // 같은 제네릭 라벨)은 걸러 의미 있는 최근 것부터 최대 3개만 보여준다.
  const recentChronicleItems = visibleRecentChronicleItems(seasonChronicleItems);
  const currentLeagueRows = season?.leagueLedger === undefined
    ? null
    : standingsFromLedger(ruleset, season.leagueLedger);
  const currentLeague = season?.leagueLedger === undefined
    ? undefined
    : ruleset.leagues.find((candidate) => candidate.id === season.leagueLedger!.leagueId);

  return (
    <div className="os-screen">
      <header className="os-career-identity flex flex-col gap-os-2">
        <p className="os-eyebrow">{currentTeamName(state, ruleset, teamNameOverrides)}</p>
        <div className="flex items-end justify-between gap-os-3">
          <h1 className="min-w-0 truncate font-os text-os-text" style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)', fontWeight: 750 }}>{name}</h1>
          <span className="os-num shrink-0 font-os font-bold text-os-accent">OVR {profile?.baseOvr ?? '—'}</span>
        </div>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {clock.headline} · {positionField.value}
        </p>
        {season ? (
          <div
            className="os-career-progress"
            role="progressbar"
            aria-label={`시즌 진행 ${season.currentStep} / ${season.steps.length}`}
            aria-valuenow={season.currentStep}
            aria-valuemin={0}
            aria-valuemax={season.steps.length}
          >
            <span style={{ width: `${Math.min(100, (season.currentStep / season.steps.length) * 100)}%` }} />
          </div>
        ) : null}
      </header>

      <Tabs value={tab} onValueChange={changeTab}>
        <div className="sticky top-0 z-20 overflow-x-auto bg-os-bg py-os-1">
          <TabsList aria-label="커리어 구역" className="min-w-max">
            <TabsTrigger value="home">홈</TabsTrigger>
            <TabsTrigger value="schedule">일정</TabsTrigger>
            <TabsTrigger value="player">선수</TabsTrigger>
            <TabsTrigger value="contract">계약</TabsTrigger>
            <TabsTrigger value="records">기록</TabsTrigger>
          </TabsList>
        </div>

        <MotionPanel motionKey={tab} direction={tabDirection} className="os-dashboard-tabs-motion">
          <SwipeSurface
            canSwipeLeft={tabIndex < DASHBOARD_TABS.length - 1}
            canSwipeRight={tabIndex > 0}
            disabled={mutating}
            reducedMotion={reducedMotion}
            onSwipe={(swipe) => {
              const next = DASHBOARD_TABS[tabIndex + (swipe === 'left' ? 1 : -1)];
              if (next) changeTab(next);
            }}
          >
            <TabsContent value="home">
              <section className="os-career-home" aria-label="지금 할 일">
                <NextDecisionCard careerId={careerId} state={state} clock={clock} startYear={startYear} />

                {season !== null && state.clubMeeting?.goal.seasonIndex === season.index ? (
                  <section className="os-panel flex flex-col gap-os-1" aria-label="이번 시즌 구단 면담 목표">
                    <p className="os-eyebrow">이번 시즌 목표</p>
                    <p>시즌 출전 확인 기준 {state.clubMeeting.goal.targetMinutesShareBp / 100}%</p>
                    <p className="os-muted">선발 보장이 아닌 시즌 종료 후 확인 기준입니다.</p>
                  </section>
                ) : null}

                <ConditionTiles items={conditionItems} />

                {season !== null && season.competitions.length > 0 ? (
                  <DashboardSection title="이번 시즌 요약" description="현재 리그·컵 성적입니다.">
                    <div className="flex flex-col gap-os-1">
                      {currentLeagueRows === null ? (
                        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                          룰셋 {state.rulesetVersion}에서는 전체 리그 순위 기록을 지원하지 않습니다.
                        </p>
                      ) : (
                        <p className="os-num font-os font-semibold text-os-text" style={BODY_STYLE}>
                          {leagueStandingSummary(currentLeagueRows, season.teamId)}
                        </p>
                      )}
                      {season.competitions.map((record) => (
                        <p
                          key={record.competitionId}
                          className="os-num font-os text-os-text"
                          style={BODY_STYLE}
                        >
                          {competitionSummaryLine(record, season, ruleset)}
                        </p>
                      ))}
                    </div>
                  </DashboardSection>
                ) : null}

                {recentChronicleItems.length > 0 ? (
                  <DashboardSection title="최근 소식" description="최근 커리어 진행 상황입니다.">
                    <ul className="flex flex-col gap-os-1">
                      {recentChronicleItems.map((item) => (
                        <li key={item.id} className="font-os text-os-text-2" style={CAPTION_STYLE}>
                          {item.sentence}
                        </li>
                      ))}
                    </ul>
                  </DashboardSection>
                ) : null}

                {state.status === 'ACTIVE' && state.season === null && state.seasonHistory.length > 0 ? (
                  <Link to="/career/$careerId/retirement" params={{ careerId }} className={buttonClassName('secondary')} style={buttonStyle}>커리어의 다음 선택</Link>
                ) : null}
                {state.status === 'RETIRED' || state.status === 'ARCHIVED' ? (
                    <Link to="/career/$careerId/retirement" params={{ careerId }} className={buttonClassName('secondary')} style={buttonStyle}>통산 기록 보기</Link>
                  ) : null}
              </section>
            </TabsContent>

            <TabsContent value="schedule">
              <DashboardSection
                title="일정표"
                description="현재 진행 상황과 다음 결정을 확인합니다."
              >
                {season === null ? (
                  <>
                    <p className="font-os text-os-text" style={BODY_STYLE}>
                      step {state.currentStep} · {SEASON_PHASE_LABEL_KO[state.seasonPhase]}
                    </p>
                    {state.pending === null ? (
                      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>다음 결정은 진행 후 열립니다.</p>
                    ) : (
                      <Button variant="secondary" onClick={() => changeTab('home')}>홈에서 결정 확인</Button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-os-4">
                    <SeasonTimeline steps={season.steps} currentStep={season.currentStep} />
                    {season.availability?.kind === 'INJURY' ? (
                      <dl className="grid grid-cols-2 gap-os-3 rounded-os-m bg-os-surface-2 p-os-3" aria-label="부상 상태">
                        <div>
                          <dt className="text-os-text-2">결장 잔여</dt>
                          <dd className="os-num font-semibold text-os-text">{season.availability.matchesRemaining}경기</dd>
                        </div>
                        <div>
                          <dt className="text-os-text-2">부상 상태</dt>
                          <dd className="font-semibold text-os-text">회복 중</dd>
                        </div>
                      </dl>
                    ) : null}
                    {state.health.episodes.filter((episode) => episode.status === 'RECOVERED' && episode.recurrenceChecksRemaining > 0).map((episode) => (
                      <p key={episode.id} className="rounded-os-m bg-os-surface-2 p-os-3 text-os-text-2" aria-label="부상 재발 판정 잔여">
                        회복한 부상의 재발 판정이 {episode.recurrenceChecksRemaining}경기 남아 있습니다.
                      </p>
                    ))}
                    {state.nationalTeam.callUps.some((entry) => entry.seasonIndex === season.index && entry.reason === 'INJURY') ? (
                      <p className="rounded-os-m bg-os-surface-2 p-os-3 text-os-text-2" aria-label="대표팀 자동 사양 사유">
                        부상으로 대표팀 소집을 자동 사양했습니다.
                      </p>
                    ) : null}
                    {hasContract && state.contract ? (
                      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                        시즌 목표: {ROLE_PROMISE_SENTENCE[state.contract.rolePromise]}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-os-2 rounded-os-m bg-os-surface-2 p-os-3">
                      {season.competitions.map((record) => (
                        <p
                          key={record.competitionId}
                          className="os-num font-os text-os-text-2"
                          style={CAPTION_STYLE}
                        >
                          {competitionSummaryLine(record, season, ruleset)}
                        </p>
                      ))}
                    </div>
                    {currentLeagueRows === null || season.leagueLedger === undefined || currentLeague === undefined ? (
                      <p className="rounded-os-m bg-os-surface-2 p-os-3 font-os text-os-text-2" style={CAPTION_STYLE}>
                        룰셋 {state.rulesetVersion}에서는 전체 리그 순위 기록을 지원하지 않습니다.
                      </p>
                    ) : (
                      <LeagueStandingsTable
                        rows={currentLeagueRows}
                        teamId={season.teamId}
                        leagueName={season.leagueLedger.leagueName}
                        completedRounds={season.leagueLedger.completedRounds.at(-1) ?? 0}
                        ruleset={ruleset}
                        teamNameOverrides={teamNameOverrides}
                        promotionSpots={currentLeague.promotionSpots}
                        relegationSpots={currentLeague.relegationSpots}
                      />
                    )}
                    <div className="flex flex-col gap-os-2">
                      {buildScheduleRows(season, ruleset, teamNameOverrides).map((row) => (
                        <div
                          key={`${row.step}-${row.order}`}
                          className="flex min-w-0 flex-col gap-os-1 rounded-os-m border border-os-border px-os-3 py-os-3 font-os text-os-text-2"
                          style={CAPTION_STYLE}
                        >
                          <span className="break-words">
                            step {row.step} · {row.competitionLabel} · {row.home ? '홈' : '원정'} ·{' '}
                            {row.opponentName}
                          </span>
                          <span className="os-num font-semibold text-os-text">
                            {row.eliminated
                              ? '탈락'
                              : row.match === null
                                ? '—'
                                : `${row.match.scoreText} · ${row.match.appearanceLabel} · ${row.match.minutes}분 · ${row.match.ratingText}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DashboardSection>
            </TabsContent>

            <TabsContent value="player">
              <StatusStrip items={statusItems} />
              <dl className="mb-os-3 grid grid-cols-2 gap-os-2 rounded-os-m bg-os-surface-2 p-os-3 font-os text-os-text-2" style={CAPTION_STYLE}>
                <div><dt>포지션</dt><dd className="mt-os-1 font-semibold text-os-text">{positionField.value}</dd><dd>{positionField.caption}</dd></div>
                <div><dt>아키타입</dt><dd className="mt-os-1 font-semibold text-os-text">{archetypeName(ruleset, profile?.archetypeId ?? draft.archetypeId)}</dd></div>
                <div><dt>등번호</dt><dd className="os-num mt-os-1 font-semibold text-os-text">{state.contract ? state.contract.shirtNumber : '—'}</dd></div>
              </dl>
              <DashboardSection
                title="라커룸"
                description="감독·주장·경쟁자·동료 관계의 최근 기억입니다."
              >
                {lockerRoomTagLabels.length === 0 ? (
                  <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                    아직 기억 태그가 없습니다.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-os-1">
                    {lockerRoomTagLabels.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-os-s bg-os-surface-2 px-os-2 py-os-1 font-os text-os-text-2"
                        style={CAPTION_STYLE}
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
                {hasContract ? (
                  <div className="flex flex-col gap-os-3">
                    <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                      {state.seasonHistory.length === 0
                        ? '관계 단계는 현재 상태입니다. 화살표는 최근 관계 기록의 변화 방향입니다.'
                        : '공개된 수치는 현재 관계 값입니다. 화살표는 최근 관계 기록의 변화 방향입니다.'}
                    </p>
                    <dl
                      className="grid grid-cols-2 gap-os-2 font-os text-os-text-2 [&>div]:rounded-os-m [&>div]:bg-os-surface-2 [&>div]:p-os-3 [&_dd]:mt-os-1 [&_dd]:font-semibold"
                      style={CAPTION_STYLE}
                    >
                      {relationshipRows(state, state.seasonHistory.length > 0).map((row) => (
                        <div key={row.target}>
                          <dt>{row.label} <span aria-label={`${row.label} 최근 변화 방향`}>{row.direction}</span></dt>
                          <dd className="text-os-text">{state.seasonHistory.length > 0 ? '현재 값' : '현재 단계'} {row.display}</dd>
                          <dd>
                            {state.memoryTags[row.target].map((tag) => relationshipReasonLabel(tag)).join(' · ') ||
                              '아직 쌓인 기억이 없습니다'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {state.memoryTags.captain.length === 0 ? (
                      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>주장단 관계는 관련 라커룸 사건과 선택에 따라 달라질 수 있습니다.</p>
                    ) : null}
                    {state.relationshipLog.length > 0 ? (
                      <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={CAPTION_STYLE}>
                        {state.relationshipLog.slice(-3).reverse().map((entry, index) => (
                          <li key={`${entry.sourceId}-${entry.seasonIndex}-${entry.step}-${index}`}>
                            {RELATION_LABELS[entry.target]} {entry.delta > 0 ? '↑' : entry.delta < 0 ? '↓' : '→'} · {relationshipReasonLabel(entry.reasonTag)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </DashboardSection>
              <DashboardSection
                title="전술실"
                description="역할 약속과 전술 적합도, 선발 순위를 봅니다."
                locked={!hasContract}
                lockReason="첫 프로 계약 후 열림"
              >
                {hasContract && state.contract ? (
                  <div className="flex flex-col gap-os-3">
                    {showRevealCaption ? (
                      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                        전술 적합도·감독 신뢰가 새로 열렸습니다.
                      </p>
                    ) : null}
                    {room === null ? (
                      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                        시즌 시작 후 열립니다
                      </p>
                    ) : (
                      <>
                        <p className="font-os text-os-text" style={BODY_STYLE}>
                          {room.styleName} · {room.formation}
                        </p>
                        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                          {POSITION_LABELS[room.playerPosition]} ·{' '}
                          {SQUAD_ROLE_LABELS[room.playerRole]}
                        </p>
                        <dl
                          className="grid grid-cols-2 gap-os-2 font-os text-os-text-2 [&>div]:rounded-os-m [&>div]:bg-os-surface-2 [&>div]:p-os-3 [&_dd]:mt-os-1 [&_dd]:font-semibold"
                          style={CAPTION_STYLE}
                        >
                          <div>
                            <dt>전술 적합도</dt>
                            <dd className="os-num text-os-text">{room.tacticalFit}</dd>
                          </div>
                          <div>
                            <dt>감독 신뢰</dt>
                            <dd className="os-num text-os-text">{room.managerTrust}</dd>
                          </div>
                          <div>
                            <dt>경기 예상치</dt>
                            <dd className="os-num text-os-text">{room.expectedPerformance}</dd>
                          </div>
                          <div>
                            <dt>숙련도</dt>
                            <dd className="os-num text-os-text">
                              {familiarityPercentLabel(room.familiarity)}
                            </dd>
                          </div>
                        </dl>
                        <SelectionRankingList ranking={room.ranking} />
                      </>
                    )}
                    <div className="flex flex-col gap-os-2">
                      <Link
                        to="/career/$careerId/attributes"
                        params={{ careerId }}
                        className={buttonClassName('secondary')}
                        style={buttonStyle}
                      >
                        능력치 상세
                      </Link>
                      {state.pending !== null && state.pending.kind === 'ROLE_PROPOSAL' ? (
                        <Link
                          to="/career/$careerId/role"
                          params={{ careerId }}
                          className={buttonClassName('secondary')}
                          style={buttonStyle}
                        >
                          감독 제안 보기
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </DashboardSection>
            </TabsContent>

            <TabsContent value="contract">
              <DashboardSection
                title="휴대폰"
                description="계약 상태를 확인합니다."
                locked={!hasContract}
                lockReason="첫 프로 계약 후 열림"
              >
                {hasContract && state.contract ? (
                  <div className="flex flex-col gap-os-3">
                    {marketPending !== null ? (
                      <div className="flex flex-col gap-os-2 rounded-os-m bg-os-surface-2 p-os-3">
                        <p className="font-os text-os-text" style={BODY_STYLE}>
                          {`${MARKET_REASON_LABEL_KO[marketPending.market.reason]} · 제안 ${marketPending.offers.length}건`}
                        </p>
                        <Link
                          to="/career/$careerId/offers"
                          params={{ careerId }}
                          className={buttonClassName('secondary')}
                          style={buttonStyle}
                        >
                          이적시장에서 확인
                        </Link>
                      </div>
                    ) : null}
                    <dl
                      className="grid grid-cols-2 gap-os-2 font-os text-os-text-2 [&>div]:rounded-os-m [&>div]:bg-os-surface-2 [&>div]:p-os-3 [&_dd]:mt-os-1 [&_dd]:font-semibold"
                      style={CAPTION_STYLE}
                    >
                      {buildCurrentContractSummary(state).map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd className="text-os-text">{item.value}</dd>
                        </div>
                      ))}
                      <div>
                        <dt>인기</dt>
                        <dd className="text-os-text">
                          {state.seasonHistory.length > 0
                            ? Math.round(state.reputation.popularityCenti / 100)
                            : popularityTierLabel(state.reputation.popularityCenti)}
                        </dd>
                      </div>
                      {season?.manager ? (
                        <div>
                          <dt>감독</dt>
                          <dd className="text-os-text">
                            {season.manager.name} · {season.manager.tenureSeasons}시즌
                          </dd>
                        </div>
                      ) : null}
                      {state.seasonHistory.length > 0 ? (
                        <div>
                          <dt>주장단</dt>
                          <dd className="text-os-text">{state.captaincy === 'CAPTAIN' ? '주장' : state.captaincy === 'VICE' ? '부주장' : '없음'}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
              </DashboardSection>
            </TabsContent>

            <TabsContent value="records">
              <DashboardSection title="다이어리" description="이번 커리어의 연대기입니다.">
                <div className="flex flex-col gap-os-4">
                  <div className="flex flex-col gap-os-2">
                    <h3 className="font-os font-semibold text-os-text" style={BODY_STYLE}>
                      나의 연대기
                    </h3>
                    <CareerTimeline
                      items={buildCareerMilestoneItems(state)}
                      emptyMessage="아직 기록이 없습니다"
                    />
                  </div>
                  {seasonResultItem?.seasonResultHistoryIndex !== null &&
                  seasonResultItem?.seasonResultHistoryIndex !== undefined ? (
                    <div className="flex flex-col gap-os-2">
                      <h3 className="font-os font-semibold text-os-text" style={BODY_STYLE}>
                        최근 시즌 결과
                      </h3>
                      <Link
                        to="/career/$careerId/season-result"
                        params={{ careerId }}
                        search={{ season: seasonResultItem.seasonResultHistoryIndex }}
                        className="font-os text-os-text underline"
                        style={CAPTION_STYLE}
                      >
                        {storedSeasonAgeLabel(state, seasonResultItem.seasonResultHistoryIndex)}
                        {seasonResultItem.sentence}
                      </Link>
                    </div>
                  ) : null}
                  {seasonChronicleItems.length > 0 ? (
                    <details className="rounded-os-m border border-os-border px-os-3 py-os-2">
                      <summary className="cursor-pointer font-os font-semibold text-os-text" style={BODY_STYLE}>
                        이번 시즌 상세 진행 {seasonChronicleItems.length}개
                      </summary>
                      <ol className="mt-os-3 flex flex-col gap-os-1">
                        {seasonChronicleItems.map((item) =>
                          item.seasonResultHistoryIndex !== null ? (
                            <li key={item.id}>
                              <Link
                                to="/career/$careerId/season-result"
                                params={{ careerId }}
                                search={{ season: item.seasonResultHistoryIndex }}
                                className="font-os text-os-text underline"
                                style={CAPTION_STYLE}
                              >
                                {item.sentence}
                              </Link>
                            </li>
                          ) : (
                            <li
                              key={item.id}
                              className="font-os text-os-text-2"
                              style={CAPTION_STYLE}
                            >
                              {item.sentence}
                            </li>
                          ),
                        )}
                      </ol>
                    </details>
                  ) : null}
                  {pastSeasonLinks.length > 0 ? (
                    <div className="flex flex-col gap-os-2">
                      <h3 className="font-os font-semibold text-os-text" style={BODY_STYLE}>
                        지난 시즌
                      </h3>
                      <ul className="flex flex-col gap-os-1">
                        {pastSeasonLinks.map((link) => (
                          <li key={link.historyIndex}>
                            <Link
                              to="/career/$careerId/season-result"
                              params={{ careerId }}
                              search={{ season: link.historyIndex }}
                              className="font-os text-os-text underline"
                              style={CAPTION_STYLE}
                            >
                              {storedSeasonAgeLabel(state, link.historyIndex)}{seasonYearLabelWithOrdinal(startYear, link.seasonNumber)} 결산 보기
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </DashboardSection>
            </TabsContent>
          </SwipeSurface>
        </MotionPanel>
      </Tabs>

      {/* UX-007: 허브로·설정을 같은 위계(보조 버튼)의 나란한 두 버튼으로 맞춘다(이전에는 버튼+텍스트
          링크가 섞여 정렬이 어긋나 보였다). 탭과 무관한 공용 하단 영역이라 모든 탭에서 동일하다. */}
      <div className="grid grid-cols-2 gap-os-3">
        <Link to="/" className={buttonClassName('secondary')} style={buttonStyle}>
          허브로
        </Link>
        <Link to="/settings" className={buttonClassName('secondary')} style={buttonStyle}>
          설정
        </Link>
      </div>

      {showSignedToast ? (
        <Toast
          variant="success"
          message="계약을 맺었습니다"
          onDismiss={() => setShowSignedToast(false)}
        />
      ) : null}
    </div>
  );
}
