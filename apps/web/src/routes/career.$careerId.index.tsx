// SCR-029 커리어 대시보드. 다섯 구역 탭 + "다음 결정" 카드. 대시보드에서는 어떤 명령도 확정하지
// 않는다 — advance는 결정이 아니라 "진행"이며(다음에 뭐가 뜰지는 도메인이 정한다), 확정은 전용
// 결정 화면(SCR-007·008·009·010·013·014)에서만 일어난다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ATTRIBUTE_KEYS, type CareerState, type TimelineEntry } from '@offside/domain';
import {
  Button,
  buttonClassName,
  buttonStyle,
  Card,
  CareerTimeline,
  DashboardSection,
  PlayerHeader,
  StatusStrip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
  type CareerTimelineItem,
} from '@offside/ui';
import { activeContentPack, activeRuleset } from '../engine/content.js';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { useEngine } from '../engine/use-engine.js';
import { screenForCareer } from '../shared/career-route.js';
import { currentTeamName } from '../shared/current-team.js';
import {
  EFFECT_TARGET_LABEL_KO,
  LEAGUE_TIER_LABEL_KO,
  POSITION_LABELS,
  SEASON_PHASE_LABEL_KO,
  SQUAD_ROLE_LABELS,
  TIMELINE_KIND_LABEL_KO,
} from '../shared/labels.js';
import { markStatsRevealed, readRevealedStats } from '../shared/revealed-stats.js';
import { proStatusStripItems, u18StatusStripItems } from '../shared/status-strip.js';
import { formatKrw } from '../shared/format.js';
import { platform } from '../platform/index.js';
import { SCREEN_ROUTES } from '../routes.js';

type DashboardSearch = { signed?: boolean };

export const Route = createFileRoute('/career/$careerId/')({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => (search.signed === true ? { signed: true } : {}),
  component: CareerDashboard,
});

const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

function timelineSentence(entry: TimelineEntry, state: CareerState): string {
  switch (entry.kind) {
    case 'CAREER_CONFIRMED':
      return '선수 생활 시작';
    case 'CONTRACT_SIGNED':
      return state.contract !== null && entry.refId === state.contract.id ? `${state.contract.teamName}과 계약` : '계약';
    case 'SEASON_SETTLED':
      return '시즌 정산';
    case 'EVENT_RESOLVED': {
      if (entry.refId === null) return '이벤트';
      const [eventId, choiceId, outcomeId] = entry.refId.split(':');
      const definition = eventId === undefined ? undefined : activeContentPack.eventsById.get(eventId);
      const choice = definition?.choices.find((candidate) => candidate.id === choiceId);
      const outcome = choice?.outcomes.find((candidate) => candidate.id === outcomeId);
      return choice === undefined || outcome === undefined ? '이벤트' : `${choice.label} → ${outcome.title}`;
    }
  }
}

function buildTimelineItems(state: CareerState): CareerTimelineItem[] {
  return [...state.timeline].reverse().map((entry) => ({
    id: `${entry.kind}-${entry.revision}`,
    age: entry.age,
    stage: TIMELINE_KIND_LABEL_KO[entry.kind],
    title: timelineSentence(entry, state),
  }));
}

/** 계약 전에는 전술실·휴대폰을 잠근다. 계약 직후 처음 열릴 때만 한 줄 설명을 보여준다(브리프:
 * LocalStore kv 'ui:revealed'). */
function useStatsRevealCaption(unlocked: boolean): boolean {
  const engineQuery = useEngine();
  const [show, setShow] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!unlocked || handledRef.current || engineQuery.data === undefined) return;
    handledRef.current = true;
    const store = engineQuery.data.store;
    void (async () => {
      const alreadyRevealed = await readRevealedStats(store);
      if (!alreadyRevealed) {
        setShow(true);
        await markStatsRevealed(store);
      }
    })();
  }, [unlocked, engineQuery.data]);

  return show;
}

