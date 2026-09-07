// SCR-034 온보딩. 3장 이내, 대표 문장 하나와 두 문장 이내 설명. 건너뛰기·KICKOFF 모두
// onboardingSeen = true를 저장한다. 이 라우트는 언제든 열린다(설정의 "온보딩 다시 보기").
import { useEffect, useRef, useState } from 'react';
import { Button, DisplayWord, ScreenIntro, Stepper, SwipeSurface, Toast } from '@offside/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { markOnboardingPending } from '../engine/funnel.js';
import { useServiceSeason } from '../engine/service-season.js';
import { useCareerMutation } from '../engine/use-career.js';
import { platform } from '../platform/index.js';
import { SERVICE_SEASON_NOTICE_KO } from '../shared/labels.js';
import { useReducedMotion, useUiStore } from '../shared/ui-store.js';
import { MotionPanel, type ScreenDirection } from '../shared/screen-motion.js';
import { GameCompletionTransition } from '../shared/game-presentation.js';
import { CinematicIntro } from '../shared/cinematic-intro.js';
import { BRAND_SUBTITLE } from '../shared/brand.js';

export const Route = createFileRoute('/onboarding')({
  component: OnboardingScreen,
});

type Slide = { id: string; headline: string; body: string; note?: string };

const SLIDES: Slide[] = [
  {
    id: 'numbers',
    headline: '한 명의 선수로, 축구 인생 전체를 플레이하세요',
    body: '출발 배경과 포지션을 고르고, 선택을 쌓아 나만의 커리어를 만듭니다. 첫 계약 후에는 전술 적합도와 감독 신뢰도 열립니다.',
  },
  {
    id: 'choices',
    headline: '선택은 되돌릴 수 없습니다',
    body: '확정하기 전에 위험과 영향 범위를 미리 보여줍니다. 확정한 뒤에는 같은 결과를 다시 추첨하지 않습니다.',
  },
  {
    id: 'recovery',
    headline: '커리어를 다시 찾을 방법을 준비하세요',
    body: '다른 기기에서는 복구 코드로 이어가거나, 미리 연결한 Google 계정으로 같은 프로필을 찾을 수 있습니다.',
    note: '커리어에는 VAR이 없다',
  },
];

const STEPPER_STEPS = SLIDES.map((slide, index) => ({
  id: slide.id,
  label: ['선수', '선택', '저장'][index]!,
}));

const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function OnboardingScreen() {
  // UX-009: 온보딩에 진입할 때마다(첫 방문·"온보딩 다시 보기" 모두) 3슬라이드 앞에 시네마틱 인트로를
  // 한 번 보여준다. 로컬 state라 슬라이드 내 이전/다음 이동으로는 다시 뜨지 않는다.
  const [introDone, setIntroDone] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<ScreenDirection>('forward');
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const serviceSeason = useServiceSeason();
  const setOnboardingSeen = useUiStore((state) => state.setOnboardingSeen);
  const defaultSimulationMode = useUiStore((state) => state.defaultSimulationMode);
  const createMutation = useCareerMutation('create');
  const [toast, setToast] = useState<string | null>(null);
  const [createdCareerId, setCreatedCareerId] = useState<string | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-034', careerPhase: 'NONE' });
    void markOnboardingPending();
  }, []);

  const slide = SLIDES[stepIndex]!;
  const isLast = stepIndex === SLIDES.length - 1;

  function changeSlide(delta: number) {
    if (startingRef.current) return;
    setDirection(delta > 0 ? 'forward' : 'back');
    setStepIndex((index) => Math.max(0, Math.min(SLIDES.length - 1, index + delta)));
  }

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
        setCreatedCareerId(result.snapshot.careerId);
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

  if (!introDone) {
    return (
      <div className="os-screen">
        <CinematicIntro onComplete={() => setIntroDone(true)} />
      </div>
    );
  }

  if (createdCareerId !== null) {
    return (
      <GameCompletionTransition
        title="새 인생이 시작됩니다"
        detail="지금까지 훈련해 온 환경과 현재 마주한 기회를 선택하세요."
        onComplete={() => void navigate({ to: '/career/$careerId/create', params: { careerId: createdCareerId } })}
        stages={['선수 카드 등록 중', '첫 시즌 준비 중', '피치 입장']}
      >
        <DisplayWord word="OFFSIDE" caption={BRAND_SUBTITLE} />
      </GameCompletionTransition>
    );
  }

  return (
    <div className="os-screen">
      <Stepper steps={STEPPER_STEPS} currentStepId={slide.id} />

      <MotionPanel motionKey={stepIndex} direction={direction} className="os-onboarding-motion">
        <SwipeSurface
          canSwipeLeft={!isLast}
          canSwipeRight={stepIndex > 0}
          disabled={createMutation.isPending}
          reducedMotion={reducedMotion}
          onSwipe={(swipe) => changeSlide(swipe === 'left' ? 1 : -1)}
        >
          <div className="os-screen">
            <ScreenIntro
              eyebrow="OFFSIDE 시작 안내"
              title={slide.headline}
              description={slide.body}
            />

            <div className="os-creation-note">
              <p className="font-os font-semibold text-os-text">
                {stepIndex === 0 ? '나만의 선수를 만들고 성장을 기록합니다.' : stepIndex === 1 ? '확정 전에 결과와 영향을 꼭 확인하세요.' : '복구 코드나 Google 연결 중 하나를 준비하세요.'}
              </p>
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
          </div>
        </SwipeSurface>
      </MotionPanel>

      <div className="flex items-center justify-between gap-os-2">
        {stepIndex > 0 ? (
          <Button
            variant="ghost"
            onClick={() => changeSlide(-1)}
            disabled={createMutation.isPending}
          >
            이전 안내
          </Button>
        ) : null}
        <p className="os-swipe-hint">{stepIndex + 1} / {SLIDES.length}</p>
      </div>

      <div className="os-action-dock flex flex-col gap-os-2 sm:flex-row">
        <Button variant="ghost" className="w-full sm:w-auto" onClick={handleSkip}>
          건너뛰기
        </Button>
        {isLast ? (
            <Button
              variant="primary"
              onClick={handleKickoff}
              disabled={createMutation.isPending}
              className="os-num w-full min-w-0 flex-1 whitespace-normal font-bold uppercase"
              style={{
                fontSize: 'var(--os-fs-h2)',
                lineHeight: 'var(--os-lh-h2)',
                letterSpacing: 'var(--os-tracking-display)',
              }}
            >
              KICKOFF · 새 인생 시작
            </Button>
        ) : (
          <Button variant="primary" className="flex-1" onClick={() => changeSlide(1)}>
            다음
          </Button>
        )}
      </div>
      {toast ? <Toast variant="error" message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
