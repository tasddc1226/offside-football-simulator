// SCR-001 홈·커리어 허브.
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogTrigger,
  DisplayWord,
  EmptyState,
  ErrorState,
  FootballMark,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
} from '@offside/ui';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
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
import { currentTeamName } from '../shared/current-team.js';
import { rulesetForCareer } from '../engine/content.js';
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
import { BRAND_SUBTITLE } from '../shared/brand.js';
import { useUiStore } from '../shared/ui-store.js';
import { FIXED_SIMULATION_MODE } from '../shared/start-season.js';
import { PublicIntroduction } from '../shared/public-content.js';
import { HomeCommunity } from '../shared/home-community.js';
import { GameCompletionTransition } from '../shared/game-presentation.js';
import '../shared/home-hub.css';

const HUB_TABS = ['resume', 'squad', 'retired'] as const;
type HubTab = (typeof HUB_TABS)[number];

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { tab?: HubTab } => {
    const tab = HUB_TABS.find((candidate) => candidate === search.tab);
    return tab ? { tab } : {};
  },
  loader: async () => {
    await queryClient.ensureQueryData(careersQueryOptions);
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

/** 조회에 성공한 현재 시즌과 생성 시즌의 관계만 표시한다. 과거 시즌의 test 여부는 현재 포인터로
 * 알 수 없으므로 접두사나 ID 형태로 추론하지 않는다. */
export function serviceSeasonBadgeLabel(
  createdServiceSeasonId: string,
  currentServiceSeason: ServiceSeasonCurrent | undefined,
): '테스트 시즌' | '이전 시즌' | null {
  if (currentServiceSeason === undefined) return null;
  if (createdServiceSeasonId !== currentServiceSeason.id) return '이전 시즌';
  return currentServiceSeason.isTest ? '테스트 시즌' : null;
}

/**
 * 이슈 167: 카드 CTA는 status로 갈린다. RETIRED·ARCHIVED는 이어갈 진행이 없으니 "기록 보기"
 * (screenForCareer가 SCR-025 은퇴·기록 화면으로 보낸다), DRAFT·ACTIVE만 "이어하기".
 */
export function careerCardCtaLabel(status: CareerSummary['state']['status']): '이어하기' | '기록 보기' {
  return status === 'RETIRED' || status === 'ARCHIVED' ? '기록 보기' : '이어하기';
}

function CareerCard({
  summary,
  currentServiceSeason,
  onDeleted,
  onDeleteFailed,
  featured = false,
}: {
  summary: CareerSummary;
  currentServiceSeason: ServiceSeasonCurrent | undefined;
  onDeleted: (name: string) => void;
  onDeleteFailed: (name: string) => void;
  featured?: boolean;
}) {
  const navigate = useNavigate();
  const deleteMutation = useCareerMutation('delete');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);

  const { record, state } = summary;
  const name = displayName(summary);
  const position = state.player.profile?.primaryPosition ?? state.player.draft.position;
  const positionLabel = position ? POSITION_LABELS[position] : '—';
  const teamNameOverrides = useUiStore((uiState) => uiState.teamNameOverrides);
  const team =
    state.player.profile === null
      ? null
      : currentTeamName(state, rulesetForCareer(state), teamNameOverrides);
  const ovr = state.player.profile?.baseOvr;
  const syncState = useSyncState(record.id);
  // T-2-012 D-54: 현재 시즌 조회가 아직 없으면(로딩·실패) 판단할 근거가 없으니 배지를 달지 않는다.
  const serviceSeasonBadge = serviceSeasonBadgeLabel(
    record.createdServiceSeasonId,
    currentServiceSeason,
  );

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
            <p className="os-eyebrow">{featured ? '최근 선수' : '나의 선수'}</p>
            <h2 className="font-os font-bold text-os-text" style={H2_STYLE}>
              {name}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-os-2">
          {serviceSeasonBadge ? (
            <span
              data-testid="career-card-test-badge"
              className="rounded-os-s bg-os-surface-2 px-os-2 py-os-1 font-os text-os-text-2"
              style={CAPTION_STYLE}
            >
              {serviceSeasonBadge}
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
        className="grid grid-cols-2 gap-x-os-4 gap-y-os-3 border-y border-os-border py-os-3 font-os text-os-text-2 sm:grid-cols-4"
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
        {team !== null ? (
          <div>
            <dt>팀</dt>
            <dd className="mt-os-1 font-semibold text-os-text">{team}</dd>
          </div>
        ) : null}
        {ovr !== undefined ? (
          <div>
            <dt>OVR</dt>
            <dd className="os-num mt-os-1 font-semibold text-os-text">{ovr}</dd>
          </div>
        ) : null}
      </dl>
      <SyncBadge state={syncState} />

      <div className="flex gap-os-3">
        <Button variant="primary" className="flex-1" onClick={handleContinue}>
          {careerCardCtaLabel(state.status)}
        </Button>
      </div>
      {!featured ? (
        <details
          className="rounded-os-m border border-os-border px-os-3 py-os-2 font-os text-os-text-2"
          style={CAPTION_STYLE}
        >
          <summary className="cursor-pointer font-semibold text-os-text">상세 관리</summary>
          <dl className="mt-os-3 grid grid-cols-2 gap-os-3">
            <div>
              <dt>규칙 · 콘텐츠 팩</dt>
              <dd className="os-num mt-os-1 break-words text-os-text">
                {record.rulesetVersion} / {record.contentPackVersion}
              </dd>
            </div>
            <div>
              <dt>마지막 갱신</dt>
              <dd className="os-num mt-os-1 text-os-text">
                {formatLocalDateTime(record.updatedAt)}
              </dd>
            </div>
          </dl>
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="mt-os-3">
                커리어 삭제
              </Button>
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
                <Button
                  variant="primary"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  삭제 확정
                </Button>
              )}
            </DialogContent>
          </Dialog>
        </details>
      ) : null}
    </Card>
  );
}

