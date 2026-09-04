// SCR-029 커리어 대시보드. 다섯 구역 탭 + "다음 결정" 카드. 대시보드에서는 어떤 명령도 확정하지
// 않는다 — advance/settleSeason은 결정이 아니라 "진행"이며(다음에 뭐가 뜰지는 도메인이 정한다),
// 결정 확정은 전용 화면(SCR-007·008·009·010·012·013·014)에서만 일어난다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  deriveTacticalRoom,
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
  PlayerHeader,
  StatusStrip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
  type CareerTimelineItem,
} from '@offside/ui';
import { activeContentPack, activeRuleset } from '../engine/content.js';
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
  SEASON_PHASE_LABEL_KO,
  SQUAD_ROLE_LABELS,
  TIMELINE_KIND_LABEL_KO,
} from '../shared/labels.js';
import { markStatsRevealed, readRevealedStats } from '../shared/revealed-stats.js';
import { proStatusStripItems, u18StatusStripItems } from '../shared/status-strip.js';
import { platform } from '../platform/index.js';
import { SCREEN_ROUTES } from '../routes.js';
import { SeasonTimeline } from '../shared/season-timeline.js';
import { buildScheduleRows } from '../shared/season-schedule.js';
import { cupProgressLabel, opponentDisplayName } from '../shared/competition-labels.js';
import { eventOutcomeTitle } from '../shared/legacy-event-copy.js';
import { familiarityPercentLabel, SelectionRankingList } from '../shared/tactical-room.js';
import { buildCurrentContractSummary } from '../shared/transfer-view.js';

type DashboardSearch = { signed?: boolean };

export const Route = createFileRoute('/career/$careerId/')({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => (search.signed === true ? { signed: true } : {}),
  component: CareerDashboard,
});

const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

