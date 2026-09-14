import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadRetirementArtifacts } from '@offside/content';
import { loadLocalCareerArchive, loadLocalLegacyResult } from '@offside/engine-client';
import { toPlayerPublic } from '@offside/contracts';
import {
  CAREER_TAGS,
  seasonWonTitle,
  assessCareerRetirement,
  careerEventChoices,
  nationalityForCareer,
  retirementContinuationOptions,
  legacyEndingPresentation,
  type CareerState,
  type Command,
  type CareerArchiveCore,
  type LegacyResult,
} from '@offside/domain';
import { Button, Dialog, DialogContent, DialogTrigger, ScreenIntro, buttonClassName, buttonStyle } from '@offside/ui';
import { LegacyScoreCard } from './legacy-score-card.js';
import { GameResultReveal } from './game-presentation.js';
import { getAppEngine } from '../engine/engine.js';
import { execute } from '../engine/career-actions.js';
import { rulesetForCareer } from '../engine/content.js';
import { useServiceSeason } from '../engine/service-season.js';
import { screenForCareer } from './career-route.js';
import { SCREEN_ROUTES } from '../routes.js';
import { POSITION_LABELS, TIMELINE_KIND_LABEL_KO, careerTagLabel } from './labels.js';
import {
  careerStartYear,
  extractCalendarStartYear,
  FALLBACK_CAREER_START_YEAR,
  seasonYear,
  seasonYearLabel,
  seasonYearLabelWithOrdinal,
  seasonYearRangeLabel,
} from './season-year.js';
import './retirement-screen.css';

type Mode = 'retirement' | 'legacy' | 'timeline' | 'final-profile';
export type RetirementRetrospectiveStep = `moment-${number}` | 'legacy' | 'final';
export type RetirementScreenProps = {
  state: CareerState;
  archive?: CareerArchiveCore;
  result?: LegacyResult;
  mode?: Mode;
  retrospective?: RetirementRetrospectiveStep;
  onCommand?: (command: Command) => Promise<void>;
  onSourceClick?: (sourceId: string) => void;
  busy?: boolean;
  error?: string;
  /** 2026-09-13 사용자 결정: 1시즌 = 1년 표기의 커리어 시작 연도(season-year.ts). react-query가
   * 필요한 조회는 `RetirementPage`가 대신 하고, 이 컴포넌트는 순수 표시(테스트에서 Provider 없이
   * 직접 렌더한다) — 값을 안 주면 폴백 2026을 쓴다. */
  startYear?: number;
};

/** All four pages load and validate the same immutable source. */
export function RetirementPage({
  careerId,
  mode = 'retirement',
  retrospective,
}: {
  careerId: string;
  mode?: Mode;
  retrospective?: RetirementRetrospectiveStep;
}) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const serviceSeasonQuery = useServiceSeason();
  const query = useQuery({
    queryKey: ['retirement', careerId],
    queryFn: async () => {
      const engine = await getAppEngine();
      const load = await engine.client.loadCareer(careerId);
      if (!load.ok) throw new Error(load.error.message);
      const state = load.snapshot.state;
      if (state.status !== 'RETIRED' && state.status !== 'ARCHIVED')
        return { state, archive: null, result: null };
      const resolver = (v: { rulesetVersion: string; contentPackVersion: string }) =>
        loadRetirementArtifacts(v.rulesetVersion, v.contentPackVersion);
      const archive = await loadLocalCareerArchive(
        engine.store,
        careerId,
        load.career.ownerProfileId,
        resolver,
      );
      const result = await loadLocalLegacyResult(
        engine.store,
        careerId,
        load.career.ownerProfileId,
        resolver,
      );
      if (archive === null || result === null)
        throw new Error('은퇴 보관 기록을 찾을 수 없습니다. 동기화 상태를 확인해 주세요.');
      return { state, archive, result };
    },
  });
  const mutation = useMutation({
    mutationFn: async (command: Command) => {
      const result = await execute(await getAppEngine(), careerId, command);
      if (!result.ok) throw new Error(result.error.message);
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['retirement', careerId] }),
        cache.invalidateQueries({ queryKey: ['career', careerId] }),
        cache.invalidateQueries({ queryKey: ['careers'] }),
      ]);
    },
  });
  useEffect(() => {
    const state = query.data?.state;
    if (state?.status !== 'DRAFT') return;
    const target = screenForCareer(state);
    void navigate({
      to: SCREEN_ROUTES[target.screenId],
      params: target.params,
      replace: true,
    });
  }, [navigate, query.data?.state]);
  if (query.isPending) return <p role="status">커리어 기록을 확인하고 있어요.</p>;
  if (query.isError)
    return (
      <section className="os-panel">
        <p role="alert">{query.error.message}</p>
        <Button onClick={() => void query.refetch()}>다시 확인</Button>
        <Link to="/">보관함으로</Link>
      </section>
    );
  const { state, archive, result } = query.data;
  if (state.status === 'DRAFT') return <p role="status">선수 생성 화면으로 돌아가고 있어요.</p>;
  if (mode !== 'retirement' && result === null)
    return (
      <section className="os-panel">
        <p>아직 선수 생활이 끝나지 않았어요.</p>
        <Link to="/career/$careerId/retirement" params={{ careerId }}>
          커리어의 다음 선택
        </Link>
      </section>
    );
  // 사용자 결정(2026-09-13): 1시즌 = 1년, 커리어 시작 연도부터 "2026 시즌"으로 표기(season-year.ts).
  const startYear = careerStartYear({
    seasonServiceSeasonId: state.season?.serviceSeasonId ?? null,
    currentServiceSeason: serviceSeasonQuery.data,
    calendarStartYear: extractCalendarStartYear(rulesetForCareer(state).leagueCalendar),
  });
  return (
    <RetirementScreen
      state={state}
      mode={mode}
      {...(retrospective === undefined ? {} : { retrospective })}
      startYear={startYear}
      {...(archive === null ? {} : { archive })}
      {...(result === null ? {} : { result })}
      busy={mutation.isPending}
      {...(mutation.error === null ? {} : { error: mutation.error.message })}
      onCommand={async (command) => {
        await mutation.mutateAsync(command);
      }}
      onSourceClick={(sourceId) => {
        const source = result?.sources.find((item) => item.sourceId === sourceId);
        if (source)
          void navigate({
            to: '/career/$careerId/timeline',
            params: { careerId },
            hash: `revision-${source.revision}`,
          });
      }}
    />
  );
}