function NextDecisionCard({ careerId, state }: { careerId: string; state: CareerState }) {
  const navigate = useNavigate();
  const advanceMutation = useCareerMutation('advance');
  const [nothingToAdvance, setNothingToAdvance] = useState(false);
  const submittingRef = useRef(false);

  const pending = state.pending;

  if (pending !== null && pending.kind === 'EVENT') {
    const target = screenForCareer(state);
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          결정이 기다립니다
        </p>
        <Link to={SCREEN_ROUTES[target.screenId]} params={target.params} className={buttonClassName('primary')} style={buttonStyle}>
          결정하러 가기
        </Link>
      </Card>
    );
  }

  if (pending !== null && pending.kind === 'OFFERS') {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          제안 {pending.offers.length}건
        </p>
        <Link to="/career/$careerId/offers" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
          제안 보기
        </Link>
      </Card>
    );
  }

  async function handleAdvance() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const result = await advanceMutation.mutateAsync({ careerId });
      if (result.ok) {
        const target = screenForCareer(result.domainSnapshot.state);
        void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
        return;
      }
      const details = result.error.details;
      const reason = typeof details === 'object' && details !== null && 'reason' in details ? (details as { reason?: unknown }).reason : undefined;
      if (reason === 'NOTHING_TO_ADVANCE') {
        setNothingToAdvance(true);
      }
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <Card className="flex flex-col gap-os-2">
      <Button variant="primary" onClick={handleAdvance} disabled={nothingToAdvance || advanceMutation.isPending}>
        진행
      </Button>
      {nothingToAdvance ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          다음 시즌은 곧 열립니다
        </p>
      ) : null}
    </Card>
  );
}

