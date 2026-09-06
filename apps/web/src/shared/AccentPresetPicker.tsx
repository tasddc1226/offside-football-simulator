// UX-004: 설정 "표시·접근성" 섹션의 "포인트 색상" 항목. settings.tsx 삽입을 최소화하려고 별도
// 파일로 뺐다. RadioGroup(Radix 기반이라 화살표 키·Tab·Enter/Space로 조작 가능)에 프리셋마다
// 원형 스와치(실제 색은 tokens.css --os-swatch-*)와 한국어 색 이름을 함께 채운다. 선택 상태는
// packages/ui의 .os-radio-item[data-state='checked'] 테두리·배경(다른 라디오 그룹과 동일한
// 기존 패턴)에 더해, 스와치 안 체크 표시로 색만으로 구분하지 않게 한다.
import { RadioGroup, RadioGroupItem } from '@offside/ui';
import { ACCENT_PRESET_OPTIONS, type AccentPresetId } from './accent-presets.js';

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const SWATCH_SIZE = 28;

export interface AccentPresetPickerProps {
  value: AccentPresetId;
  onValueChange: (value: AccentPresetId) => void;
}

export function AccentPresetPicker({ value, onValueChange }: AccentPresetPickerProps) {
  return (
    <section className="flex flex-col gap-os-3">
      <h2
        id="settings-accent-preset"
        className="font-os font-semibold text-os-text"
        style={H2_STYLE}
      >
        포인트 색상
      </h2>
      <RadioGroup
        aria-labelledby="settings-accent-preset"
        value={value}
        onValueChange={(next) => onValueChange(next as AccentPresetId)}
      >
        {ACCENT_PRESET_OPTIONS.map((option) => {
          const checked = value === option.id;
          return (
            <RadioGroupItem
              key={option.id}
              value={option.id}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--os-space-3)' }}
            >
              <span
                aria-hidden="true"
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-os-border"
                style={{
                  width: SWATCH_SIZE,
                  height: SWATCH_SIZE,
                  backgroundColor: `var(${option.swatchVar})`,
                }}
              >
                {checked ? (
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    className="text-os-on-accent"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8.5l3 3 7-7" />
                  </svg>
                ) : null}
              </span>
              <span className="font-os text-os-text">{option.label}</span>
            </RadioGroupItem>
          );
        })}
      </RadioGroup>
    </section>
  );
}