const SERVICE_LABEL = {
  NOT_APPLICABLE: '해당 없음',
  PENDING: '경로 미선택',
  SERVING: '복무 중',
  SPECIAL_SERVICE: '체육요원 경로',
  COMPLETED: '복무 완료',
} as const;
const CHOICE_LABEL = {
  MILITARY_CLUB: '축구 병행 복무',
  CAREER_BREAK: '두 시즌 선수 생활 휴식',
  INTERNATIONAL: 'U23 국제대회 참가',
  MENTOR: '후배에게 경험 나누기',
} as const;

type RetrospectiveHighlight = Readonly<{
  sourceId: string;
  revision: number;
  eyebrow: string;
  title: string;
  detail: string;
}>;

type CareerMilestone = Readonly<{
  id: string;
  label: string;
  value: number;
  unit: string;
  seasonIndex: number;
}>;

function sourceSeasonIndex(sourceId: string): number | null {
  const match = /^season:(\d+):/.exec(sourceId);
  return match === null ? null : Number(match[1]);
}

function highlightFromSource(
  source: LegacyResult['sources'][number],
  state: CareerState,
  result: LegacyResult,
  startYear: number,
): RetrospectiveHighlight | null {
  if (source.sourceId === 'retirement:alternative') return null;
  const seasonIndex = source.seasonIndex ?? sourceSeasonIndex(source.sourceId);
  const season =
    seasonIndex === null
      ? undefined
      : state.seasonHistory.find((item) => item.index === seasonIndex);
  const eyebrow = seasonIndex === null ? '마지막 선택' : seasonYearLabel(startYear, seasonIndex);

  if (source.kind === 'RETIREMENT') {
    const retirement = state.timeline.findLast((entry) => entry.kind === 'RETIRED');
    if (retirement === undefined) return null;
    return {
      sourceId: source.sourceId,
      revision: source.revision,
      eyebrow,
      title:
        retirement.refId === 'COACH_EPILOGUE'
          ? '지도자로 이어지는 마지막 휘슬'
          : '선수로서 맞은 마지막 휘슬',
      detail: `${state.seasonHistory.length}시즌의 확정 기록을 보관했습니다.`,
    };
  }

  if (source.kind === 'TAG') {
    const tag = source.sourceId.slice('tag:'.length) as keyof typeof CAREER_TAGS;
    if (!result.tags.includes(tag) || CAREER_TAGS[tag] === undefined) return null;
    return {
      sourceId: source.sourceId,
      revision: source.revision,
      eyebrow,
      title: careerTagLabel(tag, CAREER_TAGS[tag].label),
      detail: '보관된 커리어 태그의 확정 근거입니다.',
    };
  }

  if (source.kind === 'CHAPTER') {
    const tournament = result.international.tournaments.find(
      (item) => item.sourceId === source.sourceId,
    );
    if (tournament !== undefined) {
      const medal =
        tournament.medal === null
          ? '메달 없음'
          : { GOLD: '금메달', SILVER: '은메달', BRONZE: '동메달' }[tournament.medal];
      return {
        sourceId: source.sourceId,
        revision: source.revision,
        eyebrow,
        title: tournament.tournament === 'OLYMPICS' ? '올림픽 여정' : '아시안게임 여정',
        detail: `U23 대표팀 기록 · ${medal}`,
      };
    }
    const chapterId = source.sourceId.split(':chapter:')[1];
    const chapter = season?.result.chapters.find((item) => item.chapterId === chapterId);
    if (season === undefined || chapter === undefined) return null;
    const appearances =
      season.result.playerStats.appearances.total -
      season.result.playerStats.appearances.zeroMinute;
    return {
      sourceId: source.sourceId,
      revision: source.revision,
      eyebrow,
      title: '결정적인 경기의 선택',
      detail: `${appearances}경기 출전 시즌 · 저장된 선택 결과`,
    };
  }

  if (season === undefined) return null;
  const appearances =
    season.result.playerStats.appearances.total - season.result.playerStats.appearances.zeroMinute;
  if (source.sourceId.includes(':trophy:')) {
    const competitionId = source.sourceId.split(':trophy:')[1];
    const competition = season.result.competitions.find(
      (item) => item.competitionId === competitionId,
    );
    if (competition === undefined || !seasonWonTitle({ competitions: [competition] })) return null;
    return {
      sourceId: source.sourceId,
      revision: source.revision,
      eyebrow,
      title: competition.kind === 'CUP' ? '컵 우승' : '리그 우승',
      detail: `${appearances}경기 출전 · ${season.result.playerStats.minutes.toLocaleString('ko-KR')}분`,
    };
  }
  if (source.sourceId.endsWith(':relationships')) {
    return {
      sourceId: source.sourceId,
      revision: source.revision,
      eyebrow,
      title: '함께 쌓은 신뢰',
      detail: `시즌 종료 감독 신뢰 ${season.result.stateDeltas.managerTrust.after}`,
    };
  }
  if (source.sourceId.endsWith(':duration')) {
    return {
      sourceId: source.sourceId,
      revision: source.revision,
      eyebrow,
      title: `${season.index}번째 시즌 완주`,
      detail: `${appearances}경기 출전 · ${season.result.playerStats.minutes.toLocaleString('ko-KR')}분`,
    };
  }
  if (
    source.sourceId.endsWith(':performance') ||
    source.sourceId.endsWith(':individual-merit') ||
    source.sourceId.endsWith(':established-contribution')
  ) {
    const average =
      season.result.playerStats.ratedMatches === 0
        ? '평균 평점 미집계'
        : `평균 평점 ${(
            season.result.playerStats.ratingSumTenths /
            season.result.playerStats.ratedMatches /
            10
          ).toFixed(1)}`;
    return {
      sourceId: source.sourceId,
      revision: source.revision,
      eyebrow,
      title: '시즌 기여 기록',
      detail: `${appearances}경기 · ${season.result.playerStats.minutes.toLocaleString('ko-KR')}분 · ${average}`,
    };
  }
  return null;
}

