import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  CompetitionDailyResponseSchema,
  CompetitionEntrySchema,
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
      const response = await apiFetch(
        '/v1/competition/weekly',
        {},
        CompetitionWeeklyResponseSchema,
      );
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
  const [actions, setActions] = useState<string[]>([]);
  const [publicOptIn, setPublicOptIn] = useState(false);
  const submit = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(
        `/v1/competition/challenges/${encodeURIComponent(daily.data!.challenge.id)}/entries`,
        {
          method: 'POST',
          body: JSON.stringify({ actionIds: actions, publicOptIn }),
        },
        CompetitionEntrySchema,
      );
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (entry) => {
      cache.setQueryData(['competition-daily'], (old: typeof daily.data | undefined) =>
        old ? { ...old, entry } : old,
      );
      void cache.invalidateQueries({ queryKey: ['competition-weekly'] });
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
  if (daily.isPending)
    return (
      <main className="competition" role="status">
        오늘의 도전을 불러오는 중…
      </main>
    );
  if (daily.isError)
    return (
      <main className="competition" role="alert">
        <h1>오늘의 도전을 열 수 없습니다</h1>
        <p>{daily.error.message}</p>
        <Button onClick={() => void daily.refetch()}>다시 불러오기</Button>
      </main>
    );
  const challenge = daily.data.challenge;
  const entry = daily.data.entry;
  const choose = (index: number, choiceId: string) =>
    setActions((current) => {
      const next = [...current];
      next[index] = choiceId;
      return next;
    });
  return (
    <main className="competition">
      <header>
        <p className="os-eyebrow">DAILY MATCH IQ</p>
        <h1>{challenge.scenario.title}</h1>
        <p>{challenge.scenario.intro}</p>
        <Link to="/">홈으로</Link>
      </header>
      <p className="competition-note">
        {challenge.dayKey} KST · {challenge.rulesetVersion}/{challenge.contentPackVersion} 고정 ·{' '}
        서버가 선택과 점수를 다시 계산합니다.
      </p>
      {entry ? (
        <section className="competition-card" aria-label="오늘의 제출 결과">
          <h2>오늘의 기록</h2>
          <p className="competition-score">
            {entry.score} <small>/ {entry.maxScore}점</small>
          </p>
          <p>서버 재경기 검증 완료 · 결과 증명 {entry.resultHash.slice(0, 12)}…</p>
          <p className="competition-note">
            하루 한 번만 제출할 수 있습니다. 선택 기록은 비공개입니다.
          </p>
          <Button
            variant="secondary"
            disabled={visibility.isPending}
            onClick={() => visibility.mutate(!entry.publicOptIn)}
          >
            {entry.publicOptIn ? '주간 랭킹에서 숨기기' : '주간 랭킹에 공개하기'}
          </Button>
          {visibility.isError && <p role="alert">{visibility.error.message}</p>}
        </section>
      ) : (
        <section className="competition-card" aria-label="오늘의 도전">
          <h2>세 장면, 한 번의 제출</h2>
          {challenge.scenario.steps.map((step, index) => (
            <fieldset key={step.id} disabled={submit.isPending}>
              <legend>
                {index + 1}. {step.title}
              </legend>
              <p>{step.prompt}</p>
              {step.choices.map((choice) => (
                <label className="competition-choice" key={choice.id}>
                  <input
                    type="radio"
                    name={step.id}
                    checked={actions[index] === choice.id}
                    onChange={() => choose(index, choice.id)}
                  />
                  <span>
                    <strong>{choice.label}</strong>
                    <small>
                      {choice.description} · {choice.points}점
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
          <label className="competition-opt-in">
            <input
              type="checkbox"
              checked={publicOptIn}
              onChange={(event) => setPublicOptIn(event.target.checked)}
            />
            주간 랭킹에 안전한 별칭으로 공개하기 (이름·계정은 공개하지 않음)
          </label>
          <Button
            disabled={actions.length !== challenge.scenario.steps.length || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? '서버에서 판정 중…' : '기록 제출'}
          </Button>
          {submit.isError && <p role="alert">{submit.error.message}</p>}
          <p className="competition-note">{challenge.scenario.scorePolicy.description}</p>
        </section>
      )}
      <section className="competition-card" aria-label="주간 랭킹">
        <h2>이번 주 랭킹</h2>
        <p className="competition-note">동점은 같은 순위입니다. 다음 순위는 건너뜁니다.</p>
        {weekly.isError && <p role="alert">{weekly.error.message}</p>}
        {weekly.data?.rows.length === 0 && <p>아직 공개된 기록이 없습니다.</p>}
        {weekly.data && weekly.data.rows.length > 0 && (
          <ol className="competition-ranking">
            {weekly.data.rows.map((row) => (
              <li key={`${row.rank}:${row.alias}`}>
                <strong>
                  {row.rank}위 · {row.alias}
                </strong>
                <span>
                  {row.score}/{row.maxScore}점 · {row.challengeDays}일 참여
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
