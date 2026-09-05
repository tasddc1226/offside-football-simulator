import { useState } from 'react';
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
  type CareerState,
  type Command,
  type CareerArchiveCore,
  type LegacyResult,
} from '@offside/domain';
import { Button, Dialog, DialogContent, DialogTrigger, ScreenIntro } from '@offside/ui';
import { LegacyScoreCard } from './legacy-score-card.js';
import { getAppEngine } from '../engine/engine.js';
import { execute } from '../engine/career-actions.js';
import { POSITION_LABELS, TIMELINE_KIND_LABEL_KO } from './labels.js';

type Mode = 'retirement' | 'legacy' | 'timeline' | 'final-profile';
export type RetirementScreenProps = {
  state: CareerState;
  archive?: CareerArchiveCore;
  result?: LegacyResult;
  mode?: Mode;
  onCommand?: (command: Command) => Promise<void>;
  onSourceClick?: (sourceId: string) => void;
  busy?: boolean;
  error?: string;
};

/** All four pages load and validate the same immutable source. */
export function RetirementPage({
  careerId,
  mode = 'retirement',
}: {
  careerId: string;
  mode?: Mode;
}) {
  const cache = useQueryClient();
  const navigate = useNavigate();
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
  if (mode !== 'retirement' && result === null)
    return (
      <section className="os-panel">
        <p>아직 선수 생활이 끝나지 않았어요.</p>
        <Link to="/career/$careerId/retirement" params={{ careerId }}>
          커리어의 다음 선택
        </Link>
      </section>
    );
  return (
    <RetirementScreen
      state={state}
      mode={mode}
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

export function RetirementScreen({
  state,
  result,
  archive,
  mode = 'retirement',
  onCommand,
  onSourceClick,
  busy = false,
  error,
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
  return (
    <div className="flex flex-col gap-os-4">
      <ScreenIntro
        eyebrow={terminal ? '커리어의 마지막 휘슬' : '시즌 사이, 당신의 선택'}
        title={
          mode === 'retirement'
            ? terminal
              ? 'FULL TIME'
              : '다음 시즌을 앞두고'
            : mode === 'legacy'
              ? 'Legacy Score'
              : mode === 'timeline'
                ? '커리어 연대기'
                : '최종 프로필'
        }
        description={
          terminal
            ? '커리어에는 VAR이 없다. 당신의 기록은 이곳에 남습니다.'
            : '지금의 선택이 마지막 장면에 남습니다.'
        }
      />
      {(error ?? localError) ? <p role="alert">{error ?? localError}</p> : null}
      {!terminal && mode === 'retirement' ? (
        <>
          {assessment === null ? null : (
            <section className="os-panel">
              <h2>선수 생활을 돌아볼 때</h2>
              <p>
                {assessment.total === null
                  ? '시장·출전 근거가 부족해 은퇴 압력을 계산하지 않았어요.'
                  : `은퇴 압력 ${assessment.total} / 100`}
              </p>
              <p>
                나이만으로 은퇴하지 않습니다. 최근 몸 상태, 출전 기회, 계약과 시장 수요를 함께
                봅니다.
              </p>
              {assessment.factors ? (
                <dl className="grid grid-cols-2 gap-os-2">
                  {Object.entries(assessment.factors).map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {
                          {
                            age: '연령',
                            injury: '몸 상태',
                            market: '시장 수요',
                            opportunity: '출전 기회',
                            intent: '은퇴 의향',
                          }[key]
                        }
                      </dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>
          )}
          <section className="os-panel flex flex-col gap-os-2">
            <h2>커리어의 다른 선택</h2>
            <p>복무 상태: {SERVICE_LABEL[nationality.serviceStatus]}</p>
            <p>
              게임용 단순화입니다. 축구 병행 경로는 현재 소속을 유지하며, 휴식 경로는 두 시즌 출전과
              급여를 중단합니다. 메달에 따른 체육요원 경로도 실제 병역 자격을 판정하지 않습니다.
            </p>
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
          </section>
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
          {state.seasonHistory.length > 0 &&
          state.season === null &&
          state.pending === null &&
          onCommand ? (
            <Dialog open={open} onOpenChange={setOpen}>
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
      {terminal && mode === 'retirement' && archive && result ? (
        <section className="os-panel flex flex-col gap-os-3">
          <h2>{profile?.name}의 통산 기록</h2>
          <dl className="grid grid-cols-2 gap-os-3">
            <div>
              <dt>시즌</dt>
              <dd>{archive.records.totals.seasons}</dd>
            </div>
            <div>
              <dt>출전</dt>
              <dd>{archive.records.totals.playedMatches}경기</dd>
            </div>
            <div>
              <dt>출전 시간</dt>
              <dd>{archive.records.totals.minutes.toLocaleString('ko-KR')}분</dd>
            </div>
            <div>
              <dt>평점</dt>
              <dd>
                {archive.records.totals.averageRatingTenths === null
                  ? '미집계'
                  : (archive.records.totals.averageRatingTenths / 10).toFixed(1)}
              </dd>
            </div>
            <div>
              <dt>커리어 수입 · 게임 화폐 최소 단위</dt>
              <dd>
                {result.coverage.income === 'UNAVAILABLE'
                  ? '미집계'
                  : `${result.incomeMinor.toLocaleString('ko-KR')}${result.coverage.income === 'PARTIAL' ? ' (일부 시즌만 집계)' : ''}`}
              </dd>
            </div>
            <div>
              <dt>복무 경로</dt>
              <dd>{SERVICE_LABEL[result.nationality.serviceStatus]}</dd>
            </div>
          </dl>
          <p>
            성인 대표팀 기록 {result.international.seniorCaps}회 · U23{' '}
            {result.international.youthAppearances}회 (별도 집계)
          </p>
          <LegacyScoreCard result={result} {...(onSourceClick ? { onSourceClick } : {})} />
        </section>
      ) : null}
      {terminal && mode === 'retirement' && archive ? (
        <section className="os-panel flex flex-col gap-os-3">
          <h2>구단과 최고의 시즌</h2>
          <ul>
            {archive.records.clubs.map((club) => (
              <li key={club.teamId}>
                {state.clubHistory.find((stint) => stint.teamId === club.teamId)?.teamName ??
                  club.teamId}{' '}
                · {club.totals.seasons}시즌 · {club.totals.playedMatches}경기
              </li>
            ))}
          </ul>
          <p>
            {bestSeason
              ? `최고 평점 시즌: ${bestSeason.index}시즌 · ${(bestSeason.result.playerStats.ratingSumTenths / bestSeason.result.playerStats.ratedMatches / 10).toFixed(1)}점`
              : '최고 평점 시즌: 10경기 이상 평점 기록이 쌓이면 표시합니다.'}
          </p>
          <p>동률이면 출전 시간, 이른 시즌 순으로 선택합니다.</p>
          <h3>트로피 {trophies.length}개</h3>
          {trophies.length ? (
            <ul>
              {trophies.map((trophy) => (
                <li key={`${trophy.season}:${trophy.id}`}>
                  {trophy.season}시즌 · {trophy.name}
                </li>
              ))}
            </ul>
          ) : (
            <p>우승만이 이 커리어의 가치는 아닙니다.</p>
          )}
        </section>
      ) : null}
      {mode === 'legacy' && result ? (
        <LegacyScoreCard result={result} {...(onSourceClick ? { onSourceClick } : {})} />
      ) : null}
      {mode === 'timeline' && terminal ? (
        <ol className="flex flex-col gap-os-3" aria-label="커리어 연대기">
          {timelineRevisions.map((revision) => (
            <li className="os-panel scroll-mt-20" id={`revision-${revision}`} key={revision}>
              <h2>{state.timeline.find((entry) => entry.revision === revision)?.age}세의 기록</h2>
              {state.timeline
                .filter((entry) => entry.revision === revision)
                .map((entry, index) => (
                  <p key={index}>{TIMELINE_KIND_LABEL_KO[entry.kind]}</p>
                ))}
              {state.seasonHistory
                .filter((season) => season.settledAtRevision === revision)
                .map((season) => (
                  <p key={season.index}>
                    {season.index}시즌 · 출전{' '}
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
                      : { GOLD: '금메달', SILVER: '은메달', BRONZE: '동메달' }[tournament.medal]}
                  </p>
                ))}
            </li>
          ))}
        </ol>
      ) : null}
      {mode === 'final-profile' && terminal && profile && result ? (
        <section className="os-panel flex flex-col gap-os-3">
          <h2>{profile.name}</h2>
          <p>
            선호 포지션 {POSITION_LABELS[profile.preferredPosition]} · 최종 포지션{' '}
            {POSITION_LABELS[profile.primaryPosition]}
          </p>
          <p>최종 OVR {profile.baseOvr}</p>
          <h3>커리어 태그</h3>
          {result.tags.length ? (
            <ul>
              {result.tags.map((tag) => (
                <li key={tag}>{CAREER_TAGS[tag].label}</li>
              ))}
            </ul>
          ) : (
            <p>아직 이름 붙지 않은 이야기라도, 모든 출전은 기록에 남습니다.</p>
          )}
          <p>보관된 기록은 새 플레이의 성장 수치에 더하지 않습니다.</p>
        </section>
      ) : null}
      {terminal ? (
        <nav aria-label="은퇴 결과" className="os-panel flex flex-wrap gap-os-3">
          <Link to="/career/$careerId/retirement" params={{ careerId }}>
            통산 기록
          </Link>
          <Link to="/career/$careerId/legacy" params={{ careerId }}>
            Legacy Score
          </Link>
          <Link to="/career/$careerId/timeline" params={{ careerId }}>
            연대기
          </Link>
          <Link to="/career/$careerId/final-profile" params={{ careerId }}>
            최종 프로필
          </Link>
          <Link to="/">선수 보관함 · 새 커리어</Link>
        </nav>
      ) : null}
    </div>
  );
}
