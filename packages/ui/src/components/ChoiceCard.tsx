import { RadioGroupItem } from './RadioGroup.js';
import type { RadioGroupItemProps } from './RadioGroup.js';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

const RISK_COLOR_CLASS: Record<RiskLevel, string> = {
  LOW: 'text-os-success',
  MEDIUM: 'text-os-warning',
  HIGH: 'text-os-danger',
};

const RISK_ICON: Record<RiskLevel, string> = {
  LOW: '●',
  MEDIUM: '▲',
  HIGH: '!',
};

export interface ChoiceCardProps extends Omit<RadioGroupItemProps, 'children'> {
  /** 선택지 문구. */
  label: string;
  riskLevel: RiskLevel;
  /** 위험 등급 문구(예: "낮음"). 13-visual-design-system.md DSN-CMP-003. */
  riskLabel: string;
  /** 미리보기 예상 효과 문장 목록. */
  effects: string[];
  /** 선택됨을 알리는 문구(13 DSN-CMP-002 "선택됨"). */
  selectedLabel: string;
  /** 잠금 상태일 때 보여줄 사유 문장(06-ui-ux-specification.md 잠긴 구역 표시). */
  lockReason?: string;
}

export function ChoiceCard({
  label,
  riskLevel,
  riskLabel,
  effects,
  selectedLabel,
  lockReason,
  className,
  disabled,
  ...props
}: ChoiceCardProps) {
  const classes = ['group flex flex-col gap-os-3 p-os-4 data-[state=checked]:border-2 data-[state=checked]:border-os-accent', className]
    .filter(Boolean)
    .join(' ');

  return (
    <RadioGroupItem className={classes} disabled={disabled} {...props}>
      <div className="flex items-start justify-between gap-os-3">
        <p className="font-os font-semibold text-os-text" style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}>
          {label}
        </p>
        <span className="flex items-center gap-os-1 font-os" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
          <span aria-hidden="true" className={RISK_COLOR_CLASS[riskLevel]}>
            {RISK_ICON[riskLevel]}
          </span>
          <span className="text-os-text">{riskLabel}</span>
        </span>
      </div>

      {effects.length > 0 ? (
        <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
          {effects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
      ) : null}

      <span className="hidden items-center gap-os-1 font-os font-semibold text-os-text group-data-[state=checked]:inline-flex" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
        <span aria-hidden="true" className="text-os-success">
          ✓
        </span>
        {selectedLabel}
      </span>

      {disabled && lockReason ? (
        <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
          {lockReason}
        </p>
      ) : null}
    </RadioGroupItem>
  );
}
