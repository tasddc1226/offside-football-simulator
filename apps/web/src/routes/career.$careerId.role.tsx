// SCR-012 포지션·역할 변경 제안: `RESOLVE_ROLE`로만 닫히는 감독 제안 화면. `pending.proposal.type`
// 셋(KEEP·POSITION_CHANGE·ROLE_CHANGE)마다 표시가 다르다. "조건부 훈련"(02 명세)은 이 Phase에
// 도메인 명령이 없어 두지 않는다(PR 본문 참고).
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  Button,
  CompareCards,
  ErrorState,
  ScreenIntro,
  type CompareCardItem,
  type CompareRow,
} from '@offside/ui';
import { deriveTacticalRoom, type TacticalRoomView } from '@offside/domain';
import { rulesetForCareer } from '../engine/content.js';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import {
  POSITION_LABELS,
  ROLE_PROMISE_SENTENCE,
  SELECTION_REASON_LABEL_KO,
  SQUAD_ROLE_LABELS,
} from '../shared/labels.js';
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

const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

/**
 * 이슈 145: 제안 사유. 도메인이 이미 계산해 둔 값만 문구로 옮긴다 — 제안은 `season.selection`
 * (rankSelection 결과: 경쟁 순위·선발/벤치 자리 수·경계 후보와 가장 큰 차이 항목)과 전술 적합도·
 * 감독 신뢰·폼(선발 점수 입력)에서 나온다. 새 규칙 계산은 하지 않는다.
 */
function ProposalReason({ room, form }: { room: TacticalRoomView | null; form: number }) {
  if (room === null) return null;
  const player = room.ranking.candidates.find((candidate) => candidate.id === 'PLAYER');
  const reason = room.ranking.playerReason;
  const rankLine =
    player === undefined
      ? null
      : `경쟁 순위 ${player.rank}위 (선발 ${room.ranking.slots}자리 · 벤치 ${room.ranking.benchSlots}자리)`;
  const inputsLine = `전술 적합도 ${room.tacticalFit} · 감독 신뢰 ${room.managerTrust} · 폼 ${form}`;
  const gapLine =
    reason === null
      ? null
      : `경계 후보와 가장 큰 차이: ${SELECTION_REASON_LABEL_KO[reason.component]} ${reason.delta > 0 ? '+' : ''}${reason.delta}`;
  return (
    <div className="flex flex-col gap-os-1" data-testid="role-proposal-reason">
      <p className="os-eyebrow">제안 사유</p>
      {rankLine !== null ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {rankLine}
        </p>
      ) : null}
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        {inputsLine}
      </p>
      {gapLine !== null ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {gapLine}
        </p>
      ) : null}
    </div>
  );
}

