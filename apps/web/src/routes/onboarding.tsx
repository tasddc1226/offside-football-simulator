// SCR-034 온보딩. 3장 이내, 대표 문장 하나와 두 문장 이내 설명. 건너뛰기·KICKOFF 모두
// onboardingSeen = true를 저장한다. 이 라우트는 언제든 열린다(설정의 "온보딩 다시 보기").
import { useEffect, useRef, useState } from 'react';
import { Button, ScreenIntro, Stepper, Toast } from '@offside/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { markOnboardingPending } from '../engine/funnel.js';
import { useServiceSeason } from '../engine/service-season.js';
import { useCareerMutation } from '../engine/use-career.js';
import { platform } from '../platform/index.js';
import { SERVICE_SEASON_NOTICE_KO } from '../shared/labels.js';
import { useUiStore } from '../shared/ui-store.js';

export const Route = createFileRoute('/onboarding')({
  component: OnboardingScreen,
});

type Slide = { id: string; headline: string; body: string; note?: string };

const SLIDES: Slide[] = [
  {
    id: 'numbers',
    headline: 'OVR 하나가 아니라 여러 수치로 성장합니다',
    body: 'U18 시기에는 기본 OVR·폼·체력만 보입니다. 첫 프로 계약을 맺으면 전술 적합도와 감독 신뢰 같은 수치가 열립니다.',
  },
  {
    id: 'choices',
    headline: '선택은 되돌릴 수 없습니다',
    body: '확정하기 전에 위험과 영향 범위를 미리 보여줍니다. 확정한 뒤에는 같은 결과를 다시 추첨하지 않습니다.',
  },
  {
    id: 'recovery',
    headline: '복구 코드가 유일한 열쇠입니다',
    body: '다른 기기에서 커리어를 이어가려면 복구 코드가 필요합니다. 설정에서 언제든 발급할 수 있습니다.',
    note: '커리어에는 VAR이 없다',
  },
];

const STEPPER_STEPS = SLIDES.map((slide, index) => ({
  id: slide.id,
  label: `${index + 1}/${SLIDES.length}`,
}));

const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function OnboardingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();
  const serviceSeason = useServiceSeason();
  const setOnboardingSeen = useUiStore((state) => state.setOnboardingSeen);
  const defaultSimulationMode = useUiStore((state) => state.defaultSimulationMode);
  const createMutation = useCareerMutation('create');
  const [toast, setToast] = useState<string | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-034', careerPhase: 'NONE' });
    void markOnboardingPending();
  }, []);

  const slide = SLIDES[stepIndex]!;
  const isLast = stepIndex === SLIDES.length - 1;

  function handleSkip() {
    setOnboardingSeen(true);
    void navigate({ to: '/' });
  }

  async function handleKickoff() {
    // isPending은 첫 클릭 뒤 리렌더가 있어야 반영된다. 같은 틱의 연속 클릭이 mutateAsync를
    // 두 번 트리거해 DRAFT를 두 개 만들지 않도록 동기 플래그로 막는다.
    if (startingRef.current) return;
    startingRef.current = true;
    setOnboardingSeen(true);
    try {
      const result = await createMutation.mutateAsync({ simulationMode: defaultSimulationMode });
      if (result.ok) {
        void navigate({
          to: '/career/$careerId/create',
          params: { careerId: result.snapshot.careerId },
        });
      } else {
        setToast('커리어를 시작하지 못했습니다. 다시 시도해 주세요.');
      }
    } catch {
      // engine.client.execute의 IndexedDB 트랜잭션이 reject(예: QuotaExceededError)하면
      // {ok:false} 대신 예외가 온다.
      setToast('커리어를 시작하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      startingRef.current = false;
    }
  }

  return (
    <div className="os-screen">
      <Stepper steps={STEPPER_STEPS} currentStepId={slide.id} />

      <ScreenIntro
        eyebrow={`OFFSIDE · 플레이 가이드 ${stepIndex + 1}`}
        title={slide.headline}
        description={slide.body}
      />

      <div className="os-panel flex flex-col gap-os-4">
        <p className="os-eyebrow">시작하기 전에</p>
        <ol className="flex flex-col gap-os-4" aria-label="오프사이드 플레이 원칙">
          {[
            { title: '나만의 선수', detail: '이름과 선호 포지션을 정하고 출발해요.' },
            { title: '선택으로 쌓는 커리어', detail: '매 순간의 결정이 다음 기회를 바꿔요.' },
            { title: '이어지는 축구 인생', detail: '플레이 기록을 저장하고 다시 이어가요.' },
          ].map((item, index) => (
            <li key={item.title} className="flex items-start gap-os-3">
              <span
                aria-hidden="true"
                className="os-num rounded-os-m bg-os-surface-2 px-os-3 py-os-2 font-semibold text-os-accent"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p className="font-os font-semibold text-os-text">{item.title}</p>
                <p className="os-muted" style={CAPTION_STYLE}>
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {slide.note ? (
          <p
            className="border-t border-os-border pt-os-4 font-os font-semibold text-os-text"
            style={CAPTION_STYLE}
          >
            {slide.note}
          </p>
        ) : null}
        {stepIndex === 0 && serviceSeason.data?.notice === 'LINE_TEST' ? (
          <p
            data-testid="onboarding-service-season-notice"
            className="font-os text-os-text-2"
            style={CAPTION_STYLE}
          >
            {SERVICE_SEASON_NOTICE_KO.LINE_TEST}
          </p>
        ) : null}
      </div>

      <div className="os-action-dock os-action-row">
        <Button variant="ghost" onClick={handleSkip}>
          건너뛰기
        </Button>
        {isLast ? (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-os-2">
            {/* 짧은 킥오프 버튼에도 동작을 설명하는 caption을 함께 제공한다. */}
            <Button
              variant="primary"
              onClick={handleKickoff}
              disabled={createMutation.isPending}
              className="os-num w-full font-bold uppercase"
              style={{
                fontSize: 'var(--os-fs-h2)',
                lineHeight: 'var(--os-lh-h2)',
                letterSpacing: 'var(--os-tracking-display)',
              }}
            >
              KICKOFF
            </Button>
            <p className="text-center font-os text-os-text-2" style={CAPTION_STYLE}>
              첫 커리어를 시작할 준비가 됐습니다
            </p>
          </div>
        ) : (
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => setStepIndex((index) => index + 1)}
          >
            다음
          </Button>
        )}
      </div>
      <p className="text-center font-os text-os-text-2" style={CAPTION_STYLE}>
        건너뛰어도 각 수치는 처음 열리는 순간 한 줄 설명을 보여줍니다.
      </p>

      {toast ? <Toast variant="error" message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