function HubScreen() {
  const { tab } = Route.useSearch();
  const query = useCareerList();
  const createMutation = useCareerMutation('create');
  const navigate = useNavigate();
  const onboardingSeen = useUiStore((state) => state.onboardingSeen);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null,
  );
  const startingRef = useRef(false);
  const [kickoffWaitFor, setKickoffWaitFor] = useState<Promise<void> | null>(null);
  const createdCareerIdRef = useRef<string | null>(null);
  const serviceSeason = useServiceSeason();
  // T-2-012 D-54: 조회가 안 끝났으면(로딩·에러) 폴백으로 커리어 생성은 그대로 허용한다 —
  // LOCKED·ARCHIVED가 확인된 경우에만 막는다.
  const newCareerDisabled =
    serviceSeason.data?.status === 'LOCKED' || serviceSeason.data?.status === 'ARCHIVED';
  const selectedTab = tab ?? 'resume';

  const seasonStatus = (() => {
    if (serviceSeason.isPending)
      return { label: '시즌 정보 확인 중', detail: '새 커리어는 계속 시작할 수 있습니다.' };
    if (serviceSeason.isError)
      return {
        label: '시즌 정보를 불러오지 못했습니다',
        detail: '시즌 정보를 확인하지 못했습니다. 기존 기록은 계속 열 수 있습니다.',
      };
    if (serviceSeason.data.status === 'LOCKED')
      return {
        label: '새 커리어 시작 잠김',
        detail: '현재 시즌에서는 기존 커리어만 이어갈 수 있습니다.',
      };
    if (serviceSeason.data.status === 'ARCHIVED')
      return { label: '시즌 종료', detail: '현재 시즌이 보관되어 새 커리어를 시작할 수 없습니다.' };
    return {
      label: serviceSeason.data.name,
      detail: serviceSeason.data.isTest
        ? '현재 테스트 시즌이 운영 중입니다.'
        : '현재 커리어를 시작할 수 있는 시즌입니다.',
    };
  })();

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-001', careerPhase: 'NONE' });
  }, []);

  /** UX-012: DRAFT 생성 커맨드를 ScreenTransition의 waitFor로 넘긴다 — 3초 연출 뒤(또는 생성이
   * 더 오래 걸리면 그 완료 뒤) /create로 이동한다. 실패 시에는 기존 토스트 경로를 그대로 쓴다. */
  function handleStart() {
    // isPending은 첫 클릭 뒤 리렌더가 있어야 반영된다. 같은 틱의 연속 클릭(더블탭)이
    // mutateAsync를 두 번 트리거해 DRAFT를 두 개 만들지 않도록 동기 플래그로 막는다.
    if (startingRef.current) return;
    startingRef.current = true;
    setKickoffWaitFor(
      (async () => {
        // engine.client.execute의 IndexedDB 트랜잭션이 reject(예: QuotaExceededError)하면
        // {ok:false} 대신 예외가 온다 — 둘 다 이 프라미스의 reject로 합쳐 onError 하나로 처리한다.
        const result = await createMutation.mutateAsync({ simulationMode: FIXED_SIMULATION_MODE });
        if (!result.ok) throw new Error('커리어를 시작하지 못했습니다.');
        createdCareerIdRef.current = result.snapshot.careerId;
      })(),
    );
  }

  function handleStartError() {
    startingRef.current = false;
    setKickoffWaitFor(null);
    setToast({ variant: 'error', message: '커리어를 시작하지 못했습니다. 다시 시도해 주세요.' });
  }

  function handleStartComplete() {
    const careerId = createdCareerIdRef.current;
    startingRef.current = false;
    if (careerId === null) return;
    void navigate({ to: '/career/$careerId/create', params: { careerId } });
  }

  function changeTab(value: string) {
    if (!HUB_TABS.includes(value as HubTab)) return;
    void navigate({ to: '/', search: value === 'resume' ? {} : { tab: value as HubTab } });
  }

  if (!query.isPending && !query.isError && query.data.length === 0 && !onboardingSeen) {
    return <PublicIntroduction />;
  }

  if (kickoffWaitFor !== null) {
    return (
      <GameCompletionTransition
        title="새 인생을 준비합니다"
        detail="첫 무대에 서기 위한 준비를 마칩니다."
        onComplete={handleStartComplete}
        onError={handleStartError}
        waitFor={kickoffWaitFor}
        stages={['선수 카드 등록 중', '첫 시즌 준비 중', '피치 입장']}
      >
        <DisplayWord word="OFFSIDE" caption={BRAND_SUBTITLE} />
      </GameCompletionTransition>
    );
  }

  return (
    <div className="os-screen">
      <header className="flex flex-col gap-os-1 px-os-1">
        <p className="os-eyebrow">{BRAND_SUBTITLE}</p>
        <h1
          className="font-os font-bold text-os-text"
          style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' }}
        >
          커리어 허브
        </h1>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          선수 생활을 이어가거나 새로운 커리어를 시작하세요.
        </p>
      </header>
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
          <div
            className={
              selectedTab === 'resume' ? 'sr-only' : 'flex items-center justify-between gap-os-3'
            }
          >
            <h2 className="os-section-title">선수 목록</h2>
            <span className="os-num os-muted" style={CAPTION_STYLE}>
              {query.data.length}명
            </span>
          </div>
          {selectedTab === 'resume' ? (
            (() => {
              const recent = query.data
                .filter(({ state }) => state.status !== 'RETIRED' && state.status !== 'ARCHIVED')
                .sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt))[0];
              return recent ? (
                <CareerCard
                  summary={recent}
                  featured
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
              ) : (
                <EmptyState headingLevel={2} reason="이어갈 현역 커리어가 없습니다" />
              );
            })()
          ) : (
            <Tabs value={selectedTab} onValueChange={changeTab}>
              <div className="overflow-x-auto">
                <TabsList aria-label="커리어 허브 구역" className="min-w-max">
                  <TabsTrigger value="resume">최근 선수</TabsTrigger>
                  <TabsTrigger value="squad">다른 선수</TabsTrigger>
                  <TabsTrigger value="retired">보관·은퇴</TabsTrigger>
                </TabsList>
              </div>
              {(() => {
                const resumable = query.data.filter(
                  ({ state }) => state.status !== 'RETIRED' && state.status !== 'ARCHIVED',
                );
                const retired = query.data.filter(
                  ({ state }) => state.status === 'RETIRED' || state.status === 'ARCHIVED',
                );
                const renderCard = (summary: CareerSummary, featured = false) => (
                  <CareerCard
                    key={summary.record.id}
                    summary={summary}
                    featured={featured}
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
                );
                return (
                  <>
                    <TabsContent value="squad">
                      <div className="flex flex-col gap-os-4">
                        {resumable.length > 0 ? (
                          resumable.map((summary) => renderCard(summary))
                        ) : (
                          <EmptyState headingLevel={2} reason="현역 선수가 없습니다" />
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="retired">
                      <div className="flex flex-col gap-os-4">
                        {retired.length > 0 ? (
                          retired.map((summary) => renderCard(summary))
                        ) : (
                          <EmptyState headingLevel={2} reason="아직 은퇴 기록이 없습니다" />
                        )}
                      </div>
                    </TabsContent>
                  </>
                );
              })()}
            </Tabs>
          )}
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

      <section className="flex flex-col gap-os-3" aria-labelledby="home-management">
        <h2 id="home-management" className="os-section-title">
          바로가기
        </h2>
        <nav className="os-home-tools" aria-label="커리어 관리">
          <Link to="/" search={{ tab: 'squad' }} className="os-home-tool">
            <strong>선수단 관리</strong>
            <span>현역 선수와 다른 커리어 보기</span>
          </Link>
          <Link to="/" search={{ tab: 'retired' }} className="os-home-tool">
            <strong>기록 관리</strong>
            <span>은퇴·보관된 선수 기록 보기</span>
          </Link>
          <Link to="/guide" className="os-home-tool">
            <strong>게임 가이드</strong>
            <span>선수 생성부터 은퇴까지 알아보기</span>
          </Link>
          <Link to="/faq" className="os-home-tool">
            <strong>자주 묻는 질문</strong>
            <span>저장과 진행 방법 확인하기</span>
          </Link>
        </nav>
      </section>

      <section
        className="flex flex-col gap-os-2 border-y border-os-border py-os-3"
        aria-labelledby="service-season-status"
      >
        <p className="os-eyebrow">서비스 시즌</p>
        <h2
          id="service-season-status"
          className="font-os font-semibold text-os-text"
          style={H2_STYLE}
        >
          {seasonStatus.label}
        </h2>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {seasonStatus.detail}
        </p>
        {serviceSeason.isSuccess && serviceSeason.data.endsAt === null ? (
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            종료일 미정
          </p>
        ) : null}
        {serviceSeason.data?.notice === 'LINE_TEST' ? (
          <p
            data-testid="service-season-banner"
            className="font-os text-os-text-2"
            style={CAPTION_STYLE}
          >
            {SERVICE_SEASON_NOTICE_KO.LINE_TEST}
          </p>
        ) : null}
      </section>

      <HomeCommunity />

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
