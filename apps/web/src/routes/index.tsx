// SCR-001 홈·커리어 허브.
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogTrigger,
  EmptyState,
  ErrorState,
  FootballMark,
  ScreenIntro,
  Skeleton,
  Toast,
} from '@offside/ui';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import type { ServiceSeasonCurrent } from '@offside/contracts';
import { trackCareerAbandonedHint } from '../engine/funnel.js';
import { useServiceSeason } from '../engine/service-season.js';
import {
  careersQueryOptions,
  useCareerList,
  useCareerMutation,
  type CareerSummary,
} from '../engine/use-career.js';
import { useSyncState } from '../engine/use-sync.js';
import { screenForCareer } from '../shared/career-route.js';
import { SCREEN_ROUTES } from '../routes.js';
import {
  CAREER_STATUS_LABELS,
  POSITION_LABELS,
  SERVICE_SEASON_NOTICE_KO,
} from '../shared/labels.js';
import { formatLocalDateTime } from '../shared/format.js';
import { platform } from '../platform/index.js';
import { queryClient } from '../shared/query-client.js';
import { SyncBadge } from '../shared/SyncBadge.js';
import { useUiStore } from '../shared/ui-store.js';

export const Route = createFileRoute('/')({
  loader: async () => {
    const summaries = await queryClient.ensureQueryData(careersQueryOptions);
    if (summaries.length === 0 && !useUiStore.getState().onboardingSeen) {
      throw redirect({ to: '/onboarding' });
    }
  },
  component: HubScreen,
});

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function displayName(summary: CareerSummary): string {
  const { state } = summary;
  return state.player.profile?.name ?? state.player.draft.name ?? '이름 없는 선수';
}

