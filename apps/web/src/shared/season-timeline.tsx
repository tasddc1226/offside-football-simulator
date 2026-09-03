// SCR-029 06 "핵심 컴포넌트": 시즌 12 step을 phase별 색 토큰으로, 지나간/현재/예정 step과 결정
// 슬롯 표식을 함께 보여준다. hex 리터럴 대신 --os-* 토큰(Tailwind 유틸리티로 노출된 것만)을 쓴다.
import type { SeasonPhase, SeasonStep } from '@offside/domain';
import { DECISION_SLOT_KIND_LABEL_KO, SEASON_PHASE_LABEL_KO } from './labels.js';

const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

// RULE-TIME-001 기본 캘린더는 CUP·TRANSFER_WINDOW를 별도 phase로 쓰지 않지만(컵·이적창은 LEAGUE
// step 안의 오버레이), leagueCalendar가 다른 값을 줄 수 있어 SeasonPhase 5종 전부를 매핑해 둔다.
const PHASE_DOT_CLASS: Record<SeasonPhase, string> = {
  PRESEASON: 'bg-os-neutral',
  LEAGUE: 'bg-os-accent',
  CUP: 'bg-os-warning',
  TRANSFER_WINDOW: 'bg-os-focus',
  SETTLEMENT: 'bg-os-success',
};

// bg-os-accent(노랑)만 밝아 어두운 text-os-on-accent가 맞고, 나머지 phase 배경(성공·경고·포커스·
// 중립)은 전부 어두운 톤이라 밝은 text-os-surface가 맞다(WCAG AA 4.5:1) — 하나로 통일하면 대비가
// 깨진다(axe color-contrast, SCR-011/012 발견).
const PHASE_TEXT_CLASS: Record<SeasonPhase, string> = {
  PRESEASON: 'text-os-surface',
  LEAGUE: 'text-os-on-accent',
  CUP: 'text-os-surface',
  TRANSFER_WINDOW: 'text-os-surface',
  SETTLEMENT: 'text-os-surface',
};

type StepState = 'PASSED' | 'CURRENT' | 'UPCOMING';

const STEP_STATE_LABEL_KO: Record<StepState, string> = {
  PASSED: '지난 step',
  CURRENT: '진행 중',
  UPCOMING: '예정',
};

function stepState(step: SeasonStep, currentStep: number): StepState {
  if (step.summary !== null) return 'PASSED';
  if (step.index === currentStep) return 'CURRENT';
  return 'UPCOMING';
}

export function SeasonTimeline({ steps, currentStep }: { steps: SeasonStep[]; currentStep: number }) {
  return (
    <ol className="flex flex-wrap gap-os-2" aria-label="시즌 진행 12 step">
      {steps.map((step) => {
        const state = stepState(step, currentStep);
        const slots = step.decisionSlots;
        return (
          <li
            key={step.index}
            aria-label={`step ${step.index} ${SEASON_PHASE_LABEL_KO[step.phase]} ${STEP_STATE_LABEL_KO[state]}`}
            className={[
              'flex flex-col items-center gap-os-1 rounded-os-s border-2 p-os-1',
              state === 'CURRENT' ? 'border-os-accent' : 'border-os-border',
              state === 'UPCOMING' ? 'border-dashed' : 'border-solid',
            ].join(' ')}
            style={{ minWidth: '2.5rem' }}
          >
            <span aria-hidden="true" className={['os-num inline-flex h-os-4 w-os-4 items-center justify-center rounded-os-s font-os', PHASE_DOT_CLASS[step.phase], PHASE_TEXT_CLASS[step.phase]].join(' ')} style={CAPTION_STYLE}>
              {step.index}
            </span>
            {slots.length > 0 ? (
              <span className="flex flex-col items-center font-os text-os-text-2" style={CAPTION_STYLE}>
                {slots.map((slot, slotIndex) => (
                  <span key={slotIndex} className={slot.skippedByBudget ? 'opacity-40 line-through' : ''}>
                    {DECISION_SLOT_KIND_LABEL_KO[slot.kind]}
                  </span>
                ))}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
