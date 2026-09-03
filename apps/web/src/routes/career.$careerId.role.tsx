// SCR-012 포지션·역할 변경 제안: `RESOLVE_ROLE`로만 닫히는 감독 제안 화면. `pending.proposal.type`
// 셋(KEEP·POSITION_CHANGE·ROLE_CHANGE)마다 표시가 다르다. "조건부 훈련"(02 명세)은 이 Phase에
// 도메인 명령이 없어 두지 않는다(PR 본문 참고).
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Button, CompareCards, ErrorState, type CompareCardItem, type CompareRow } from '@offside/ui';
import { deriveTacticalRoom } from '@offside/domain';
import { activeRuleset } from '../engine/content.js';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import { POSITION_LABELS, ROLE_PROMISE_SENTENCE, SQUAD_ROLE_LABELS } from '../shared/labels.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { platform } from '../platform/index.js';

export const Route = createFileRoute('/career/$careerId/role')({
  loader: async ({ params }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    if (state.pending === null || state.pending.kind !== 'ROLE_PROPOSAL') {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: RoleProposalScreen,
});

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

function RoleProposalScreen() {
  const { careerId } = Route.useParams();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const resolveMutation = useCareerMutation('resolveRole');
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-012', careerPhase: query.data?.state.seasonPhase ?? 'NONE' });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.data === undefined) return null;
  const { state } = query.data;
  const pending = state.pending;
  if (pending === null || pending.kind !== 'ROLE_PROPOSAL') return null; // 라우트 loader가 보장한다. 방어적 fallback.

  const proposal = pending.proposal;
  const room = deriveTacticalRoom(state, activeRuleset);
  const playerRank = room?.ranking.candidates.find((candidate) => candidate.id === 'PLAYER')?.rank ?? null;

  async function handleDecision(decision: 'ACCEPT' | 'DECLINE') {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    try {
      const result = await resolveMutation.mutateAsync({ careerId, decision });
      if (!result.ok) {
        setErrorMessage('결정을 확정하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      platform.analytics.track('role_proposal_resolved', { type: proposal.type, decision });
      const target = screenForCareer(result.domainSnapshot.state);
      void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    } catch {
      setErrorMessage('결정을 확정하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
    }
  }

  const committing = resolveMutation.isPending;

  if (proposal.type === 'KEEP') {
    return (
      <div className="flex flex-col gap-os-6">
        <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
          감독 제안
        </h1>
        <p className="font-os text-os-text" style={BODY_STYLE}>
          감독은 {POSITION_LABELS[proposal.position]}·{SQUAD_ROLE_LABELS[proposal.squadRole]}을 유지하자고 합니다.
        </p>
        {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void handleDecision('ACCEPT')} /> : null}
        <Button variant="primary" disabled={committing} onClick={() => void handleDecision('ACCEPT')}>
          확인
        </Button>
      </div>
    );
  }

  if (proposal.type === 'POSITION_CHANGE') {
    const cards: CompareCardItem[] = [
      { id: 'current', title: '현재' },
      { id: 'proposed', title: '제안' },
    ];
    const rows: CompareRow[] = [
      { id: 'position', label: '포지션', cells: [{ value: POSITION_LABELS[proposal.from] }, { value: POSITION_LABELS[proposal.to], highlighted: true }] },
      {
        id: 'tacticalFit',
        label: '전술 적합도',
        cells: [{ value: String(state.context.tacticalFit) }, { value: String(proposal.tacticalFitAfter), highlighted: true }],
      },
      {
        id: 'proficiency',
        label: '포지션 숙련도',
        cells: [{ value: String(state.context.positionProficiency) }, { value: String(proposal.proficiencyAfter), highlighted: true }],
      },
      {
        id: 'role',
        label: '역할',
        cells: [{ value: SQUAD_ROLE_LABELS[state.season?.squadRole ?? proposal.squadRoleAfter] }, { value: SQUAD_ROLE_LABELS[proposal.squadRoleAfter], highlighted: true }],
      },
      {
        id: 'ranking',
        label: '경쟁 순위',
        cells: [{ value: playerRank === null ? '—' : `${playerRank}위` }, { value: '—' }],
      },
    ];

    return (
      <div className="flex flex-col gap-os-6">
        <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
          포지션 변경 제안
        </h1>
        <CompareCards cards={cards} rows={rows} />
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          능력치는 바뀌지 않고 역할 가중치와 숙련도만 바뀝니다.
        </p>
        {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void handleDecision('ACCEPT')} /> : null}
        <div className="flex flex-col gap-os-1">
          <div className="flex gap-os-3">
            <Button variant="secondary" disabled={committing} onClick={() => void handleDecision('DECLINE')}>
              거절
            </Button>
            <Button variant="primary" disabled={committing} onClick={() => void handleDecision('ACCEPT')}>
              수락
            </Button>
          </div>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            거절하면 감독 신뢰가 내려갈 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  // proposal.type === 'ROLE_CHANGE'
  return (
    <div className="flex flex-col gap-os-6">
      <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
        역할 변경 제안
      </h1>
      <p className="font-os text-os-text" style={BODY_STYLE}>
        현재 약속: {SQUAD_ROLE_LABELS[proposal.from]} → 제안: {SQUAD_ROLE_LABELS[proposal.to]}
      </p>
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        {ROLE_PROMISE_SENTENCE[proposal.to]}
      </p>
      {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void handleDecision('ACCEPT')} /> : null}
      <div className="flex flex-col gap-os-1">
        <div className="flex gap-os-3">
          <Button variant="secondary" disabled={committing} onClick={() => void handleDecision('DECLINE')}>
            거절
          </Button>
          <Button variant="primary" disabled={committing} onClick={() => void handleDecision('ACCEPT')}>
            수락
          </Button>
        </div>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          거절하면 감독 신뢰가 내려갈 수 있습니다.
        </p>
      </div>
    </div>
  );
}
