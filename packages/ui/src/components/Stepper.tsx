export interface StepperStep {
  id: string;
  /** 단계 라벨. 호출자가 문구를 전달한다. */
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  currentStepId: string;
}

type StepStatus = 'complete' | 'current' | 'upcoming';

const MARKER_CLASS: Record<StepStatus, string> = {
  complete: 'bg-os-surface-2 text-os-text border border-os-border',
  current: 'bg-os-accent text-os-on-accent border border-os-accent',
  upcoming: 'bg-os-surface text-os-text-2 border border-os-border',
};

export function Stepper({ steps, currentStepId }: StepperProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);

  return (
    <ol className="flex items-start gap-os-2" aria-label={`${currentIndex + 1} / ${steps.length}`}>
      {steps.map((step, index) => {
        const status: StepStatus = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';

        return (
          <li key={step.id} className="flex flex-1 flex-col items-center gap-os-1" aria-current={status === 'current' ? 'step' : undefined}>
            <span
              aria-hidden="true"
              className={['os-num flex items-center justify-center rounded-full font-os font-semibold', MARKER_CLASS[status]].join(' ')}
              style={{
                minHeight: 'var(--os-space-6)',
                minWidth: 'var(--os-space-6)',
                fontSize: 'var(--os-fs-num-sm)',
                lineHeight: 'var(--os-lh-num-sm)',
              }}
            >
              {index + 1}
            </span>
            <span
              className="font-os text-center text-os-text-2"
              style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