function timelineSentence(entry: TimelineEntry, state: CareerState): string {
  switch (entry.kind) {
    case 'CAREER_CONFIRMED':
      return '선수 생활 시작';
    case 'CONTRACT_SIGNED':
      return state.contract !== null && entry.refId === state.contract.id ? `${state.contract.teamName}과 계약` : '계약';
    case 'SEASON_STARTED':
      return '시즌 시작';
    case 'STEP_PASSED':
      return '진행';
    case 'SEASON_SETTLED':
      return '시즌 정산';
    case 'EVENT_RESOLVED': {
      if (entry.refId === null) return '이벤트';
      const [eventId, choiceId, outcomeId] = entry.refId.split(':');
      const definition = eventId === undefined ? undefined : activeContentPack.eventsById.get(eventId);
      const choice = definition?.choices.find((candidate) => candidate.id === choiceId);
      const outcome = choice?.outcomes.find((candidate) => candidate.id === outcomeId);
      return definition === undefined || choice === undefined || outcome === undefined ? '이벤트' : `${choice.label} → ${eventOutcomeTitle(definition, outcome)}`;
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
  }
}

function buildTimelineItems(state: CareerState): CareerTimelineItem[] {
  return [...state.timeline].reverse().map((entry, index) => ({
    // RULE-TIME-002: ADVANCE 한 번이 여러 step을 지나가면 STEP_PASSED 항목 여럿이 같은
    // revision을 공유한다(packages/domain/src/simulate.ts) — revision만으로는 key가
    // 중복될 수 있어 배열 위치를 덧붙인다(T-2-009에서 발견, PR 본문 기록).
    id: `${entry.kind}-${entry.revision}-${index}`,
    age: entry.age,
    stage: TIMELINE_KIND_LABEL_KO[entry.kind],
    title: timelineSentence(entry, state),
  }));
}

/** T-2-009 목표 "다이어리에 이번 시즌 연대기 요약을 붙인다": 이번 시즌(진행 중이면 현재, 아니면
 * 방금 결산한 시즌) timeline 구간의 [SEASON_STARTED revision, SEASON_SETTLED revision 또는 끝]. */
function currentSeasonChronicleBounds(state: CareerState): { startRevision: number; endRevision: number | null } | null {
  const startEntry = [...state.timeline].reverse().find((entry) => entry.kind === 'SEASON_STARTED');
  if (startEntry === undefined) return null;
  const settledEntry = state.timeline.find((entry) => entry.kind === 'SEASON_SETTLED' && entry.revision > startEntry.revision);
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
  const parts = [wins > 0 ? `${wins}승` : null, draws > 0 ? `${draws}무` : null, losses > 0 ? `${losses}패` : null].filter(
    (part): part is string => part !== null,
  );
  return parts.length > 0 ? parts.join(' ') : '진행';
}

function roleResolvedChronicleSentence(entry: TimelineEntry): string {
  const [type, decision] = (entry.refId ?? '').split(':');
  const typeLabel = type !== undefined && type in ROLE_PROPOSAL_TYPE_LABEL_KO ? ROLE_PROPOSAL_TYPE_LABEL_KO[type as RoleProposal['type']] : '역할';
  const decisionLabel = decision === 'ACCEPT' || decision === 'DECLINE' ? ROLE_DECISION_LABEL_KO[decision] : '';
  return decisionLabel === '' ? `${typeLabel} 제안` : `${typeLabel} 제안 · ${decisionLabel}`;
}

export type SeasonChronicleItem = { id: string; sentence: string; seasonResultHistoryIndex: number | null };

/** SEASON_SETTLED 카드는 이 시즌의 `seasonHistory` 위치를 실어 SCR-015 링크를 만들 수 있게 한다. */
export function buildSeasonChronicleItems(state: CareerState): SeasonChronicleItem[] {
  const bounds = currentSeasonChronicleBounds(state);
  if (bounds === null) return [];
  return state.timeline
    .filter((entry) => entry.revision >= bounds.startRevision && (bounds.endRevision === null || entry.revision <= bounds.endRevision))
    .map((entry, index) => {
      const seasonResultHistoryIndex =
        entry.kind === 'SEASON_SETTLED' ? state.seasonHistory.findIndex((summary) => summary.settledAtRevision === entry.revision) : -1;
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

export type PastSeasonLink = { historyIndex: number; seasonNumber: number };

/** 연대기 카드에 이미 나온 시즌(방금 결산한 시즌)은 과거 목록에서 뺀다. */
export function buildPastSeasonLinks(state: CareerState): PastSeasonLink[] {
  const excludeHistoryIndex = state.season === null && state.seasonHistory.length > 0 ? state.seasonHistory.length - 1 : null;
  return state.seasonHistory
    .map((summary, historyIndex) => ({ historyIndex, seasonNumber: summary.index }))
    .filter((entry) => entry.historyIndex !== excludeHistoryIndex)
    .reverse();
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
function competitionSummaryLine(record: CompetitionRecord, season: FootballSeason, ruleset: Ruleset): string {
  const team = ruleset.teams.find((candidate) => candidate.id === season.teamId);
  const winDrawLoss = `${record.won}승 ${record.drawn}무 ${record.lost}패`;
  if (record.kind === 'LEAGUE') {
    const league = team === undefined ? undefined : ruleset.leagues.find((candidate) => candidate.id === team.leagueId);
    const positionText = record.position === null ? '—' : `${record.position}위/${league?.teamCount ?? '—'}팀`;
    return `${league?.name ?? '리그'} · ${positionText} · ${winDrawLoss}`;
  }
  const cup = team === undefined ? undefined : ruleset.cups.find((candidate) => candidate.tiers.includes(team.leagueTier));
  const roundText = cupProgressLabel(record.cupRound);
  return `${cup?.name ?? '컵'} · ${roundText} · ${winDrawLoss}`;
}

function NextDecisionCard({ careerId, state }: { careerId: string; state: CareerState }) {
  const navigate = useNavigate();
  const advanceMutation = useCareerMutation('advance');
  const settleSeasonMutation = useCareerMutation('settleSeason');
  const [nothingToAdvance, setNothingToAdvance] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const pending = state.pending;

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
          trackStepPassed(nextState.season);
        }
        const target = screenForCareer(nextState);
        void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
        return;
      }
      const details = result.error.details;
      const reason = typeof details === 'object' && details !== null && 'reason' in details ? (details as { reason?: unknown }).reason : undefined;
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

  if (pending !== null && (pending.kind === 'EVENT' || pending.kind === 'INJURY')) {
    const target = screenForCareer(state);
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          결정이 기다립니다
        </p>
        <Link to={SCREEN_ROUTES[target.screenId]} params={target.params} className={buttonClassName('primary')} style={buttonStyle}>
          결정하러 가기
        </Link>
      </Card>
    );
  }

  if (pending !== null && pending.kind === 'OFFERS') {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          제안 {pending.offers.length}건
        </p>
        <Link to="/career/$careerId/offers" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
          제안 보기
        </Link>
      </Card>
    );
  }

  if (pending !== null && pending.kind === 'CONTRACT' && pending.offers.length > 0) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          재계약 제안 {pending.offers.length}건
        </p>
        <Link to="/career/$careerId/offers" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
          제안 비교
        </Link>
      </Card>
    );
  }

  if (pending !== null && pending.kind === 'LOAN_RETURN') {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          임대 복귀 결정
        </p>
        <Link to="/career/$careerId/transfer-result" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
          복귀 조건 보기
        </Link>
      </Card>
    );
  }

  if (pending !== null && pending.kind === 'ROLE_PROPOSAL') {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          감독 제안이 기다립니다
        </p>
        <Link to="/career/$careerId/role" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
          제안 보기
        </Link>
      </Card>
    );
  }

  if (pending !== null && pending.kind === 'SETTLEMENT') {
    return (
      <Card className="flex flex-col gap-os-2">
        <div className="flex flex-wrap items-center justify-between gap-os-3">
          <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
            시즌 결산
          </p>
          <Button variant="primary" disabled={settleSeasonMutation.isPending} onClick={() => void handleSettle()}>
            결산하기
          </Button>
        </div>
        {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void handleSettle()} /> : null}
      </Card>
    );
  }

  if (pending !== null && pending.kind === 'CHAPTER') {
    // 상대 이름은 season.matches에서 찾아 덧붙인다 — 기존 단위 테스트가 matchId 없이 CHAPTER
    // pending을 주입하므로(match 조회 실패), 그때는 상대 이름 없이 "핵심 경기"로만 낮춘다.
    const opponent = state.season?.matches.find((candidate) => candidate.id === pending.matchId)?.opponent;
    const opponentName = opponent === undefined ? undefined : opponentDisplayName(opponent, activeRuleset);
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          {opponentName === undefined ? '핵심 경기' : `핵심 경기 — ${opponentName}`}
        </p>
        <Link
          to="/career/$careerId/chapter"
          params={{ careerId }}
          search={{ d: pending.resolved.length }}
          className={buttonClassName('primary')}
          style={buttonStyle}
        >
          경기 보기
        </Link>
      </Card>
    );
  }

  if (pending === null && state.season === null && state.contract !== null) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          프리시즌 계획
        </p>
        <Link to="/career/$careerId/preseason" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
          계획하러 가기
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-os-2">
      <Button variant="primary" onClick={() => void handleAdvance()} disabled={nothingToAdvance || advanceMutation.isPending}>
        진행
      </Button>
      {nothingToAdvance ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          다음 시즌은 곧 열립니다
        </p>
      ) : null}
      {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void handleAdvance()} /> : null}
    </Card>
  );
}

