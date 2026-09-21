import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  CompetitionActionResponseSchema,
  CompetitionDailyResponseSchema,
  CompetitionHistoryResponseSchema,
  CompetitionWeeklyResponseSchema,
} from '@offside/contracts';
import { Button } from '@offside/ui';
import { apiFetch } from '../api/client.js';
import '../shared/competition.css';

export const Route = createFileRoute('/competition')({ component: CompetitionScreen });

export function CompetitionScreen() {
  const cache = useQueryClient();
  const daily = useQuery({
    queryKey: ['competition-daily'],
    queryFn: async () => {
      const response = await apiFetch('/v1/competition/daily', {}, CompetitionDailyResponseSchema);
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
  const weekly = useQuery({
    queryKey: ['competition-weekly'],
    queryFn: async () => {
      const response = await apiFetch('/v1/competition/weekly', {}, CompetitionWeeklyResponseSchema);
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
  const history = useQuery({
    queryKey: ['competition-history'],
    queryFn: async () => {
      const response = await apiFetch('/v1/competition/history', {}, CompetitionHistoryResponseSchema);
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
  const submit = useMutation({
    mutationFn: async ({ actionId, expectedRevision }: { actionId: string; expectedRevision: number }) => {
      const response = await apiFetch(
        `/v1/competition/challenges/${encodeURIComponent(daily.data!.challenge.id)}/actions`,
        {
          method: 'POST',
          body: JSON.stringify({ actionId, expectedRevision }),
        },
        CompetitionActionResponseSchema,
      );
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (result) => {
      cache.setQueryData(['competition-daily'], (old: typeof daily.data | undefined) =>
        old ? { ...old, entry: result.entry } : old,
      );
      if (result.entry.completed) void cache.invalidateQueries({ queryKey: ['competition-weekly'] });
    },
  });
  const visibility = useMutation({
    mutationFn: async (next: boolean) => {
      const response = await apiFetch('/v1/competition/leaderboard/visibility', {
        method: 'PUT',
        body: JSON.stringify({ publicOptIn: next }),
      });
      if (!response.ok) throw new Error(response.error.message);
      return next;
    },
    onSuccess: (next) => {
      cache.setQueryData(['competition-daily'], (old: typeof daily.data | undefined) =>
        old && old.entry ? { ...old, entry: { ...old.entry, publicOptIn: next } } : old,
      );
      void cache.invalidateQueries({ queryKey: ['competition-weekly'] });
    },
  });
  if (daily.isPending) return <main className="competition" role="status">오늘의 도전을 불러오는 중…</main>;
  if (daily.isError) return <main className="competition" role="alert"><h1>오늘의 도전을 열 수 없습니다</h1><p>{daily.error.message}</p><Button onClick={() => void daily.refetch()}>다시 불러오기</Button></main>;
  const challenge = daily.data.challenge;
  const entry = daily.data.entry;
  const stepIndex = entry?.revision ?? 0;
  const currentStep = challenge.scenario.steps[stepIndex];
  return (
    <main className="competition">
      <header>
        <p className="os-eyebrow">DAILY MATCH IQ</p>
        <h1>{challenge.scenario.title}</h1>
        <p>{challenge.scenario.intro}</p>
        <p className="competition-note">{challenge.dayKey} KST · {challenge.scenario.position} 포지션 · {challenge.scenario.opponentName} 상대 · {challenge.rulesetVersion}/{challenge.contentPackVersion} 고정</p>
        <Link to="/">홈으로</Link>
      </header>
      {entry?.completed ? (
        <section className="competition-card" aria-label="오늘의 제출 결과">
          <h2>오늘의 기록</h2>
          <p className="competition-score">{entry.score} <small>/ {entry.maxScore}점</small></p>
          <p>실제 경기 기록 · {entry.evidence?.minutes ?? 0}분 · 평점 {entry.evidence?.ratingTenths === null || entry.evidence?.ratingTenths === undefined ? '미산정' : (entry.evidence.ratingTenths / 10).toFixed(1)} · {entry.evidence?.outcome ?? '기록 없음'}</p>
          {entry.evidence?.positionStats ? <p className="competition-note">{Object.entries(entry.evidence.positionStats).filter(([key]) => key !== 'group').map(([key, value]) => `${key} ${String(value)}`).join(' · ')}</p> : null}
          <details><summary>검증 상세</summary><p className="competition-note">서버가 실제 경기 기록으로 검증했습니다. 결과 증명 {entry.resultHash?.slice(0, 12)}…</p></details>
          <p className="competition-note">하루 한 번만 제출할 수 있습니다. 선택 기록과 경기 원본은 비공개입니다.</p>
          <Button variant="secondary" disabled={visibility.isPending} onClick={() => visibility.mutate(!entry.publicOptIn)}>
            {entry.publicOptIn ? '주간 랭킹에서 숨기기' : '주간 랭킹에 공개하기'}
          </Button>
          {visibility.isError && <p role="alert">{visibility.error.message}</p>}
        </section>
      ) : (
        <section className="competition-card" aria-label="오늘의 도전">
          <h2>세 장면, 서버가 한 단계씩 반영</h2>
          {entry && entry.actionIds.length > 0 && <p className="competition-note">앞선 {entry.actionIds.length}개 행동은 저장되었습니다. 다음 행동만 제출할 수 있습니다.</p>}
          {currentStep ? (
            <fieldset disabled={submit.isPending}>
              <legend>{stepIndex + 1}. {currentStep.title}</legend>
              <p>{currentStep.prompt}</p>
              {currentStep.choices.map((choice) => (
                <label className="competition-choice" key={choice.id}>
                  <input type="radio" name={currentStep.id} disabled={submit.isPending} onChange={() => submit.mutate({ actionId: choice.id, expectedRevision: stepIndex })} />
                  <span><strong>{choice.label}</strong><small>{choice.description}</small></span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {submit.isError && <p role="alert">{submit.error.message}</p>}
          <p className="competition-note">{challenge.scenario.scorePolicy.description}</p>
          <p className="competition-note">완료 후 안전한 별칭으로 주간 랭킹 공개 여부를 선택할 수 있습니다.</p>
        </section>
      )}
      <section className="competition-card" aria-label="주간 랭킹">
        <h2>이번 주 랭킹</h2>
        <p className="competition-note">동점은 같은 순위입니다. 이름·계정 대신 안전한 별칭만 표시합니다.</p>
        {weekly.isError && <p role="alert">{weekly.error.message}</p>}
        {weekly.data?.rows.length === 0 && <p>아직 공개된 기록이 없습니다.</p>}
        {weekly.data && weekly.data.rows.length > 0 && <ol className="competition-ranking">{weekly.data.rows.map((row) => <li key={`${row.rank}:${row.alias}`}><strong>{row.rank}위 · {row.alias}</strong><span>{row.score}/{row.maxScore}점 · {row.challengeDays}일 참여</span></li>)}</ol>}
      </section>
      <section className="competition-card" aria-label="내 최근 기록">
        <h2>내 최근 기록</h2>
        {history.isError && <p role="alert">{history.error.message}</p>}
        {history.data?.entries.length === 0 && <p className="competition-note">아직 완료한 도전이 없습니다.</p>}
        {history.data && history.data.entries.length > 0 && <ul className="competition-ranking">{history.data.entries.slice(0, 7).map((item) => <li key={`${item.challengeId}:${item.revision}`}><strong>{item.dayKey}</strong><span>{item.score ?? '진행 중'}{item.evidence ? ` · ${item.evidence.minutes}분 · ${item.evidence.outcome}` : ''}</span></li>)}</ul>}
      </section>
    </main>
  );
}