function buildRetrospectiveHighlights(
  state: CareerState,
  result: LegacyResult,
  startYear: number,
): RetrospectiveHighlight[] {
  const preferred = [
    result.sources.find((source) => source.sourceId === result.bestMomentRef),
    ...result.sources.filter((source) => source.sourceId.includes(':trophy:')),
    ...result.sources.filter((source) => source.kind === 'CHAPTER'),
    ...result.sources.filter((source) => source.kind === 'TAG'),
    ...result.sources.filter((source) => source.sourceId.endsWith(':performance')),
    ...result.sources.filter((source) => source.sourceId.endsWith(':relationships')),
    ...result.sources.filter((source) => source.sourceId.endsWith(':duration')),
    ...result.sources.filter((source) => source.kind === 'RETIREMENT'),
  ].filter((source): source is LegacyResult['sources'][number] => source !== undefined);
  const unique = new Map<string, RetrospectiveHighlight>();
  for (const source of preferred) {
    if (unique.has(source.sourceId)) continue;
    const highlight = highlightFromSource(source, state, result, startYear);
    if (highlight !== null) unique.set(source.sourceId, highlight);
    if (unique.size === 5) break;
  }
  return [...unique.values()].sort(
    (left, right) => left.revision - right.revision || left.sourceId.localeCompare(right.sourceId),
  );
}

function highestCrossedThreshold(value: number, thresholds: readonly number[]): number | null {
  return thresholds.filter((threshold) => value >= threshold).at(-1) ?? null;
}

function buildCareerMilestones(state: CareerState, archive: CareerArchiveCore): CareerMilestone[] {
  const milestones: CareerMilestone[] = [];
  const definitions: Array<{
    id: string;
    label: string;
    unit: string;
    thresholds: readonly number[];
    value: (season: CareerState['seasonHistory'][number]) => number;
    supports: (season: CareerState['seasonHistory'][number]) => boolean;
  }> = [
    {
      id: 'appearances',
      label: '통산 출전',
      unit: '경기',
      thresholds: [50, 100, 200],
      value: (season) =>
        season.result.playerStats.appearances.total -
        season.result.playerStats.appearances.zeroMinute,
      supports: () => true,
    },
  ];
  const primary = archive.records.positions.toSorted(
    (left, right) =>
      right.totals.minutes - left.totals.minutes || left.group.localeCompare(right.group),
  )[0]?.group;
  if (primary !== undefined) {
    const metric = {
      FW: {
        id: 'goals',
        label: '공격수 통산 득점',
        unit: '골',
        thresholds: [10, 25, 50],
      },
      MF: {
        id: 'chances',
        label: '미드필더 기회 창출',
        unit: '회',
        thresholds: [50, 100, 250],
      },
      DF: {
        id: 'tackles',
        label: '수비수 태클',
        unit: '회',
        thresholds: [50, 100, 250],
      },
      GK: {
        id: 'saves',
        label: '골키퍼 선방',
        unit: '회',
        thresholds: [50, 100, 250],
      },
    }[primary];
    definitions.push({
      ...metric,
      value: (season) => {
        const totals = season.result.playerStats.totals;
        if (primary === 'FW' && totals.group === 'FW') return totals.goals;
        if (primary === 'MF' && totals.group === 'MF') return totals.chancesCreated;
        if (primary === 'DF' && totals.group === 'DF') return totals.tackles;
        if (primary === 'GK' && totals.group === 'GK') return totals.saves;
        return 0;
      },
      supports: (season) => season.result.playerStats.group === primary,
    });
  }
  for (const definition of definitions) {
    let cumulative = 0;
    let reachedSeason: number | null = null;
    let reachedValue = 0;
    for (const season of state.seasonHistory) {
      if (!definition.supports(season)) continue;
      const previous = cumulative;
      cumulative += definition.value(season);
      const threshold = highestCrossedThreshold(
        cumulative,
        definition.thresholds.filter((value) => value > previous),
      );
      if (threshold !== null) {
        reachedSeason = season.index;
        reachedValue = threshold;
      }
    }
    if (
      reachedSeason !== null &&
      archive.records.sources.some((source) => source.seasonIndex === reachedSeason)
    ) {
      milestones.push({
        id: definition.id,
        label: definition.label,
        value: reachedValue,
        unit: definition.unit,
        seasonIndex: reachedSeason,
      });
    }
  }
  return milestones;
}

