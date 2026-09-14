// SCR-015 프로 시즌 결과(+SCR-006 유소년 변형): SETTLE_SEASON 뒤 seasonHistory[].result를 결산으로
// 보여준다. `season` 없으면 마지막 결산. 결과가 없으면(예: 결산 전 재진입) 대시보드로 — 결산은
// 대시보드 "시즌 결산" CTA가 확정하고 이 화면은 아무것도 확정하지 않는다.
import { useEffect } from 'react';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import type { CareerState, Ruleset } from '@offside/domain';
import {
  ScreenIntro,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  buttonClassName,
  buttonStyle,
} from '@offside/ui';
import { contentForCareer, rulesetForCareer } from '../engine/content.js';
import { careerQueryOptions, useCareer } from '../engine/use-career.js';
import { useServiceSeason } from '../engine/service-season.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { screenForCareer } from '../shared/career-route.js';
import { currentTeamId, currentTeamName } from '../shared/current-team.js';
import { canPlanNextSeason } from '../shared/start-season.js';
import { platform } from '../platform/index.js';
import { CountUp } from '../shared/countup.js';
import { PlayerBanner } from '../shared/PlayerBanner.js';
import { seasonResultHeadline } from '../shared/result-narrative.js';
import { SeasonCompareSection } from '../shared/season-compare.js';
import {
  deriveSeasonResultView,
  type PositionCardView,
  type SeasonResultView,
} from '../shared/season-result-view.js';
import { ratingText } from '../shared/season-schedule.js';
import { ATTRIBUTE_CHANGE_CAUSE_LABEL_KO } from '../shared/season-result.js';
import { careerStartYear, extractCalendarStartYear, seasonYearLabel } from '../shared/season-year.js';
import { ATTRIBUTE_GROUP_LABEL_KO } from '../shared/attribute-groups.js';
import {
  ATTRIBUTE_LABELS,
  POSITION_STAT_LABEL_KO,
  positionHeaderField,
  ROLE_DECISION_LABEL_KO,
  ROLE_PROPOSAL_TYPE_LABEL_KO,
  SQUAD_ROLE_LABELS,
  chapterTriggerLabel,
} from '../shared/labels.js';
import { ClubBadge } from '../shared/ClubBadge.js';
import { resolveTeamName, type TeamNameOverrides } from '../shared/team-names.js';
import { useUiStore } from '../shared/ui-store.js';
import { GameResultReveal } from '../shared/game-presentation.js';
import { LeagueStandingsTable } from '../shared/league-standings.js';

type SeasonResultSearch = { season?: number };

