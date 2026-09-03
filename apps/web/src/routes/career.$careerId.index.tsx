// SCR-029 커리어 대시보드. 다섯 구역 탭 + "다음 결정" 카드. 대시보드에서는 어떤 명령도 확정하지
// 않는다 — advance/settleSeason은 결정이 아니라 "진행"이며(다음에 뭐가 뜰지는 도메인이 정한다),
// 결정 확정은 전용 화면(SCR-007·008·009·010·012·013·014)에서만 일어난다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { deriveTacticalRoom, type CareerState, type CompetitionRecord, type FootballSeason, type Ruleset, type TimelineEntry } from '@offside/domain';
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
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { useEngine } from '../engine/use-engine.js';
import { screenForCareer } from '../shared/career-route.js';
import { archetypeName, currentTeamName } from '../shared/current-team.js';
import {
  CUP_ROUND_LABEL_KO,
  LEAGUE_TIER_LABEL_KO,
  positionHeaderField,
  POSITION_LABELS,
  ROLE_PROMISE_SENTENCE,
  SEASON_PHASE_LABEL_KO,
  SQUAD_ROLE_LABELS,
  TIMELINE_KIND_LABEL_KO,
} from '../shared/labels.js';
import { markStatsRevealed, readRevealedStats } from '../shared/revealed-stats.js';
import { proStatusStripItems, u18StatusStripItems } from '../shared/status-strip.js';
import { formatKrw } from '../shared/format.js';
import { platform } from '../platform/index.js';
import { SCREEN_ROUTES } from '../routes.js';
import { SeasonTimeline } from '../shared/season-timeline.js';
import { buildScheduleRows } from '../shared/season-schedule.js';
import { familiarityPercentLabel, SelectionRankingList } from '../shared/tactical-room.js';

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
      return choice === undefined || outcome === undefined ? '이벤트' : `${choice.label} → ${outcome.title}`;
    }
    // T-2-002 D-34: exhaustive switch가 typecheck에서 깨져 최소 수정(PR 본문 참고). 화면 전용
    // 문구는 T-2-007(전술실)이 다듬는다.
    case 'ROLE_RESOLVED':
      return '역할 결정';
  }
}

function buildTimelineItems(state: CareerState): CareerTimelineItem[] {
  return [...state.timeline].reverse().map((entry) => ({
    id: `${entry.kind}-${entry.revision}`,
    age: entry.age,
    stage: TIMELINE_KIND_LABEL_KO[entry.kind],
    title: timelineSentence(entry, state),
  }));
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
  const roundText = record.cupRound === null ? '—' : (CUP_ROUND_LABEL_KO[record.cupRound as keyof typeof CUP_ROUND_LABEL_KO] ?? record.cupRound);
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
        const target = screenForCareer(result.domainSnapshot.state);
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
    try {
      const result = await settleSeasonMutation.mutateAsync({ careerId });
      if (!result.ok) {
        setErrorMessage('시즌을 결산하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      void navigate({ to: SCREEN_ROUTES['SCR-015'], params: { careerId } });
    } catch {
      setErrorMessage('시즌을 결산하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
    }
  };

  if (pending !== null && pending.kind === 'EVENT') {
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

  if (pending !== null && pending.kind === 'CHAPTER' && 'chapterId' in pending) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          핵심 경기
        </p>
        <Link to="/career/$careerId/chapter" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
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
                <div>
                  <dt>팀</dt>
                  <dd className="text-os-text">{state.contract.teamName}</dd>
                </div>
                <div>
                  <dt>리그</dt>
                  <dd className="text-os-text">{LEAGUE_TIER_LABEL_KO[state.contract.leagueTier]}</dd>
                </div>
                <div>
                  <dt>기간</dt>
                  <dd className="os-num text-os-text">{state.contract.lengthSeasons}시즌</dd>
                </div>
                <div>
                  <dt>주급</dt>
                  <dd className="os-num text-os-text">{formatKrw(state.contract.wageMinorPerWeek)}</dd>
                </div>
              </dl>
            ) : null}
          </DashboardSection>
        </TabsContent>

        <TabsContent value="diary">
          <DashboardSection title="다이어리" description="이번 커리어의 연대기입니다.">
            <CareerTimeline items={buildTimelineItems(state)} emptyMessage="아직 기록이 없습니다" />
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