function CareerDashboard() {
  const { careerId } = Route.useParams();
  const { signed } = Route.useSearch();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const [showSignedToast, setShowSignedToast] = useState(signed === true);
  const initialisedRef = useRef(false);

  useEffect(() => {
    if (initialisedRef.current) return;
    initialisedRef.current = true;
    platform.analytics.track('screen_viewed', { screenId: 'SCR-029', careerPhase: query.data?.state.seasonPhase ?? 'NONE' });
    if (signed === true) {
      void navigate({ to: '/career/$careerId', params: { careerId }, search: {}, replace: true });
    }
    // 마운트 시 1회만.
  }, []);

  const contractUnlocked = query.data !== undefined && query.data.state.contract !== null;
  const showRevealCaption = useStatsRevealCaption(contractUnlocked);

  if (query.data === undefined) {
    // 부모 레이아웃의 loader가 이미 데이터를 캐시에 채웠다. RESOLVED가 아닌 순간은 사실상 없다.
    return null;
  }

  const { state } = query.data;
  const profile = state.player.profile;
  const draft = state.player.draft;
  const name = profile?.name ?? draft.name ?? '이름 없는 선수';
  const position = profile?.position ?? draft.position;
  const hasContract = state.contract !== null;

  return (
    <div className="flex flex-col gap-os-6">
      <PlayerHeader
        name={name}
        team={currentTeamName(state, activeRuleset)}
        position={{ label: '포지션', value: position ? POSITION_LABELS[position] : '—' }}
        archetype={{ label: '아키타입', value: profile?.archetypeId ?? '—' }}
        shirtNumber={{ label: '등번호', value: state.contract ? String(state.contract.shirtNumber) : '—' }}
      />

      <StatusStrip items={hasContract ? proStatusStripItems(state) : u18StatusStripItems(state)} />

      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        {state.age}세 · {SEASON_PHASE_LABEL_KO[state.seasonPhase]} · step {state.currentStep}
      </p>

      <NextDecisionCard careerId={careerId} state={state} />

      <Tabs defaultValue="schedule">
        <TabsList aria-label="대시보드 구역">
          <TabsTrigger value="schedule">일정표</TabsTrigger>
          <TabsTrigger value="locker">라커룸</TabsTrigger>
          <TabsTrigger value="tactics">전술실</TabsTrigger>
          <TabsTrigger value="phone">휴대폰</TabsTrigger>
          <TabsTrigger value="diary">다이어리</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <DashboardSection title="일정표" description="현재 진행 상황과 다음 결정을 확인합니다.">
            <p className="font-os text-os-text" style={BODY_STYLE}>
              step {state.currentStep} · {SEASON_PHASE_LABEL_KO[state.seasonPhase]}
            </p>
            <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
              {state.pending === null ? '다음 결정은 진행 후 열립니다.' : '위 카드에서 결정을 확인하세요.'}
            </p>
          </DashboardSection>
        </TabsContent>

        <TabsContent value="locker">
          <DashboardSection title="라커룸" description="감독·주장·경쟁자·동료 관계의 최근 기억입니다.">
            {state.tags.length === 0 ? (
              <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                아직 기억 태그가 없습니다.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-os-1">
                {state.tags.map((tag) => (
                  <li key={tag} className="rounded-os-s bg-os-surface-2 px-os-2 py-os-1 font-os text-os-text-2" style={CAPTION_STYLE}>
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        </TabsContent>

        <TabsContent value="tactics">
          <DashboardSection
            title="전술실"
            description="역할 약속과 전술 적합도, 세부 능력을 봅니다."
            locked={!hasContract}
            lockReason="첫 프로 계약 후 열림"
          >
            {hasContract && state.contract ? (
              <div className="flex flex-col gap-os-3">
                {showRevealCaption ? (
                  <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                    전술 적합도·감독 신뢰가 새로 열렸습니다.
                  </p>
                ) : null}
                <p className="font-os text-os-text" style={BODY_STYLE}>
                  역할 약속: {SQUAD_ROLE_LABELS[state.contract.rolePromise]} · 전술 적합도 {state.context.tacticalFit}
                </p>
                <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2 sm:grid-cols-3" style={CAPTION_STYLE}>
                  {ATTRIBUTE_KEYS.map((key) => (
                    <div key={key}>
                      <dt>{EFFECT_TARGET_LABEL_KO[key]}</dt>
                      <dd className="os-num text-os-text">{state.attributes[key]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </DashboardSection>
        </TabsContent>

        <TabsContent value="phone">
          <DashboardSection title="휴대폰" description="계약 상태를 확인합니다." locked={!hasContract} lockReason="첫 프로 계약 후 열림">
            {hasContract && state.contract ? (
              <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
                <div>
                  <dt>팀</dt>
                  <dd className="text-os-text">{state.contract.teamName}</dd>
                </div>
                <div>
                  <dt>리그</dt>
                  <dd className="text-os-text">{LEAGUE_TIER_LABEL_KO[state.contract.leagueTier]}</dd>
                </div>
                <div>
                  <dt>기간</dt>
                  <dd className="os-num text-os-text">{state.contract.lengthSeasons}시즌</dd>
                </div>
                <div>
                  <dt>주급</dt>
                  <dd className="os-num text-os-text">{formatKrw(state.contract.wageMinorPerWeek)}</dd>
                </div>
              </dl>
            ) : null}
          </DashboardSection>
        </TabsContent>

        <TabsContent value="diary">
          <DashboardSection title="다이어리" description="이번 커리어의 연대기입니다.">
            <CareerTimeline items={buildTimelineItems(state)} emptyMessage="아직 기록이 없습니다" />
          </DashboardSection>
        </TabsContent>
      </Tabs>

      <div className="flex gap-os-4">
        <Link to="/" className={buttonClassName('secondary')} style={buttonStyle}>
          허브로
        </Link>
        <Link to="/settings" className="font-os text-os-text-2" style={CAPTION_STYLE}>
          설정
        </Link>
      </div>

      {showSignedToast ? <Toast variant="success" message="계약을 맺었습니다" onDismiss={() => setShowSignedToast(false)} /> : null}
    </div>
  );
}
