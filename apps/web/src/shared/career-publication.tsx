import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CareerArticleSchema, CareerPublicationStatusSchema } from '@offside/contracts';
import { Button } from '@offside/ui';
import { apiFetch } from '../api/client.js';
import { getSyncClient } from '../engine/sync.js';
import { platform } from '../platform/index.js';
import { CareerArticleView } from './career-article.js';

export function CareerPublication({ careerId }: { careerId: string }) {
  const cache = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [copied, setCopied] = useState(false);
  const key = ['career-publication', careerId];
  const path = `/v1/careers/${encodeURIComponent(careerId)}/publication`;
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const result = await apiFetch(path, {}, CareerPublicationStatusSchema);
      if (!result.ok) throw new Error(result.error.message);
      return result.data.article;
    },
  });
  const mutation = useMutation({
    mutationFn: async (action: 'publish' | 'revoke') => {
      if (action === 'publish') {
        await (await getSyncClient()).flush(careerId);
        const result = await apiFetch(
          path,
          { method: 'POST', body: JSON.stringify({ consent }) },
          CareerArticleSchema,
        );
        if (!result.ok) throw new Error(result.error.message);
        cache.setQueryData(key, result.data);
      } else {
        const result = await apiFetch(path, { method: 'DELETE' });
        if (!result.ok) throw new Error(result.error.message);
        cache.setQueryData(key, null);
        setConsent(false);
      }
      platform.analytics.track('growth_action', {
        action: action === 'publish' ? 'ARTICLE_PUBLISHED' : 'ARTICLE_REVOKED',
      });
    },
  });
  const article = query.data;
  const url = article ? `${window.location.origin}/articles/${article.id}` : '';
  return (
    <section className="os-panel os-publication-panel" aria-label="커리어 기사 공개">
      <h2>내 커리어를 기사로 남기기</h2>
      <p>
        선수 이름·경기 기록·최초 선수 설정과 같은 조건 도전이 링크를 아는 누구에게나 공개됩니다.
        계정·복구 정보와 전체 저장본은 공개하지 않습니다.
      </p>
      {article ? (
        <>
          <CareerArticleView article={article} />
          <p>
            <a href={url}>공개 기사 보기</a>
          </p>
          <label>
            공유 링크
            <input readOnly value={url} onFocus={(event) => event.target.select()} />
          </label>
          <Button
            onClick={() => {
              void navigator.clipboard
                .writeText(url)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? '링크 복사됨' : '링크 복사'}
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate('revoke')}>
            공개 취소
          </Button>
          <p>
            공개를 취소하면 이 링크로 기사 보기와 새 도전 시작이 종료됩니다. 이미 시작된 다른 사람의
            커리어와 외부에 복사된 내용은 지워지지 않습니다.
          </p>
        </>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            선수 이름과 위 기록의 공개에 동의합니다.
          </label>
          <Button
            disabled={!consent || mutation.isPending}
            onClick={() => mutation.mutate('publish')}
          >
            {mutation.isPending ? '기록 확인 중…' : '기사 공개하기'}
          </Button>
        </>
      )}
      {(query.error || mutation.error) && (
        <p role="alert">{mutation.error?.message ?? query.error?.message}</p>
      )}
    </section>
  );
}