/** "2026–2041 · 16시즌"(2026-09-13 사용자 결정: 은퇴·보관함 기록에도 연도가 보이게 한다). 완주한
 * 시즌이 없으면(0) 기간을 만들 근거가 없어 개수만 남긴다. */
function totalSeasonsPeriodLabel(startYear: number, totalSeasons: number): string {
  if (totalSeasons <= 0) return `${totalSeasons}시즌`;
  return `${seasonYearRangeLabel(startYear, 1, totalSeasons)} · ${totalSeasons}시즌`;
}

function TimelineRevision({
  state,
  revision,
  startYear,
}: {
  state: CareerState;
  revision: number;
  startYear: number;
}) {
  return (
    <li
      className="os-panel os-endgame-section scroll-mt-20"
      id={`revision-${revision}`}
      tabIndex={-1}
    >
      <h2>{state.timeline.find((entry) => entry.revision === revision)?.age}세의 기록</h2>
      <p>
        {state.timeline
          .filter((entry) => entry.revision === revision)
          .map((entry) => TIMELINE_KIND_LABEL_KO[entry.kind])
          .join(' · ')}
      </p>
      {state.seasonHistory
        .filter((season) => season.settledAtRevision === revision)
        .map((season) => (
          <p key={season.index}>
            {seasonYearLabelWithOrdinal(startYear, season.index)} · 출전{' '}
            {season.result.playerStats.appearances.total -
              season.result.playerStats.appearances.zeroMinute}
            경기 · {season.result.playerStats.minutes}분 · 감독 신뢰{' '}
            {season.result.stateDeltas.managerTrust.after}
          </p>
        ))}
      {state.legacyEvents?.tournaments
        .filter((tournament) =>
          state.timeline.some(
            (entry) => entry.revision === revision && entry.refId === tournament.sourceId,
          ),
        )
        .map((tournament) => (
          <p key={tournament.sourceId}>
            {tournament.tournament === 'OLYMPICS' ? '올림픽' : '아시안게임'} · U23{' '}
            {tournament.matches.length}경기 ·{' '}
            {tournament.medal === null
              ? '메달 없음'
              : { GOLD: '금메달', SILVER: '은메달', BRONZE: '동메달' }[
                  tournament.medal
                ]}
          </p>
        ))}
    </li>
  );
}

