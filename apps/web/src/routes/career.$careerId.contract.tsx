// SCR-010 신인 계약 사인. offerId가 pending.offers에 없거나(이미 계약을 맺어 pending이 null이 된
// 경우 포함) screenForCareer로 redirect한다 — 사인 뒤 뒤로 가기가 계약을 재생성하지 않는다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Button, ErrorState } from '@offside/ui';
import { recordFunnelReached } from '../engine/funnel.js';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { LEAGUE_TIER_LABEL_KO, ROLE_PROMISE_SENTENCE, SQUAD_ROLE_LABELS } from '../shared/labels.js';
import { formatKrw } from '../shared/format.js';
import { platform } from '../platform/index.js';

type ContractSearch = { offerId: string };

export const Route = createFileRoute('/career/$careerId/contract')({
  validateSearch: (search: Record<string, unknown>): ContractSearch => ({
    offerId: typeof search.offerId === 'string' ? search.offerId : '',
  }),
  loaderDeps: ({ search }) => ({ offerId: search.offerId }),
  loader: async ({ params, deps }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const pending = state.pending;
    const offer =
      pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT' ? pending.offers.find((candidate) => candidate.id === deps.offerId) : undefined;
    if (offer === undefined) {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: ContractScreen,
});

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

function ContractScreen() {
  const { careerId } = Route.useParams();
  const { offerId } = Route.useSearch();
  const query = useCareer(careerId);
  const acceptMutation = useCareerMutation('acceptOffer');
  const navigate = useNavigate();
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-010', careerPhase: query.data?.state.seasonPhase ?? 'NONE' });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.data === undefined) return null;

  const { state } = query.data;
  const pending = state.pending;
  const offer = pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT' ? pending.offers.find((candidate) => candidate.id === offerId) : undefined;
  if (offer === undefined) {
    // 라우트 loader가 이미 screenForCareer로 redirect했어야 한다. 방어적 fallback.
    return null;
  }

  const playerName = state.player.profile?.name ?? state.player.draft.name ?? '선수';

  async function handleSign() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    try {
      const result = await acceptMutation.mutateAsync({ careerId, offerId });
      if (!result.ok) {
        setErrorMessage('계약을 맺지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      await recordFunnelReached(careerId, 'CONTRACT_SIGNED');
      void navigate({ to: '/career/$careerId', params: { careerId }, search: { signed: true } });
    } catch {
      setErrorMessage('계약을 맺지 못했습니다. 다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
    }
  }

  function handleBack() {
    void navigate({ to: '/career/$careerId/offers', params: { careerId } });
  }

  return (
    <div className="flex flex-col gap-os-6">
      <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
        {offer.teamName} 계약
      </h1>

      <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
        <div>
          <dt>리그</dt>
          <dd className="text-os-text">{LEAGUE_TIER_LABEL_KO[offer.leagueTier]}</dd>
        </div>
        <div>
          <dt>기간</dt>
          <dd className="os-num text-os-text">{offer.lengthSeasons}시즌</dd>
        </div>
        <div>
          <dt>주급</dt>
          <dd className="os-num text-os-text">{formatKrw(offer.wageMinorPerWeek)}</dd>
        </div>
        <div>
          <dt>계약금</dt>
          <dd className="os-num text-os-text">{formatKrw(offer.signingBonusMinor)}</dd>
        </div>
        <div>
          <dt>역할 약속</dt>
          <dd className="text-os-text">{SQUAD_ROLE_LABELS[offer.rolePromise]}</dd>
        </div>
        <div>
          <dt>등번호</dt>
          <dd className="os-num text-os-text">{offer.shirtNumber}</dd>
        </div>
      </dl>

      <p className="font-os text-os-text" style={BODY_STYLE}>
        {ROLE_PROMISE_SENTENCE[offer.rolePromise]}
      </p>

      <div className="flex flex-col gap-os-1">
        <p className="font-os font-bold text-os-text" style={BODY_STYLE}>
          {playerName}
        </p>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          자동 서명으로 처리됩니다. 손글씨 서명은 이후 지원됩니다.
        </p>
      </div>

      {errorMessage ? <ErrorState message={errorMessage} onRetry={handleSign} /> : null}

      <div className="flex gap-os-3">
        <Button variant="secondary" onClick={handleBack}>
          뒤로
        </Button>
        <Button variant="primary" onClick={handleSign} disabled={acceptMutation.isPending}>
          사인
        </Button>
      </div>
    </div>
  );
}