function RoleProposalScreen() {
  const { careerId } = Route.useParams();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const resolveMutation = useCareerMutation('resolveRole');
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-012',
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.data === undefined) return null;
  const { state } = query.data;
  const pending = state.pending;
  if (pending === null || pending.kind !== 'ROLE_PROPOSAL') return null; // 라우트 loader가 보장한다. 방어적 fallback.
  const ruleset = rulesetForCareer(state);

  const proposal = pending.proposal;
  const room = deriveTacticalRoom(state, ruleset);
  const playerRank =
    room?.ranking.candidates.find((candidate) => candidate.id === 'PLAYER')?.rank ?? null;

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
      <div className="os-screen">
        <ScreenIntro
          eyebrow="MANAGER'S OFFICE"
          title="감독 제안"
          description="감독이 생각하는 팀에서의 내 역할이에요."
        />
        <div className="os-story-card flex flex-col gap-os-3">
          <p className="os-eyebrow">현재 역할 유지</p>
          <p className="font-os text-os-text" style={BODY_STYLE}>
            감독은 {POSITION_LABELS[proposal.position]}·{SQUAD_ROLE_LABELS[proposal.squadRole]}을
            유지하자고 합니다.
          </p>
        </div>
        {errorMessage ? (
          <ErrorState message={errorMessage} onRetry={() => void handleDecision('ACCEPT')} />
        ) : null}
        <div className="os-action-dock">
          <Button
            variant="primary"
            disabled={committing}
            onClick={() => void handleDecision('ACCEPT')}
          >
            확인
          </Button>
        </div>
      </div>
    );
  }

  if (proposal.type === 'POSITION_CHANGE') {
    const cards: CompareCardItem[] = [
      { id: 'current', title: '현재' },
      { id: 'proposed', title: '제안' },
    ];
    const rows: CompareRow[] = [
      {
        id: 'position',
        label: '포지션',
        cells: [
          { value: POSITION_LABELS[proposal.from] },
          { value: POSITION_LABELS[proposal.to], highlighted: true },
        ],
      },
      {
        id: 'tacticalFit',
        label: '전술 적합도',
        cells: [
          { value: String(state.context.tacticalFit) },
          { value: String(proposal.tacticalFitAfter), highlighted: true },
        ],
      },
      {
        id: 'proficiency',
        label: '포지션 숙련도',
        cells: [
          { value: String(state.context.positionProficiency) },
          { value: String(proposal.proficiencyAfter), highlighted: true },
        ],
      },
      {
        id: 'role',
        label: '역할',
        cells: [
          { value: SQUAD_ROLE_LABELS[state.season?.squadRole ?? proposal.squadRoleAfter] },
          { value: SQUAD_ROLE_LABELS[proposal.squadRoleAfter], highlighted: true },
        ],
      },
      {
        id: 'ranking',
        label: '경쟁 순위',
        cells: [{ value: playerRank === null ? '—' : `${playerRank}위` }, { value: '—' }],
      },
    ];

    return (
      <div className="os-screen">
        <ScreenIntro
          eyebrow="MANAGER'S OFFICE"
          title="포지션 변경 제안"
          description="다른 자리에서 기회를 찾을 수 있을까요? 현재 조건과 제안을 비교해 보세요."
        />
        <CompareCards cards={cards} rows={rows} />
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          능력치는 바뀌지 않고 역할 가중치와 숙련도만 바뀝니다.
        </p>
        {room !== null ? (
          <div className="os-story-card">
            <ProposalReason room={room} form={state.state.form} />
          </div>
        ) : null}
        {errorMessage ? (
          <ErrorState message={errorMessage} onRetry={() => void handleDecision('ACCEPT')} />
        ) : null}
        <div className="os-action-dock flex flex-col gap-os-2">
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            거절하면 감독 신뢰가 내려갈 수 있습니다.
          </p>
          <div className="grid grid-cols-2 gap-os-2">
            <Button
              variant="secondary"
              disabled={committing}
              onClick={() => void handleDecision('DECLINE')}
            >
              거절
            </Button>
            <Button
              variant="primary"
              disabled={committing}
              onClick={() => void handleDecision('ACCEPT')}
            >
              수락
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // proposal.type === 'ROLE_CHANGE'
  return (
    <div className="os-screen">
      <ScreenIntro
        eyebrow="MANAGER'S OFFICE"
        title="역할 변경 제안"
        description="팀에서 맡게 될 역할과 출전 약속을 확인해 보세요."
      />
      <div className="os-story-card flex flex-col gap-os-3">
        <p className="os-eyebrow">감독의 새로운 구상</p>
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          현재 약속: {SQUAD_ROLE_LABELS[proposal.from]} → 제안: {SQUAD_ROLE_LABELS[proposal.to]}
        </p>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {ROLE_PROMISE_SENTENCE[proposal.to]}
        </p>
        <ProposalReason room={room} form={state.state.form} />
      </div>
      {errorMessage ? (
        <ErrorState message={errorMessage} onRetry={() => void handleDecision('ACCEPT')} />
      ) : null}
      <div className="os-action-dock flex flex-col gap-os-2">
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          거절하면 감독 신뢰가 내려갈 수 있습니다.
        </p>
        <div className="grid grid-cols-2 gap-os-2">
          <Button
            variant="secondary"
            disabled={committing}
            onClick={() => void handleDecision('DECLINE')}
          >
            거절
          </Button>
          <Button
            variant="primary"
            disabled={committing}
            onClick={() => void handleDecision('ACCEPT')}
          >
            수락
          </Button>
        </div>
      </div>
    </div>
  );
}