function parseSeason(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function chapterTitle(state: { contentPackVersion: string }, chapterId: string): string {
  const chapter = contentForCareer(state).chaptersById.get(chapterId);
  if (chapter === undefined) return '핵심 경기';
  // 챕터 화면도 이 trigger label을 제목으로 사용한다. 챕터 정의에는 별도 title 필드가 없다.
  return chapterTriggerLabel(chapter.trigger);
}

export const Route = createFileRoute('/career/$careerId/season-result')({
  validateSearch: (search: Record<string, unknown>): SeasonResultSearch => {
    const season = parseSeason(search.season);
    return season === undefined ? {} : { season };
  },
  loaderDeps: ({ search }) => ({ season: search.season }),
  loader: async ({ params, deps }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const index = deps.season ?? state.seasonHistory.length - 1;
    const view = deriveSeasonResultView(state, index, rulesetForCareer(state));
    if (view === null) {
      throw redirect({ to: SCREEN_ROUTES['SCR-029'], params: { careerId: params.careerId } });
    }
  },
  component: SeasonResultScreen,
});

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const H3_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

/** SCR-015 인수 조건: 포지션에 무관한 지표는 숨긴다 — `PositionCardView` 판별 유니온이 group마다
 * 다른 필드만 갖고 있어, 여기서 다른 그룹 필드를 참조하면 typecheck가 막는다. */
function positionStatEntries(
  card: PositionCardView,
): Array<{ id: string; label: string; value: string }> {
  switch (card.group) {
    case 'FW':
      return [
        { id: 'goals', label: POSITION_STAT_LABEL_KO.goals, value: String(card.goals) },
        { id: 'assists', label: POSITION_STAT_LABEL_KO.assists, value: String(card.assists) },
        { id: 'xg', label: POSITION_STAT_LABEL_KO.xgCenti, value: (card.xgCenti / 100).toFixed(2) },
        { id: 'shots', label: POSITION_STAT_LABEL_KO.shots, value: String(card.shots) },
        { id: 'offsides', label: POSITION_STAT_LABEL_KO.offsides, value: String(card.offsides) },
      ];
    case 'MF':
      return [
        { id: 'assists', label: POSITION_STAT_LABEL_KO.assists, value: String(card.assists) },
        {
          id: 'chancesCreated',
          label: POSITION_STAT_LABEL_KO.chancesCreated,
          value: String(card.chancesCreated),
        },
        {
          id: 'progressivePasses',
          label: POSITION_STAT_LABEL_KO.progressivePasses,
          value: String(card.progressivePasses),
        },
        {
          id: 'passSuccessRate',
          label: POSITION_STAT_LABEL_KO.passSuccessRate,
          value: card.passSuccessRatePercent === null ? '—' : `${card.passSuccessRatePercent}%`,
        },
        {
          id: 'ballRecoveries',
          label: POSITION_STAT_LABEL_KO.ballRecoveries,
          value: String(card.ballRecoveries),
        },
      ];
    case 'DF':
      return [
        { id: 'tackles', label: POSITION_STAT_LABEL_KO.tackles, value: String(card.tackles) },
        {
          id: 'interceptions',
          label: POSITION_STAT_LABEL_KO.interceptions,
          value: String(card.interceptions),
        },
        {
          id: 'aerialsWon',
          label: POSITION_STAT_LABEL_KO.aerialsWon,
          value: String(card.aerialsWon),
        },
        {
          id: 'goalsConcededInvolved',
          label: POSITION_STAT_LABEL_KO.goalsConcededInvolved,
          value: String(card.goalsConcededInvolved),
        },
        {
          id: 'cleanSheet',
          label: POSITION_STAT_LABEL_KO.cleanSheet,
          value: String(card.cleanSheet),
        },
      ];
    case 'GK':
      return [
        { id: 'saves', label: POSITION_STAT_LABEL_KO.saves, value: String(card.saves) },
        {
          id: 'psxg',
          label: POSITION_STAT_LABEL_KO.psxgMinusGoalsCenti,
          value: (card.psxgMinusGoalsCenti / 100).toFixed(2),
        },
        {
          id: 'cleanSheet',
          label: POSITION_STAT_LABEL_KO.cleanSheet,
          value: String(card.cleanSheet),
        },
        {
          id: 'crossesClaimed',
          label: POSITION_STAT_LABEL_KO.crossesClaimed,
          value: String(card.crossesClaimed),
        },
        {
          id: 'buildUpPasses',
          label: POSITION_STAT_LABEL_KO.buildUpPasses,
          value: String(card.buildUpPasses),
        },
      ];
  }
}

type StateDeltaRow = {
  id: string;
  label: string;
  before: number;
  after: number;
  boundaryReset: boolean;
};

function buildStateDeltaRows(view: SeasonResultView, ruleset: Parameters<typeof deriveSeasonResultView>[2]): StateDeltaRow[] {
  const reset = ruleset.seasonBoundaryReset;
  return [
    {
      id: 'form',
      label: '폼',
      before: view.stateDeltas.form.before,
      after: view.stateDeltas.form.after,
      boundaryReset: view.stateDeltas.form.after === reset.form,
    },
    {
      id: 'fitness',
      label: '체력',
      before: view.stateDeltas.fitness.before,
      after: view.stateDeltas.fitness.after,
      boundaryReset: view.stateDeltas.fitness.after === reset.fitness,
    },
    {
      id: 'morale',
      label: '사기',
      before: view.stateDeltas.morale.before,
      after: view.stateDeltas.morale.after,
      boundaryReset: view.stateDeltas.morale.after === reset.morale,
    },
    {
      id: 'managerTrust',
      label: '감독 신뢰',
      before: view.stateDeltas.managerTrust.before,
      after: view.stateDeltas.managerTrust.after,
      boundaryReset: false,
    },
  ];
}

function trackCountupSkipped(field: string): void {
  platform.analytics.track('countup_skipped', { field });
}

export type SeasonClubDisplay = {
  /** TeamBadge용 팀 id — 임대 시즌이면 임대팀 id(배지는 팀 id 기준, 이름 오버라이드 무관). */
  teamId: string;
  /** 표시 문자열. 임대 시즌이면 "임대 · <임대팀> (원소속 <원소속팀>)". */
  label: string;
  loan: boolean;
};

/**
 * 이슈 171: 이 시즌에 실제로 뛴 팀의 표기 규칙. 임대 시즌이면 상단 배너와 요약이 같은 문자열을
 * 쓴다. 임대 여부는 `state.clubHistory`의 LOAN stint가 `seasonNumber`(1부터, SeasonSummary.index)를
 * 덮는지로 판단하고, 원소속은 그 직전 stint(endReason 'LOANED')·없으면 `state.parentContract`에서
 * 읽는다. 팀 이름은 team-names.ts 리졸버(구단 이름 오버라이드 포함)를 거친다.
 */
export function seasonClubDisplay(
  state: Pick<CareerState, 'clubHistory' | 'parentContract'>,
  ruleset: Ruleset,
  seasonNumber: number,
  seasonTeamId: string,
  overrides: TeamNameOverrides,
): SeasonClubDisplay {
  const teamName = (teamId: string) => resolveTeamName(ruleset, teamId, overrides) ?? '무소속';
  const loanIndex = state.clubHistory.findIndex(
    (stint) =>
      stint.kind === 'LOAN' &&
      stint.teamId === seasonTeamId &&
      stint.fromSeasonIndex <= seasonNumber &&
      (stint.toSeasonIndex === null || seasonNumber <= stint.toSeasonIndex),
  );
  if (loanIndex < 0) return { teamId: seasonTeamId, label: teamName(seasonTeamId), loan: false };

  const previous = loanIndex > 0 ? state.clubHistory[loanIndex - 1] : undefined;
  const parentTeamId =
    previous !== undefined && previous.endReason === 'LOANED'
      ? previous.teamId
      : (state.parentContract?.teamId ?? null);
  const loanLabel = `임대 · ${teamName(seasonTeamId)}`;
  return {
    teamId: seasonTeamId,
    label: parentTeamId === null ? loanLabel : `${loanLabel} (원소속 ${teamName(parentTeamId)})`,
    loan: true,
  };
}

function SeasonResultScreen() {
  const { careerId } = Route.useParams();
  const { season } = Route.useSearch();
  const query = useCareer(careerId);
  const serviceSeasonQuery = useServiceSeason();
  const teamNameOverrides = useUiStore((uiState) => uiState.teamNameOverrides);

  useEffect(() => {
    if (query.data === undefined) return;
    const index = season ?? query.data.state.seasonHistory.length - 1;
    const initialView = deriveSeasonResultView(query.data.state, index, rulesetForCareer(query.data.state));
    platform.analytics.track('screen_viewed', {
      screenId: initialView?.isYouth === true ? 'SCR-006' : 'SCR-015',
      careerPhase: query.data.state.seasonPhase,
    });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.data === undefined) return null;
  const { state } = query.data;
  const ruleset = rulesetForCareer(state);
  const index = season ?? state.seasonHistory.length - 1;
  const view = deriveSeasonResultView(state, index, ruleset);
  if (view === null) return null; // 라우트 loader가 보장한다. 방어적 fallback.
  // 사용자 결정(2026-09-13): 1시즌 = 1년, 커리어 시작 연도부터 "2026 시즌"으로 표기(season-year.ts).
  const startYear = careerStartYear({
    seasonServiceSeasonId: state.season?.serviceSeasonId ?? null,
    currentServiceSeason: serviceSeasonQuery.data,
    calendarStartYear: extractCalendarStartYear(ruleset.leagueCalendar),
  });
  const profile = state.player.profile;
  if (profile === null) return null; // deriveSeasonResultView가 이미 profile 확정을 요구한다. 방어적 fallback.

  const { common, positionCard, promise, selection } = view;
  // T-7-005 SCR-014: 계약 역할 약속의 실제 이행 비율(promise.minutesShareBp)로 표시한다 — 선발
  // 등급(selection)과는 다른 출처라 season-compare.tsx의 actualPercent와 같은 계산을 쓴다.
  const actualMinutesSharePercent = Math.round(promise.minutesShareBp / 100);
  const stateDeltaRows = buildStateDeltaRows(view, ruleset);
  const nextTarget = canPlanNextSeason(state) ? 'SCR-005' : screenForCareer(state).screenId;
  const headlineTeamResult = view.teamRecords[0];

  // UX-010 P2c: 이번 시즌 실제 소속팀 표기(ClubBadge, 요구사항 5) — view.teamId는 이 시즌에 뛴 팀이라
  // 이후 이적이 있어도 바뀌지 않는다(현재 소속과 다를 수 있다). 이슈 171: 임대 시즌이면 상단
  // PlayerBanner도 같은 표기 규칙("임대 · 임대팀 (원소속 …)")을 쓴다 — 비임대 시즌의 배너는 기존대로
  // 현재 소속.
  const seasonClub = seasonClubDisplay(state, ruleset, view.seasonNumber, view.teamId, teamNameOverrides);
  const seasonTeamName = seasonClub.label;
  const bannerTeamName = seasonClub.loan ? seasonClub.label : currentTeamName(state, ruleset, teamNameOverrides);
  const bannerTeamId = seasonClub.loan ? seasonClub.teamId : currentTeamId(state, ruleset);

  // UX-010 P2c: 리그 순위로 승격·강등권 여부를 가려 헤드라인 분기에 쓴다. 컵만 뛴 시즌·순위 미확정은
  // 둘 다 false(평균 평점만으로 분기).
  const leagueRecord = view.result.competitions.find((competition) => competition.kind === 'LEAGUE') ?? null;
  const league = leagueRecord === null ? undefined : ruleset.leagues.find((candidate) => candidate.id === (view.result.finalLeagueTable?.leagueId ?? leagueRecord.competitionId));
  const promoted =
    leagueRecord !== null &&
    leagueRecord.position !== null &&
    league !== undefined &&
    league.promotionSpots > 0 &&
    leagueRecord.position <= league.promotionSpots;
  const relegated =
    leagueRecord !== null &&
    leagueRecord.position !== null &&
    league !== undefined &&
    league.relegationSpots > 0 &&
    leagueRecord.position > league.teamCount - league.relegationSpots;
  const headline = seasonResultHeadline({
    seed: `${state.careerId}:${view.historyIndex}`,
    promoted,
    relegated,
    avgRatingTenths: common.avgRatingTenths,
  });

  return (
    <div className="os-screen" data-testid="season-result" data-result-hash={view.hash}>
      <ScreenIntro
        eyebrow="SEASON REVIEW"
        title={view.isYouth ? '유소년 시즌 결과' : '프로 시즌 결과'}
        description={seasonYearLabel(startYear, view.seasonNumber)}
      />

      <PlayerBanner
        name={profile.name}
        teamName={bannerTeamName}
        teamId={bannerTeamId}
        position={positionHeaderField(profile.primaryPosition, profile.preferredPosition).value}
        shirtNumber={state.contract ? String(state.contract.shirtNumber) : '—'}
        age={state.age}
        ovr={profile.baseOvr}
      />
      {view.result.clubMeetingGoal ? (
        <section className="os-panel flex flex-col gap-os-2" aria-label="구단 면담 목표 결과">
          <p className="os-eyebrow">구단 면담 목표</p>
          <p className="font-os font-semibold text-os-text">{view.result.clubMeetingGoal.status === 'MET' ? '목표 달성' : '기준 미달 · 추가 불이익 없음'}</p>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>시즌 출전 확인 기준 {view.result.clubMeetingGoal.targetMinutesShareBp / 100}% · 실제 {view.result.clubMeetingGoal.actualMinutesShareBp / 100}%</p>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>적용 효과: 감독 신뢰 {view.result.clubMeetingGoal.effect.managerTrustDelta >= 0 ? '+' : ''}{view.result.clubMeetingGoal.effect.managerTrustDelta} · 사기 {view.result.clubMeetingGoal.effect.moraleDelta >= 0 ? '+' : ''}{view.result.clubMeetingGoal.effect.moraleDelta}</p>
        </section>
      ) : null}

      <GameResultReveal
        fast={state.simulationMode === 'FAST'}
        announcement={`${seasonYearLabel(startYear, view.seasonNumber)} 결과, 평균 평점 ${ratingText(common.avgRatingTenths)}`}
        skippable={false}
      >
        <section className="os-story-card flex flex-col gap-os-3" aria-label="시즌 한눈에 보기">
          <p className="os-eyebrow">{seasonYearLabel(startYear, view.seasonNumber)} · 최종 기록</p>
          <p className="font-os font-bold text-os-text" style={H2_STYLE}>{headline}</p>
          {/* T-7-010 이슈 144·D-68: 승격권은 순위 기록일 뿐 리그 이동은 이번 버전에 없다 — 화면 문구가
              리그가 바뀐 것처럼 읽히지 않도록 캡션을 남긴다. 라우트 전용 상수라 labels.ts로 옮기지 않는다. */}
          {promoted ? (
            <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
              승격권은 리그 순위 기록입니다. 이번 버전에서는 소속 리그가 바뀌지 않습니다.
            </p>
          ) : null}
          <div className="flex items-center gap-os-2">
            <ClubBadge teamId={seasonClub.teamId} size="s" />
            <span className="font-os text-os-text-2" style={BODY_STYLE}>{seasonTeamName}</span>
          </div>
          <p className="font-os text-os-text" style={BODY_STYLE}>
            {common.total}경기 · {common.minutes}분 · 평균 평점 {ratingText(common.avgRatingTenths)}
          </p>
          <p className="font-os text-os-text-2" style={BODY_STYLE}>
            {headlineTeamResult
              ? `${headlineTeamResult.label} ${headlineTeamResult.standingText}`
              : `${SQUAD_ROLE_LABELS[selection.roleAtStart]}에서 ${SQUAD_ROLE_LABELS[selection.roleAtEnd]}로 시즌을 마쳤습니다.`}
          </p>
          {view.baseOvr.before !== view.baseOvr.after ? (
            <p className="flex flex-wrap items-baseline gap-os-2 font-os font-bold text-os-accent" style={H2_STYLE}>
              <span className="os-num">{view.baseOvr.before}</span>
              <span aria-hidden="true">→</span>
              <span className="os-num">{view.baseOvr.after}</span>
              <span className="font-os text-os-text-2" style={CAPTION_STYLE}>Base OVR 변화</span>
            </p>
          ) : null}
        </section>
      </GameResultReveal>

      <details className="os-season-breakdown">
        <summary>시즌 상세 기록 보기</summary>
        <div className="mt-os-3 flex flex-col gap-os-3">
          <section className="os-panel flex flex-col gap-os-4">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          공통 지표
        </h2>
        <dl className="grid grid-cols-2 gap-os-2 [&>div]:min-w-0 [&>div]:rounded-os-m [&>div]:bg-os-surface-2 [&>div]:p-os-3 [&_dd]:mt-os-1 [&_dd]:font-semibold">
          <div>
            <dt className="font-os text-os-text-2" style={CAPTION_STYLE}>
              출전
            </dt>
            <dd
              className="os-num text-os-accent [&>span]:flex-wrap"
              style={{ fontSize: 'var(--os-fs-num-lg)', lineHeight: 'var(--os-lh-num-lg)' }}
            >
              <CountUp
                value={common.total}
                label="출전"
                onSkip={() => trackCountupSkipped('appearances')}
              />
            </dd>
          </div>
          <div>
            <dt className="font-os text-os-text-2" style={CAPTION_STYLE}>
              출전 시간(분)
            </dt>
            <dd
              className="os-num text-os-accent [&>span]:flex-wrap"
              style={{ fontSize: 'var(--os-fs-num-lg)', lineHeight: 'var(--os-lh-num-lg)' }}
            >
              <CountUp
                value={common.minutes}
                label="출전 시간"
                onSkip={() => trackCountupSkipped('minutes')}
              />
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="font-os text-os-text-2" style={CAPTION_STYLE}>
              평균 평점
            </dt>
            <dd
              className="os-num text-os-accent [&>span]:flex-wrap"
              style={{ fontSize: 'var(--os-fs-num-lg)', lineHeight: 'var(--os-lh-num-lg)' }}
            >
              <CountUp
                value={common.avgRatingTenths}
                label="평균 평점"
                format={(value) => ratingText(Math.round(value))}
                onSkip={() => trackCountupSkipped('avgRating')}
              />
            </dd>
          </div>
        </dl>
        <dl className="grid grid-cols-2 gap-x-os-4 gap-y-os-2">
          {[
            { label: '선발', value: common.started },
            { label: '교체', value: common.sub },
            { label: '0분', value: common.zeroMinute },
            { label: '결장', value: common.out },
            { label: '경고', value: common.yellow },
            { label: '퇴장', value: common.red },
            { label: '부상', value: common.injuries },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-os-2 border-b border-os-border py-os-2"
            >
              <dt className="font-os text-os-text-2" style={CAPTION_STYLE}>
                {item.label}
              </dt>
              <dd className="os-num font-os font-semibold text-os-text" style={BODY_STYLE}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
          </section>

      {view.isYouth ? (
        <p
          className="rounded-os-m bg-os-surface-2 px-os-4 py-os-3 font-os text-os-text-2"
          style={CAPTION_STYLE}
        >
          정찰 범위 {view.scoutedPotentialMin}~{view.scoutedPotentialMax}
        </p>
      ) : null}

      <section className="os-panel flex flex-col gap-os-4">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          포지션 통계
        </h2>
        <dl className="grid grid-cols-2 gap-os-2 [&>div]:rounded-os-m [&>div]:bg-os-surface-2 [&>div]:p-os-3 [&_dd]:mt-os-1 [&_dd]:font-semibold">
          {positionStatEntries(positionCard).map((entry) => (
            <div key={entry.id}>
              <dt className="font-os text-os-text-2" style={CAPTION_STYLE}>
                {entry.label}
              </dt>
              <dd className="os-num font-os text-os-text" style={BODY_STYLE}>
                {entry.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {!view.isYouth && view.teamRecords.length > 0 ? (
        <section className="os-panel flex flex-col gap-os-4">
          <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
            팀 성적
          </h2>
          <Tabs defaultValue={view.teamRecords[0]!.competitionId}>
            <TabsList aria-label="대회별 상세">
              {view.teamRecords.map((record) => (
                <TabsTrigger key={record.competitionId} value={record.competitionId}>
                  {record.kind === 'LEAGUE' ? '리그' : '컵'}
                </TabsTrigger>
              ))}
            </TabsList>
            {view.teamRecords.map((record) => (
              <TabsContent key={record.competitionId} value={record.competitionId}>
                <p className="font-os text-os-text" style={BODY_STYLE}>
                  {record.label} · {record.standingText}
                </p>
                <p className="os-num font-os text-os-text-2" style={CAPTION_STYLE}>
                  {record.won}승 {record.drawn}무 {record.lost}패 · 득실 {record.goalsFor}:
                  {record.goalsAgainst}
                </p>
              </TabsContent>
            ))}
          </Tabs>
        </section>
      ) : null}

      {view.result.finalLeagueTable === undefined || league === undefined ? (
        <section className="os-panel flex flex-col gap-os-2" aria-label="전체 리그 순위 기록 지원 상태">
          <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>전체 리그 순위</h2>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            룰셋 {state.rulesetVersion}의 이 시즌에는 전체 리그 순위 기록이 없습니다.
          </p>
        </section>
      ) : (
        <section className="os-panel">
          <LeagueStandingsTable
            rows={view.result.finalLeagueTable.rows}
            teamId={view.result.finalLeagueTable.teamId}
            leagueName={view.result.finalLeagueTable.leagueName}
            completedRounds={view.result.finalLeagueTable.completedRounds}
            ruleset={ruleset}
            teamNameOverrides={teamNameOverrides}
            promotionSpots={league.promotionSpots}
            relegationSpots={league.relegationSpots}
            final
          />
        </section>
      )}

      <section className="os-panel flex flex-col gap-os-3">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          역할과 출전 약속
        </h2>
        <dl className="flex flex-col gap-os-2 font-os text-os-text" style={BODY_STYLE}>
          <div>
            <dt className="text-os-text-2" style={CAPTION_STYLE}>
              선발 등급 (시즌 시작 → 종료)
            </dt>
            <dd>
              {SQUAD_ROLE_LABELS[selection.roleAtStart]} → {SQUAD_ROLE_LABELS[selection.roleAtEnd]} (경쟁 순위{' '}
              {selection.finalRank}위)
            </dd>
          </div>
          <div>
            <dt className="text-os-text-2" style={CAPTION_STYLE}>
              계약 역할 약속
            </dt>
            <dd>{SQUAD_ROLE_LABELS[promise.promised]}</dd>
          </div>
          <div>
            <dt className="text-os-text-2" style={CAPTION_STYLE}>
              실제 출전 등급
            </dt>
            <dd>
              {SQUAD_ROLE_LABELS[promise.delivered]} (출전 시간 {actualMinutesSharePercent}%)
            </dd>
          </div>
          <div>
            <dt className="text-os-text-2" style={CAPTION_STYLE}>
              약속 이행
            </dt>
            <dd>
              {promise.fulfilled ? '이행' : '미이행'}
              {!promise.fulfilled &&
              typeof view.promiseBreachTrustRuleDelta === 'number' &&
              view.promiseBreachTrustRuleDelta !== 0 ? (
                <>
                  {' '}
                  · 감독 신뢰 기본 조정 {view.promiseBreachTrustRuleDelta >= 0 ? '+' : ''}
                  {view.promiseBreachTrustRuleDelta}점. 전체 시즌 변화에 포함되며, 신뢰 하한에 따라 실제 감소 폭은
                  달라질 수 있습니다.
                </>
              ) : null}
            </dd>
          </div>
        </dl>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          선발 등급은 매 경기 경쟁 순위로 정해지고, 계약 역할 약속은 계약서의 역할입니다. 둘은 다를 수 있습니다.
        </p>
      </section>

      {view.roleChanges.length > 0 ? (
        <section className="os-panel flex flex-col gap-os-3">
          <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
            역할 변화
          </h2>
          <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={CAPTION_STYLE}>
            {view.roleChanges.map((change, changeIndex) => (
              <li key={`${change.step}-${change.type}-${changeIndex}`}>
                step {change.step} · {ROLE_PROPOSAL_TYPE_LABEL_KO[change.type]} ·{' '}
                {ROLE_DECISION_LABEL_KO[change.decision]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.chapters.length > 0 ? (
        <section className="os-panel flex flex-col gap-os-3">
          <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
            핵심 경기 챕터
          </h2>
          <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={CAPTION_STYLE}>
            {view.chapters.map((chapter) => (
              <li key={chapter.chapterId}>
                {chapterTitle(state, chapter.chapterId)} · 판단 {chapter.decisions.length}건
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="os-panel flex flex-col gap-os-4">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          {view.isYouth ? '성장 기록' : 'OVR 변화'}
        </h2>
        {view.attributeDeltaGroups.some((group) => group.entries.some((entry) => entry.causes.some((cause) => cause.cause === 'AGE_DECLINE' && cause.centi < 0))) ? <aside className="rounded-os-m bg-os-surface-2 p-os-4"><h3 className="font-semibold">몸의 변화, 다음 시즌의 선택</h3><p>연령에 따른 하락이 기록됐어요. 아래 포지션별 능력 추세를 살펴보고 다음 시즌의 훈련 초점과 역할을 선택해 보세요. OVR 하락만으로 은퇴가 결정되지는 않습니다.</p></aside> : null}
        {view.topCause !== null ? (
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            가장 큰 원인: {ATTRIBUTE_CHANGE_CAUSE_LABEL_KO[view.topCause]}
          </p>
        ) : null}
        <p
          className="flex flex-wrap items-baseline gap-os-2 rounded-os-m bg-os-surface-2 p-os-4 font-os font-semibold text-os-text"
          style={BODY_STYLE}
        >
          Base OVR
          <CountUp value={view.baseOvr.before} label="결산 전 Base OVR" />
          →
          <CountUp
            value={view.baseOvr.after}
            label="결산 후 Base OVR"
            onSkip={() => trackCountupSkipped('baseOvr')}
          />
        </p>
        {view.attributeDeltaGroups.map((group) => (
          <div key={group.id} className="flex flex-col gap-os-2 border-t border-os-border pt-os-3">
            <h3 className="font-os font-semibold text-os-text" style={H3_STYLE}>
              {ATTRIBUTE_GROUP_LABEL_KO[group.id]}
            </h3>
            <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={CAPTION_STYLE}>
              {group.entries.map((entry) => (
                <li key={entry.key}>
                  {ATTRIBUTE_LABELS[entry.key]} {entry.delta >= 0 ? '+' : ''}
                  {entry.delta}
                  {entry.causes.length > 0
                    ? ` (${entry.causes.map((cause) => `${ATTRIBUTE_CHANGE_CAUSE_LABEL_KO[cause.cause]} ${(cause.centi / 100).toFixed(1)}`).join(' · ')})`
                    : ''}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        능력은 결산 때만, 예상치는 경기마다 움직입니다
      </p>

      <section className="os-panel flex flex-col gap-os-4">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          경기 예상치 변화
        </h2>
        <dl className="grid grid-cols-2 gap-os-2 [&>div]:rounded-os-m [&>div]:bg-os-surface-2 [&>div]:p-os-3 [&_dd]:mt-os-1">
          {stateDeltaRows.map((row) => (
            <div key={row.id}>
              <dt className="font-os text-os-text-2" style={CAPTION_STYLE}>
                {row.label}
              </dt>
              <dd className="os-num font-os text-os-text" style={BODY_STYLE}>
                {row.before} → {row.after}
              </dd>
              {row.boundaryReset ? (
                <dd className="font-os text-os-text-2" style={CAPTION_STYLE}>
                  시즌 경계 회귀
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      </section>

          <section className="os-panel flex flex-col gap-os-4" data-testid="season-compare">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          비교
        </h2>
        <SeasonCompareSection
          view={view}
          onTargetChange={(target) =>
            platform.analytics.track('season_result_viewed', {
              seasonIndex: view.seasonNumber,
              compareTarget: target,
            })
          }
        />
          </section>
        </div>
      </details>

      <div className="os-action-dock">
        <Link to="/career/$careerId/retirement" params={{ careerId }} className={buttonClassName('secondary')} style={buttonStyle}>커리어의 다음 선택</Link>
        <div className="grid grid-cols-2 gap-os-2">
          <Link
            to="/career/$careerId"
            params={{ careerId }}
            className={buttonClassName('secondary')}
            style={buttonStyle}
          >
            대시보드
          </Link>
          <Link
            to={SCREEN_ROUTES[nextTarget]}
            params={{ careerId }}
            className={buttonClassName('primary')}
            style={buttonStyle}
          >
            다음 시즌
          </Link>
        </div>
        {state.pending?.kind === 'OFFERS' || state.pending?.kind === 'LOAN_RETURN' ? (
          <p className="os-muted">다음 시즌 전에 계약·소속 결정을 먼저 마칩니다.</p>
        ) : null}
      </div>
    </div>
  );
}