function TimelineList({
  state,
  primaryRevisions,
  routineRevisions,
  startYear,
}: {
  state: CareerState;
  primaryRevisions: number[];
  routineRevisions: number[];
  startYear: number;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    const revision = Number(targetId.replace('revision-', ''));
    if (routineRevisions.includes(revision)) detailsRef.current?.setAttribute('open', '');
    requestAnimationFrame(() => document.getElementById(targetId)?.focus());
  }, [routineRevisions]);

  return (
    <div className="os-endgame-stack">
      <ol className="os-endgame-timeline" aria-label="커리어 연대기">
        {primaryRevisions.map((revision) => (
          <TimelineRevision state={state} revision={revision} startYear={startYear} key={revision} />
        ))}
      </ol>
      {routineRevisions.length ? (
        <details className="os-panel os-endgame-routine" ref={detailsRef}>
          <summary>일상적인 시즌 진행 {routineRevisions.length}개 보기</summary>
          <ol className="os-endgame-timeline mt-os-3" aria-label="일상적인 시즌 진행 기록">
            {routineRevisions.map((revision) => (
              <TimelineRevision state={state} revision={revision} startYear={startYear} key={revision} />
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

function RetrospectiveProgress({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="os-panel os-retrospective-progress"
      aria-label={`커리어 돌아보기 ${current} / ${total} 단계`}
    >
      <span>커리어 돌아보기</span>
      <strong>
        {current} / {total}
      </strong>
      <div className="os-retrospective-progress-track" aria-hidden="true">
        <span style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  );
}

function GuidedRetrospective({
  state,
  result,
  archive,
  step,
  startYear,
  onSourceClick,
}: {
  state: CareerState;
  result: LegacyResult;
  archive: CareerArchiveCore;
  step: RetirementRetrospectiveStep;
  startYear: number;
  onSourceClick?: (sourceId: string) => void;
}) {
  const highlights = buildRetrospectiveHighlights(state, result, startYear);
  const total = highlights.length + 2;
  const requestedMoment = step.startsWith('moment-') ? Number(step.slice('moment-'.length)) : null;
  const moment = requestedMoment === null ? null : highlights[requestedMoment - 1];
  const normalizedStep =
    step === 'legacy' || step === 'final'
      ? step
      : moment === undefined
        ? highlights.length === 0
          ? 'legacy'
          : 'moment-1'
        : step;
  const current =
    normalizedStep === 'legacy'
      ? highlights.length + 1
      : normalizedStep === 'final'
        ? total
        : Number(normalizedStep.slice('moment-'.length));
  const currentMoment = normalizedStep.startsWith('moment-') ? highlights[current - 1] : undefined;
  const careerId = state.careerId;

  return (
    <section className="os-endgame-stack" aria-labelledby="guided-retrospective-title">
      <h2 id="guided-retrospective-title" className="sr-only">
        커리어 돌아보기
      </h2>
      <RetrospectiveProgress current={current} total={total} />
      {normalizedStep === 'final' ? null : (
        <div className="os-retrospective-skip">
          <Link
            to="/career/$careerId/retirement"
            params={{ careerId }}
            search={{ retrospective: 'final' }}
          >
            전체 건너뛰기
          </Link>
        </div>
      )}
      {currentMoment !== undefined ? (
        <article className="os-panel os-retrospective-moment">
          <p>{currentMoment.eyebrow}</p>
          <h2>{currentMoment.title}</h2>
          <p>{currentMoment.detail}</p>
          {onSourceClick === undefined ? null : (
            <button
              type="button"
              className={buttonClassName('secondary')}
              style={buttonStyle}
              onClick={() => onSourceClick(currentMoment.sourceId)}
            >
              연대기에서 근거 보기
            </button>
          )}
        </article>
      ) : null}
      {normalizedStep === 'legacy' ? (
        <LegacyScoreCard result={result} {...(onSourceClick ? { onSourceClick } : {})} />
      ) : null}
      {normalizedStep === 'final' ? (
        <FinalProfileView state={state} result={result} archive={archive} startYear={startYear} />
      ) : null}
      {normalizedStep !== 'final' ? (
        <div className="os-endgame-choice-grid">
          <Link
            className={buttonClassName('primary')}
            style={buttonStyle}
            to="/career/$careerId/retirement"
            params={{ careerId }}
            search={{
              retrospective:
                normalizedStep === 'legacy'
                  ? 'final'
                  : current >= highlights.length
                    ? 'legacy'
                    : (`moment-${current + 1}` as const),
            }}
          >
            {normalizedStep === 'legacy'
              ? '최종 기록 보기'
              : current >= highlights.length
                ? 'Legacy 평가 보기'
                : '다음 대표 순간'}
          </Link>
          <Link
            className={buttonClassName('secondary')}
            style={buttonStyle}
            to="/career/$careerId/retirement"
            params={{ careerId }}
            search={{ retrospective: 'final' }}
          >
            최종 기록 바로 보기
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function FinalProfileView({
  state,
  result,
  archive,
  startYear,
}: {
  state: CareerState;
  result: LegacyResult;
  archive?: CareerArchiveCore;
  startYear: number;
}) {
  const profile = state.player.profile === null ? null : toPlayerPublic(state.player.profile);
  const ending = legacyEndingPresentation(result.endingId);
  if (profile === null) return null;
  return (
    <section className="os-endgame-stack">
      <div className="os-endgame-hero">
        <p>FINAL PLAYER PROFILE</p>
        <h2>{profile.name}</h2>
        <p>
          최종 포지션 {POSITION_LABELS[profile.primaryPosition]} · 선호{' '}
          {POSITION_LABELS[profile.preferredPosition]}
        </p>
      </div>
      <div className="os-panel os-endgame-section">
        <dl className="os-endgame-stat-grid">
          <div className="os-endgame-stat">
            <dt>최종 OVR</dt>
            <dd>{profile.baseOvr}</dd>
          </div>
          {archive ? (
            <>
              <div className="os-endgame-stat">
                <dt>시즌</dt>
                <dd>{totalSeasonsPeriodLabel(startYear, archive.records.totals.seasons)}</dd>
              </div>
              <div className="os-endgame-stat">
                <dt>출전</dt>
                <dd>{archive.records.totals.playedMatches}</dd>
              </div>
            </>
          ) : null}
          <div className="os-endgame-stat">
            <dt>Legacy</dt>
            <dd>{result.totalScore}</dd>
          </div>
        </dl>
        <h3>커리어 엔딩</h3>
        <p>{ending.title}</p>
        <p>{ending.sentence}</p>
        <h3>커리어 태그</h3>
        {result.tags.length ? (
          <ul className="os-endgame-tags">
            {result.tags.map((tag) => (
              <li key={tag}>{careerTagLabel(tag, CAREER_TAGS[tag].label)}</li>
            ))}
          </ul>
        ) : (
          <p>아직 이름 붙지 않은 이야기라도, 모든 출전은 기록에 남습니다.</p>
        )}
        <p>보관된 기록은 새 플레이의 성장 수치에 더하지 않습니다.</p>
      </div>
      <Link className={buttonClassName('primary')} style={buttonStyle} to="/">
        새 선수로 시작하기
      </Link>
    </section>
  );
}

export function RetirementScreen({
  state,
  result,
  archive,
  mode = 'retirement',
  retrospective,
  onCommand,
  onSourceClick,
  busy = false,
  error,
  startYear = FALLBACK_CAREER_START_YEAR,
}: RetirementScreenProps) {
  const [localError, setLocalError] = useState<string>();
  const [localBusy, setLocalBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const run = async (command: Command) => {
    if (localBusy || busy || onCommand === undefined) return;
    setLocalBusy(true);
    setLocalError(undefined);
    try {
      await onCommand(command);
      setOpen(false);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '저장하지 못했어요. 다시 확인해 주세요.');
    } finally {
      setLocalBusy(false);
    }
  };
  const pending = busy || localBusy;
  const terminal = state.status === 'RETIRED' || state.status === 'ARCHIVED';
  const profile = state.player.profile === null ? null : toPlayerPublic(state.player.profile);
  const assessment = assessCareerRetirement(state);
  const nationality = nationalityForCareer(state);
  const careerId = state.careerId;
  const timelineRevisions = [...new Set(state.timeline.map((entry) => entry.revision))];
  const routineTimelineRevisions = timelineRevisions.filter((revision) =>
    state.timeline
      .filter((entry) => entry.revision === revision)
      .every((entry) => entry.kind === 'STEP_PASSED'),
  );
  const primaryTimelineRevisions = timelineRevisions.filter(
    (revision) => !routineTimelineRevisions.includes(revision),
  );
  const bestSeason = state.seasonHistory
    .filter((s) => s.result.playerStats.ratedMatches >= 10)
    .toSorted(
      (a, b) =>
        b.result.playerStats.ratingSumTenths / b.result.playerStats.ratedMatches -
          a.result.playerStats.ratingSumTenths / a.result.playerStats.ratedMatches ||
        b.result.playerStats.minutes - a.result.playerStats.minutes ||
        a.index - b.index,
    )[0];
  const trophies = state.seasonHistory.flatMap((s) =>
    s.result.competitions
      .filter((competition) => seasonWonTitle({ competitions: [competition] }))
      .map((competition) => ({
        season: s.index,
        id: competition.competitionId,
        name: competition.kind === 'CUP' ? '컵 우승' : '리그 우승',
      })),
  );
  const retirementEntry = state.timeline.findLast((entry) => entry.kind === 'RETIRED');
  const finalChoice = retirementEntry?.refId === 'COACH_EPILOGUE' ? '지도자로 이어지는 마지막 휘슬' : '선수로서 맞은 마지막 휘슬';
  const bestMoment = result?.sources.find((source) => source.sourceId === result.bestMomentRef);
  const milestones = archive === undefined ? [] : buildCareerMilestones(state, archive);
  const retrospectiveHighlights =
    result === undefined ? [] : buildRetrospectiveHighlights(state, result, startYear);
  // 은퇴 연도: 마지막으로 완주한 시즌의 해(완주한 시즌이 없으면 커리어 시작 연도 그대로).
  const retirementYear = seasonYear(startYear, Math.max(state.seasonHistory.length, 1));
  return (
    <div className="os-endgame-stack">
      <ScreenIntro
        eyebrow={terminal ? '커리어의 마지막 휘슬' : '시즌 사이, 당신의 선택'}
        title={
          retrospective !== undefined
            ? '커리어 돌아보기'
            : mode === 'retirement'
              ? terminal
              ? '커리어 회고'
              : '다음 시즌을 앞두고'
            : mode === 'legacy'
              ? 'Legacy Score'
              : mode === 'timeline'
                ? '커리어 연대기'
                : '최종 프로필'
        }
        description={
          terminal
            ? '마지막 선택과 실제 커리어 기록을 차례로 돌아봅니다.'
            : '다음 시즌을 시작하거나, 지금까지의 선수 생활을 마무리할 수 있습니다.'
        }
      />
      {(error ?? localError) ? <p role="alert">{error ?? localError}</p> : null}
      {!terminal && mode === 'retirement' ? (
        <>
          {assessment === null ? null : (
            <section className="os-panel os-endgame-section">
              <h2>선수 생활을 돌아볼 때</h2>
              <p className="os-endgame-callout">
                {assessment.total === null
                  ? '시장·출전 근거가 부족해 은퇴 압력을 계산하지 않았어요.'
                  : `은퇴 압력 ${assessment.total} / 100`}
              </p>
              <p>
                나이만으로 은퇴하지 않습니다. 최근 몸 상태, 출전 기회, 계약과 시장 수요를 함께
                봅니다.
              </p>
              {assessment.factors ? (
                <details>
                  <summary>판단 근거 자세히 보기</summary>
                  <dl className="os-endgame-stat-grid mt-os-3">
                    {Object.entries(assessment.factors).map(([key, value]) => (
                      <div className="os-endgame-stat" key={key}>
                        <dt>{{ age: '연령', injury: '몸 상태', market: '시장 수요', opportunity: '출전 기회', intent: '은퇴 의향' }[key]}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ) : null}
            </section>
          )}
          <section className="os-panel os-endgame-section">
            <h2>커리어의 다른 선택</h2>
            <p>복무 상태: {SERVICE_LABEL[nationality.serviceStatus]}</p>
            <p>
              게임용 단순화입니다. 축구 병행 경로는 현재 소속을 유지하며, 휴식 경로는 두 시즌 출전과
              급여를 중단합니다. 메달에 따른 체육요원 경로도 실제 병역 자격을 판정하지 않습니다.
            </p>
            <div className="os-endgame-choice-grid">
            {careerEventChoices(state).map((choice) => (
              <Button
                key={choice}
                variant="secondary"
                disabled={pending || onCommand === undefined}
                onClick={() => void run({ type: 'CAREER_EVENT', payload: { choice } })}
              >
                {CHOICE_LABEL[choice]}
              </Button>
            ))}
            </div>
          </section>
          <div className="os-endgame-choice-grid">
          {retirementContinuationOptions(state).map((option) => (
            <Button
              key={option.offerId}
              disabled={pending || onCommand === undefined}
              onClick={() =>
                void run({
                  type: 'RETIRE',
                  payload: { choice: option.choice, offerId: option.offerId },
                })
              }
            >
              {option.teamName}에서 마지막 한 시즌
              {option.choice === 'LOWER_LEAGUE' ? ' — 하부리그 도전' : ''}
            </Button>
          ))}
          </div>
          {state.seasonHistory.length > 0 &&
          state.season === null &&
          state.pending === null &&
          onCommand ? (
            <Dialog
              open={open}
              onOpenChange={(nextOpen) => {
                // An irreversible retirement request owns the dialog until it settles. This
                // covers Escape, the overlay, and the close button without changing Dialog's
                // shared dismissal behavior elsewhere.
                if (pending && !nextOpen) return;
                setOpen(nextOpen);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="secondary" disabled={pending}>
                  선수 생활 마무리
                </Button>
              </DialogTrigger>
              <DialogContent title="마지막 휘슬을 불까요?" closeLabel="취소">
                <p>
                  은퇴하면 이 선수로는 다시 진행할 수 없습니다. 기록은 보관하고, 새 선수로 다시
                  시작할 수 있어요.
                </p>
                <Button
                  disabled={pending}
                  onClick={() => void run({ type: 'RETIRE', payload: { choice: 'RETIRE' } })}
                >
                  은퇴 확정
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    void run({ type: 'RETIRE', payload: { choice: 'COACH_EPILOGUE' } })
                  }
                >
                  지도자 에필로그로 마무리
                </Button>
              </DialogContent>
            </Dialog>
          ) : (
            <p>진행 중인 시즌과 계약 선택을 마친 뒤 은퇴할 수 있어요.</p>
          )}
          <Link to="/career/$careerId" params={{ careerId }}>
            선수 생활로 돌아가기
          </Link>
        </>
      ) : null}
      {terminal && mode === 'retirement' && archive && result && retrospective === undefined ? (
        <GameResultReveal fast={state.simulationMode === 'FAST'} announcement={`${profile?.name ?? '선수'}의 커리어 기록이 확정되었습니다`}>
          <div className="os-endgame-stack">
            <section className="os-endgame-hero" aria-labelledby="career-recap-heading">
              <p>FULL TIME · {retirementYear}년 · {state.age}세</p>
              <h2 id="career-recap-heading">{profile?.name}의 축구 인생</h2>
              <p>{finalChoice}. 기록은 변경되지 않는 커리어 보관 자료로 남습니다.</p>
            </section>
            <section className="os-panel os-endgame-section">
              <h2>통산 기록</h2>
              <dl className="os-endgame-stat-grid">
                <div className="os-endgame-stat"><dt>시즌</dt><dd>{totalSeasonsPeriodLabel(startYear, archive.records.totals.seasons)}</dd></div>
                <div className="os-endgame-stat"><dt>출전</dt><dd>{archive.records.totals.playedMatches}경기</dd></div>
                <div className="os-endgame-stat"><dt>출전 시간</dt><dd>{archive.records.totals.minutes.toLocaleString('ko-KR')}분</dd></div>
                <div className="os-endgame-stat"><dt>평균 평점</dt><dd>{archive.records.totals.averageRatingTenths === null ? '미집계' : (archive.records.totals.averageRatingTenths / 10).toFixed(1)}</dd></div>
              </dl>
              {bestMoment ? <button type="button" className="os-endgame-callout text-left" onClick={() => onSourceClick?.(bestMoment.sourceId)}>대표 장면 · {bestMoment.seasonIndex === null ? '마지막 선택' : seasonYearLabel(startYear, bestMoment.seasonIndex)} 기록 보기</button> : null}
            </section>
            <section className="os-panel os-endgame-section">
              <h2>가장 빛난 시즌</h2>
              <p>{bestSeason ? `${seasonYearLabel(startYear, bestSeason.index)} · 평균 평점 ${(bestSeason.result.playerStats.ratingSumTenths / bestSeason.result.playerStats.ratedMatches / 10).toFixed(1)} · ${bestSeason.result.playerStats.minutes.toLocaleString('ko-KR')}분` : '10경기 이상 평점이 기록된 시즌이 없습니다.'}</p>
              <details>
                <summary>구단·트로피·대표팀 기록</summary>
                <div className="os-endgame-section mt-os-3">
                  <ul>{archive.records.clubs.map((club) => <li key={club.teamId}>{state.clubHistory.find((stint) => stint.teamId === club.teamId)?.teamName ?? club.teamId} · {club.totals.seasons}시즌 · {club.totals.playedMatches}경기</li>)}</ul>
                  <h3>트로피 {trophies.length}개</h3>
                  {trophies.length ? <ul>{trophies.map((trophy) => <li key={`${trophy.season}:${trophy.id}`}>{seasonYearLabel(startYear, trophy.season)} · {trophy.name}</li>)}</ul> : <p>기록된 우승이 없습니다.</p>}
                  <p>성인 대표팀 {result.international.seniorCaps}회 · U23 {result.international.youthAppearances}회 (별도 집계)</p>
                  <p>복무 경로 · {SERVICE_LABEL[result.nationality.serviceStatus]}</p>
                  <p>
                    커리어 수입 · 게임 화폐 최소 단위:{' '}
                    {result.coverage.income === 'UNAVAILABLE'
                      ? '미집계'
                      : `${result.incomeMinor.toLocaleString('ko-KR')}${
                          result.coverage.income === 'PARTIAL' ? ' (일부 시즌만 집계)' : ''
                        }`}
                  </p>
                </div>
              </details>
            </section>
            <section className="os-panel os-endgame-section" aria-labelledby="career-milestones-heading">
              <h2 id="career-milestones-heading">커리어 마일스톤</h2>
              {milestones.length > 0 ? (
                <ul className="os-milestone-grid">
                  {milestones.map((milestone) => (
                    <li key={milestone.id}>
                      <span>{seasonYearLabel(startYear, milestone.seasonIndex)} 달성</span>
                      <strong>{milestone.label} {milestone.value}{milestone.unit}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>보관 기록에서 확인할 수 있는 마일스톤이 아직 없습니다.</p>
              )}
              <p>마일스톤과 확정된 커리어 기록은 언제든 이 화면에서 다시 볼 수 있습니다.</p>
            </section>
            <div className="os-endgame-choice-grid">
              <Link
                className={buttonClassName('primary')}
                style={buttonStyle}
                to="/career/$careerId/retirement"
                params={{ careerId }}
                search={{
                  retrospective: retrospectiveHighlights.length > 0 ? 'moment-1' : 'legacy',
                }}
              >
                커리어 돌아보기
              </Link>
              <Link
                className={buttonClassName('secondary')}
                style={buttonStyle}
                to="/career/$careerId/retirement"
                params={{ careerId }}
                search={{ retrospective: 'final' }}
              >
                최종 기록 바로 보기
              </Link>
            </div>
            <Link className={buttonClassName('primary')} style={buttonStyle} to="/career/$careerId/legacy" params={{ careerId }}>Legacy 평가 보기</Link>
          </div>
        </GameResultReveal>
      ) : null}
      {terminal && mode === 'retirement' && archive && result && retrospective !== undefined ? (
        <GuidedRetrospective
          state={state}
          result={result}
          archive={archive}
          step={retrospective}
          startYear={startYear}
          {...(onSourceClick ? { onSourceClick } : {})}
        />
      ) : null}
      {mode === 'legacy' && result ? (
        <LegacyScoreCard result={result} {...(onSourceClick ? { onSourceClick } : {})} />
      ) : null}
      {mode === 'timeline' && terminal ? (
        <TimelineList
          state={state}
          primaryRevisions={primaryTimelineRevisions}
          routineRevisions={routineTimelineRevisions}
          startYear={startYear}
        />
      ) : null}
      {mode === 'final-profile' && terminal && result ? (
        <FinalProfileView
          state={state}
          result={result}
          startYear={startYear}
          {...(archive === undefined ? {} : { archive })}
        />
      ) : null}
      {terminal ? (
        <nav aria-label="은퇴 결과" className="os-panel os-endgame-nav">
          <Link aria-current={mode === 'retirement' ? 'page' : undefined} to="/career/$careerId/retirement" params={{ careerId }}>
            통산 기록
          </Link>
          <Link aria-current={mode === 'legacy' ? 'page' : undefined} to="/career/$careerId/legacy" params={{ careerId }}>
            Legacy Score
          </Link>
          <Link aria-current={mode === 'timeline' ? 'page' : undefined} to="/career/$careerId/timeline" params={{ careerId }}>
            연대기
          </Link>
          <Link aria-current={mode === 'final-profile' ? 'page' : undefined} to="/career/$careerId/final-profile" params={{ careerId }}>
            최종 프로필
          </Link>
          <Link className="os-endgame-nav-wide" to="/">선수 보관함 · 새 커리어</Link>
        </nav>
      ) : null}
    </div>
  );
}