function CareerCard({
  summary,
  currentServiceSeason,
  onDeleted,
  onDeleteFailed,
}: {
  summary: CareerSummary;
  currentServiceSeason: ServiceSeasonCurrent | undefined;
  onDeleted: (name: string) => void;
  onDeleteFailed: (name: string) => void;
}) {
  const navigate = useNavigate();
  const deleteMutation = useCareerMutation('delete');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);

  const { record, state } = summary;
  const name = displayName(summary);
  const position = state.player.profile?.primaryPosition ?? state.player.draft.position;
  const positionLabel = position ? POSITION_LABELS[position] : '—';
  const syncState = useSyncState(record.id);
  // T-2-012 D-54: 현재 시즌 조회가 아직 없으면(로딩·실패) 판단할 근거가 없으니 배지를 달지 않는다.
  const isTestArchiveCard =
    currentServiceSeason !== undefined &&
    (record.createdServiceSeasonId !== currentServiceSeason.id || currentServiceSeason.isTest);

  function handleContinue() {
    const target = screenForCareer(state);
    void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setConfirmStep(1);
  }

  async function handleDelete() {
    // 실패 시에도 다이얼로그를 닫는다: 열어 두면 Radix가 배경(Toast 포함)을 aria-hidden 처리해
    // role="status" 실패 안내가 접근성 트리에서 사라진다.
    setDialogOpen(false);
    setConfirmStep(1);
    trackCareerAbandonedHint(state);
    try {
      await deleteMutation.mutateAsync({ careerId: record.id });
      onDeleted(name);
    } catch {
      onDeleteFailed(name);
    }
  }

  return (
    <Card
      className="flex flex-col gap-os-4"
      data-testid="career-card"
      data-revision={record.revision}
    >
      <div className="flex items-start justify-between gap-os-3">
        <div className="flex min-w-0 items-center gap-os-3">
          <div
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center rounded-os-m bg-os-surface-2 p-os-3 text-os-accent"
          >
            <FootballMark className="h-os-6 w-os-6" />
          </div>
          <div className="min-w-0">
            <p className="os-eyebrow">나의 선수</p>
            <h2 className="font-os font-bold text-os-text" style={H2_STYLE}>
              {name}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-os-2">
          {isTestArchiveCard ? (
            <span
              data-testid="career-card-test-badge"
              className="rounded-os-s bg-os-surface-2 px-os-2 py-os-1 font-os text-os-text-2"
              style={CAPTION_STYLE}
            >
              테스트 시즌
            </span>
          ) : null}
          <span
            className="rounded-os-s bg-os-surface-2 px-os-2 py-os-1 font-os text-os-text-2"
            style={CAPTION_STYLE}
          >
            {CAREER_STATUS_LABELS[state.status]}
          </span>
        </div>
      </div>

      <dl
        className="grid grid-cols-2 gap-os-4 rounded-os-m bg-os-surface-2 p-os-4 font-os text-os-text-2"
        style={CAPTION_STYLE}
      >
        <div>
          <dt>포지션</dt>
          <dd className="mt-os-1 font-semibold text-os-text">{positionLabel}</dd>
        </div>
        <div>
          <dt>나이</dt>
          <dd className="os-num mt-os-1 font-semibold text-os-text">{state.age}</dd>
        </div>
        <div>
          <dt>규칙 · 콘텐츠 팩</dt>
          <dd className="os-num mt-os-1 break-words text-os-text">
            {record.rulesetVersion} / {record.contentPackVersion}
          </dd>
        </div>
        <div>
          <dt>마지막 갱신</dt>
          <dd className="os-num mt-os-1 text-os-text">{formatLocalDateTime(record.updatedAt)}</dd>
        </div>
      </dl>
      <SyncBadge state={syncState} />

      <div className="flex gap-os-3">
        <Button variant="primary" className="flex-1" onClick={handleContinue}>
          이어하기
        </Button>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button variant="ghost">삭제</Button>
          </DialogTrigger>
          <DialogContent
            title="커리어 삭제"
            description={
              confirmStep === 1
                ? `${name}의 커리어를 삭제하시겠습니까?`
                : '되돌릴 수 없습니다. 정말 삭제할까요?'
            }
            closeLabel="닫기"
          >
            {confirmStep === 1 ? (
              <Button variant="primary" onClick={() => setConfirmStep(2)}>
                다음
              </Button>
            ) : (
              <Button variant="primary" onClick={handleDelete} disabled={deleteMutation.isPending}>
                삭제 확정
              </Button>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}

function HubScreen() {
  const query = useCareerList();
  const createMutation = useCareerMutation('create');
  const navigate = useNavigate();
  const defaultSimulationMode = useUiStore((state) => state.defaultSimulationMode);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null,
  );
  const startingRef = useRef(false);
  const serviceSeason = useServiceSeason();
  // T-2-012 D-54: 조회가 안 끝났으면(로딩·에러) 폴백으로 커리어 생성은 그대로 허용한다 —
  // LOCKED·ARCHIVED가 확인된 경우에만 막는다.
  const newCareerDisabled =
    serviceSeason.data?.status === 'LOCKED' || serviceSeason.data?.status === 'ARCHIVED';

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-001', careerPhase: 'NONE' });
  }, []);

  async function handleStart() {
    // isPending은 첫 클릭 뒤 리렌더가 있어야 반영된다. 같은 틱의 연속 클릭(더블탭)이
    // mutateAsync를 두 번 트리거해 DRAFT를 두 개 만들지 않도록 동기 플래그로 막는다.
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const result = await createMutation.mutateAsync({ simulationMode: defaultSimulationMode });
      if (result.ok) {
        void navigate({
          to: '/career/$careerId/create',
          params: { careerId: result.snapshot.careerId },
        });
      } else {
        setToast({
          variant: 'error',
          message: '커리어를 시작하지 못했습니다. 다시 시도해 주세요.',
        });
      }
    } catch {
      // engine.client.execute의 IndexedDB 트랜잭션이 reject(예: QuotaExceededError)하면
      // {ok:false} 대신 예외가 온다. delete와 같은 실패 안내를 보여준다.
      setToast({ variant: 'error', message: '커리어를 시작하지 못했습니다. 다시 시도해 주세요.' });
    } finally {
      startingRef.current = false;
    }
  }

  return (
    <div className="os-screen">
      <ScreenIntro
        eyebrow="OFFSIDE · MY CAREER"
        title="커리어 허브"
        description="다시 휘슬이 울리면, 나의 축구 인생도 계속됩니다."
      />
      {query.isPending ? (
        <div className="flex flex-col gap-os-4" aria-label="불러오는 중">
          <Skeleton className="h-os-8 w-full" />
          <Skeleton className="h-os-8 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState
          message={
            query.error instanceof Error ? query.error.message : '커리어 목록을 불러오지 못했습니다'
          }
          onRetry={() => void query.refetch()}
        />
      ) : query.data.length === 0 ? (
        <div className="os-panel flex flex-col gap-os-4 text-center">
          <p className="os-eyebrow">KICKOFF</p>
          <p className="font-os font-semibold text-os-text" style={H2_STYLE}>
            첫 커리어를 시작할 준비가 됐습니다
          </p>
          <EmptyState
            headingLevel={2}
            reason="아직 만든 커리어가 없습니다"
            action={
              <div className="flex w-full flex-col items-center gap-os-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleStart}
                  disabled={createMutation.isPending || newCareerDisabled}
                >
                  커리어 시작
                </Button>
                {newCareerDisabled ? (
                  <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                    지금은 새 커리어를 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.
                  </p>
                ) : null}
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-os-4">
          <div className="flex items-center justify-between gap-os-3">
            <h2 className="os-section-title">나의 커리어</h2>
            <span className="os-num os-muted" style={CAPTION_STYLE}>
              {query.data.length}명
            </span>
          </div>
          {serviceSeason.data?.notice === 'LINE_TEST' ? (
            <p
              data-testid="service-season-banner"
              className="rounded-os-s bg-os-surface-2 px-os-3 py-os-2 font-os text-os-text-2"
              style={CAPTION_STYLE}
            >
              {SERVICE_SEASON_NOTICE_KO.LINE_TEST}
            </p>
          ) : null}
          <ul className="flex flex-col gap-os-4">
            {query.data.map((summary) => (
              <li key={summary.record.id}>
                <CareerCard
                  summary={summary}
                  currentServiceSeason={serviceSeason.data}
                  onDeleted={(name) =>
                    setToast({ variant: 'success', message: `${name}의 커리어를 삭제했습니다` })
                  }
                  onDeleteFailed={(name) =>
                    setToast({
                      variant: 'error',
                      message: `${name}의 커리어를 삭제하지 못했습니다. 다시 시도해 주세요.`,
                    })
                  }
                />
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleStart}
            disabled={createMutation.isPending || newCareerDisabled}
          >
            새 커리어
          </Button>
          {newCareerDisabled ? (
            <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
              지금은 새 커리어를 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
        </div>
      )}

      <nav
        className="flex flex-wrap justify-center gap-os-4 border-t border-os-border pt-os-4"
        aria-label="추가 메뉴"
      >
        <Link to="/settings" className="font-os text-os-text-2" style={CAPTION_STYLE}>
          설정
        </Link>
        <Link to="/legal/terms" className="font-os text-os-text-2" style={CAPTION_STYLE}>
          이용약관
        </Link>
        <Link to="/legal/privacy" className="font-os text-os-text-2" style={CAPTION_STYLE}>
          개인정보 처리방침
        </Link>
      </nav>

      {toast ? (
        <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />
      ) : null}
    </div>
  );
}
