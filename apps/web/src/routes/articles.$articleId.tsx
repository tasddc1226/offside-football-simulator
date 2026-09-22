import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CareerArticleSchema, GetCareerResponseSchema } from '@offside/contracts';
import { loadRuleset } from '@offside/content';
import { importCareerFromServer } from '@offside/engine-client';
import { Button } from '@offside/ui';
import { apiFetch } from '../api/client.js';
import { assertAnnualOwner, cacheAnnualCareer } from '../engine/annual.js';
import { ensureProfile } from '../api/profile.js';
import { getAppEngine } from '../engine/engine.js';
import { advance } from '../engine/career-actions.js';
import { startCareerFunnel, recordFunnelReached } from '../engine/funnel.js';
import { screenForCareer } from '../shared/career-route.js';
import { CareerArticleView } from '../shared/career-article.js';
import { SCREEN_ROUTES } from '../routes.js';
import { platform } from '../platform/index.js';

export const Route = createFileRoute('/articles/$articleId')({ component: ArticlePage });
function ArticlePage() {
  const { articleId } = Route.useParams();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const requestKey = useRef(crypto.randomUUID());
  const ownerIntent = useRef<string | null>(null);
  const lifetime = useRef(new AbortController());
  useEffect(() => {
    const abort = new AbortController();
    lifetime.current = abort;
    return () => abort.abort();
  }, [articleId]);
  const viewed = useRef(false);
  const query = useQuery({
    queryKey: ['public-article', articleId],
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const result = await apiFetch(
        `/v1/articles/${encodeURIComponent(articleId)}`,
        { cache: 'no-store' },
        CareerArticleSchema,
      );
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow';
    document.head.append(tag);
    return () => tag.remove();
  }, []);
  useEffect(() => {
    if (query.data && !viewed.current) {
      viewed.current = true;
      platform.analytics.track('growth_action', { action: 'ARTICLE_VIEWED' });
    }
  }, [query.data]);
  const challenge = useMutation({
    mutationFn: async () => {
      const signal = lifetime.current.signal;
      const engine = await getAppEngine();
      if (!(await ensureProfile(engine.store, cache)))
        throw new Error('연결을 확인한 뒤 다시 시도해 주세요.');
      const profileId = await engine.store.transaction('readonly', (tx) =>
        tx.kv.get<string>('profile:id'),
      );
      if (!profileId) throw new Error('프로필을 확인해 주세요.');
      if (ownerIntent.current && ownerIntent.current !== profileId)
        throw new Error('프로필이 변경되었습니다. 기사를 다시 열어 주세요.');
      ownerIntent.current = profileId;
      const result = await apiFetch(
        `/v1/articles/${encodeURIComponent(articleId)}/challenge`,
        {
          method: 'POST',
          signal,
          headers: { 'Idempotency-Key': requestKey.current },
          body: JSON.stringify({ name, expectedProfileId: ownerIntent.current }),
        },
        GetCareerResponseSchema,
      );
      if (!result.ok) throw new Error(result.error.message);
      if (signal.aborted) throw new Error('화면이 변경되어 응답을 사용하지 않았습니다.');
      const careerId = result.data.snapshot.careerId;
      if (result.data.authority === 'SERVER_ANNUAL') {
        await assertAnnualOwner(profileId, signal);
        await cacheAnnualCareer(profileId, careerId, signal);
        await navigate({ to: '/career/$careerId', params: { careerId } });
        return;
      }
      let loaded = await engine.client.loadCareer(careerId);
      if (!loaded.ok) {
        if (loaded.error.code !== 'CAREER_NOT_FOUND') throw new Error(loaded.error.message);
        const imported = await importCareerFromServer(engine.store, result.data, {
          rulesetForVersion: loadRuleset,
          now: new Date().toISOString(),
        });
        if (!imported.ok) throw new Error(imported.error.message);
        await startCareerFunnel(engine, careerId);
        await recordFunnelReached(careerId, 'PLAYER_CONFIRMED');
        platform.analytics.track('growth_action', { action: 'CHALLENGE_STARTED' });
        loaded = await engine.client.loadCareer(careerId);
      }
      if (!loaded.ok) throw new Error(loaded.error.message);
      if (
        loaded.career.rulesetVersion !== result.data.snapshot.rulesetVersion ||
        loaded.career.contentPackVersion !== result.data.snapshot.contentPackVersion
      )
        throw new Error('저장된 도전의 버전이 일치하지 않습니다.');
      // Enter the same normal authored first-career path, not a custom challenge simulation.
      let state = loaded.snapshot.state;
      if (loaded.snapshot.revision === result.data.snapshot.revision) {
        const next = await advance(engine, careerId);
        if (!next.ok) throw new Error(next.error.message);
        state = next.domainSnapshot.state;
      }
      await cache.invalidateQueries({ queryKey: ['careers'] });
      const target = screenForCareer(state);
      await navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    },
  });
  if (query.isPending) return <p role="status">커리어 기사를 불러오고 있어요.</p>;
  if (query.isError)
    return (
      <section className="os-panel">
        <h1>기사를 볼 수 없어요</h1>
        <p role="alert">{query.error.message}</p>
        <Link to="/">홈으로</Link>
      </section>
    );
  return (
    <div className="os-article-stack">
      <CareerArticleView article={query.data} />
      <section className="os-panel os-publication-panel">
        <h2>나라면 어떤 커리어를 만들까?</h2>
        <p>
          같은 최초 선수 설정과 출발 조건으로 시작합니다. 이후 선택은 자유롭고 결과는 달라질 수
          있어요.
        </p>
        <details>
          <summary>고정된 도전 조건</summary>
          <p>
            룰셋 {query.data.challenge.rulesetVersion} · 콘텐츠{' '}
            {query.data.challenge.contentPackVersion} · {query.data.challenge.simulationMode} 모드
          </p>
        </details>
        <p>원본 선수의 진행·소유권과 분리된 새 커리어가 내 보관함에 저장됩니다.</p>
        <label>
          새 선수 이름
          <input
            value={name}
            disabled={challenge.isPending}
            maxLength={20}
            onChange={(event) => {
              setName(event.target.value);
              requestKey.current = crypto.randomUUID();
            }}
          />
        </label>
        <Button disabled={challenge.isPending || !name.trim()} onClick={() => challenge.mutate()}>
          {challenge.isPending ? '도전 준비 중…' : '같은 조건으로 시작'}
        </Button>
        {challenge.error && <p role="alert">{challenge.error.message}</p>}
      </section>
    </div>
  );
}