function CareerDashboard() {
  const { careerId } = Route.useParams();
  const { signed } = Route.useSearch();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const [showSignedToast, setShowSignedToast] = useState(signed === true);
  const initialisedRef = useRef(false);

  useEffect(() => {
    if (initialisedRef.current) return;
    initialisedRef.current = true;
    platform.analytics.track('screen_viewed', { screenId: 'SCR-029', careerPhase: query.data?.state.seasonPhase ?? 'NONE' });
    if (signed === true) {
      void navigate({ to: '/career/$careerId', params: { careerId }, search: {}, replace: true });
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
  const profile = state.player.profile;
  const draft = state.player.draft;
  const name = profile?.name ?? draft.name ?? '이름 없는 선수';
  const positionField = profile
    ? positionHeaderField(profile.primaryPosition, profile.preferredPosition)
    : { label: '포지션', value: draft.position ? POSITION_LABELS[draft.position] : '—' };
  const hasContract = state.contract !== null;
  const season = state.season;
  const room = deriveTacticalRoom(state, activeRuleset);
  const seasonChronicleItems = buildSeasonChronicleItems(state);
  const pastSeasonLinks = buildPastSeasonLinks(state);

  return (
    <div className="flex flex-col gap-os-6">
      <PlayerHeader
        name={name}
        team={currentTeamName(state, activeRuleset)}
        position={positionField}
        archetype={{ label: '아키타입', value: archetypeName(activeRuleset, profile?.archetypeId ?? draft.archetypeId) }}
        shirtNumber={{ label: '등번호', value: state.contract ? String(state.contract.shirtNumber) : '—' }}
      />

      <StatusStrip items={hasContract ? proStatusStripItems(state) : u18StatusStripItems(state)} />

      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        {season !== null
          ? `${state.age}세 · 시즌 ${season.index} · ${SEASON_PHASE_LABEL_KO[state.seasonPhase]} · step ${state.currentStep}/12`
          : `${state.age}세 · ${SEASON_PHASE_LABEL_KO[state.seasonPhase]} · step ${state.currentStep}`}
      </p>

      <NextDecisionCard careerId={careerId} state={state} />

      <Tabs defaultValue="schedule">
        <TabsList aria-label="대시보드 구역">
          <TabsTrigger value="schedule">일정표</TabsTrigger>
          <TabsTrigger value="locker">라커룸</TabsTrigger>
          <TabsTrigger value="tactics">전술실</TabsTrigger>
          <TabsTrigger value="phone">휴대폰</TabsTrigger>
          <TabsTrigger value="diary">다이어리</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <DashboardSection title="일정표" description="현재 진행 상황과 다음 결정을 확인합니다.">
            {season === null ? (
              <>
                <p className="font-os text-os-text" style={BODY_STYLE}>
                  step {state.currentStep} · {SEASON_PHASE_LABEL_KO[state.seasonPhase]}
                </p>
                <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                  {state.pending === null ? '다음 결정은 진행 후 열립니다.' : '위 카드에서 결정을 확인하세요.'}
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-os-4">
                <SeasonTimeline steps={season.steps} currentStep={season.currentStep} />
                {hasContract && state.contract ? (
                  <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                    시즌 목표: {ROLE_PROMISE_SENTENCE[state.contract.rolePromise]}
                  </p>
                ) : null}
                <div className="flex flex-col gap-os-1">
                  {season.competitions.map((record) => (
                    <p key={record.competitionId} className="os-num font-os text-os-text-2" style={CAPTION_STYLE}>
                      {competitionSummaryLine(record, season, activeRuleset)}
                    </p>
                  ))}
                </div>
                <div className="flex flex-col gap-os-1 overflow-x-auto">
                  {buildScheduleRows(season, activeRuleset).map((row) => (
                    <div key={`${row.step}-${row.order}`} className="flex items-center justify-between gap-os-2 rounded-os-s px-os-2 py-os-1 font-os text-os-text-2" style={CAPTION_STYLE}>
                      <span>
                        step {row.step} · {row.competitionLabel} · {row.home ? '홈' : '원정'} · {row.opponentName}
                      </span>
                      <span className="os-num">
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

        <TabsContent value="locker">
          <DashboardSection title="라커룸" description="감독·주장·경쟁자·동료 관계의 최근 기억입니다.">
            {state.tags.length === 0 ? (
              <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                아직 기억 태그가 없습니다.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-os-1">
                {state.tags.map((tag) => (
                  <li key={tag} className="rounded-os-s bg-os-surface-2 px-os-2 py-os-1 font-os text-os-text-2" style={CAPTION_STYLE}>
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        </TabsContent>

        <TabsContent value="tactics">
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
                      {POSITION_LABELS[room.playerPosition]} · {SQUAD_ROLE_LABELS[room.playerRole]}
                    </p>
                    <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2 sm:grid-cols-4" style={CAPTION_STYLE}>
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
                        <dd className="os-num text-os-text">{familiarityPercentLabel(room.familiarity)}</dd>
                      </div>
                    </dl>
                    <SelectionRankingList ranking={room.ranking} />
                  </>
                )}
                <div className="flex gap-os-4">
                  <Link to="/career/$careerId/attributes" params={{ careerId }} className="font-os text-os-text-2 underline" style={CAPTION_STYLE}>
                    능력치 상세
                  </Link>
                  {state.pending !== null && state.pending.kind === 'ROLE_PROPOSAL' ? (
                    <Link to="/career/$careerId/role" params={{ careerId }} className="font-os text-os-text-2 underline" style={CAPTION_STYLE}>
                      감독 제안 보기
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </DashboardSection>
        </TabsContent>

        <TabsContent value="phone">
          <DashboardSection title="휴대폰" description="계약 상태를 확인합니다." locked={!hasContract} lockReason="첫 프로 계약 후 열림">
            {hasContract && state.contract ? (
              <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
                {buildCurrentContractSummary(state).map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd className="text-os-text">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </DashboardSection>
        </TabsContent>

        <TabsContent value="diary">
          <DashboardSection title="다이어리" description="이번 커리어의 연대기입니다.">
            <div className="flex flex-col gap-os-4">
              {seasonChronicleItems.length > 0 ? (
                <div className="flex flex-col gap-os-2">
                  <h3 className="font-os font-semibold text-os-text" style={BODY_STYLE}>
                    이번 시즌
                  </h3>
                  <ol className="flex flex-col gap-os-1">
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
                        <li key={item.id} className="font-os text-os-text-2" style={CAPTION_STYLE}>
                          {item.sentence}
                        </li>
                      ),
                    )}
                  </ol>
                </div>
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
                          시즌 {link.seasonNumber} 결산 보기
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <CareerTimeline items={buildTimelineItems(state)} emptyMessage="아직 기록이 없습니다" />
            </div>
          </DashboardSection>
        </TabsContent>
      </Tabs>

      <div className="flex gap-os-4">
        <Link to="/" className={buttonClassName('secondary')} style={buttonStyle}>
          허브로
        </Link>
        <Link to="/settings" className="font-os text-os-text-2" style={CAPTION_STYLE}>
          설정
        </Link>
      </div>

      {showSignedToast ? <Toast variant="success" message="계약을 맺었습니다" onDismiss={() => setShowSignedToast(false)} /> : null}
    </div>
  );
}
