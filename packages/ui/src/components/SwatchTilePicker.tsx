import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { useId } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

export interface SwatchTileOption {
  id: string;
  /** 타일의 접근 가능한 이름(aria-label)이자 캡션에 쓰는 이름 — 색만으로 구분하지 않기 위함. */
  label: string;
  /** 타일 배경으로 쓸 CSS 커스텀 프로퍼티 이름(예: '--os-swatch-green'). */
  swatchVar: string;
}

export interface SwatchTileGroup {
  id: string;
  /** 그룹 소제목. 그룹이 하나뿐이면 그리지 않는다. */
  label: string;
  options: readonly SwatchTileOption[];
}

export interface SwatchTilePickerProps {
  groups: readonly SwatchTileGroup[];
  value: string;
  onValueChange: (value: string) => void;
  /** 그리드 열 수(기본 4). */
  columns?: number;
  /** 캡션 접두어(기본 "선택"). 캡션은 "<접두어>: <선택 이름>"으로 그린다. */
  captionPrefix?: string;
  className?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}

/**
 * UX-013 홈 색상 프리셋 타일 그리드. 하나의 radiogroup 안에 그룹별 4열 3:2 타일(radio)을 두고,
 * 선택 타일은 링 + 체크 아이콘, 아래 캡션에 선택 이름을 병기한다. Radix RadioGroup이 화살표 키
 * 이동·Space 선택을 맡고, Enter는 packages/ui RadioGroupItem과 같은 이유로 클릭을 합성한다.
 * 게임 규칙을 계산하지 않는다 — 옵션·라벨·색 변수는 전부 props다.
 *
 * UX-013 후속: 마우스 사용자는 aria-label(스크린리더 전용)만으로 타일을 구분할 수 없으므로 각 타일
 * 아래 이름을 보이는 캡션(aria-hidden, 라디오의 aria-label과 같은 문구라 중복 낭독 방지)으로도
 * 그린다. 그룹 소제목 id는 useId()로 인스턴스마다 고유해 한 페이지에 두 개를 렌더해도 겹치지 않는다.
 */
export function SwatchTilePicker({
  groups,
  value,
  onValueChange,
  columns = 4,
  captionPrefix = '선택',
  className,
  ...ariaProps
}: SwatchTilePickerProps) {
  const instanceId = useId();
  const selected = groups.flatMap((group) => group.options).find((option) => option.id === value);
  const classes = ['os-swatch-picker', className].filter(Boolean).join(' ');
  const gridStyle = { '--os-swatch-columns': String(columns) } as CSSProperties;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.defaultPrevented || event.key !== 'Enter') return;
    event.preventDefault();
    event.currentTarget.click();
  }

  return (
    <div className={classes}>
      <RadioGroupPrimitive.Root
        className="os-swatch-groups"
        value={value}
        onValueChange={onValueChange}
        {...ariaProps}
      >
        {groups.map((group) => {
          const groupLabelId = `${instanceId}-swatch-group-${group.id}`;
          const showLabel = groups.length > 1;
          return (
            <div
              key={group.id}
              className="os-swatch-group"
              role={showLabel ? 'group' : undefined}
              aria-labelledby={showLabel ? groupLabelId : undefined}
            >
              {showLabel ? (
                <p id={groupLabelId} className="os-eyebrow">
                  {group.label}
                </p>
              ) : null}
              <div className="os-swatch-grid" style={gridStyle}>
                {group.options.map((option) => (
                  <div key={option.id} className="os-swatch-tile-wrap">
                    <RadioGroupPrimitive.Item
                      value={option.id}
                      aria-label={option.label}
                      className="os-swatch-tile"
                      style={{ background: `var(${option.swatchVar})` }}
                      onKeyDown={handleKeyDown}
                    >
                      <RadioGroupPrimitive.Indicator className="os-swatch-tile-check">
                        <svg
                          viewBox="0 0 16 16"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 8.5l3 3 7-7" />
                        </svg>
                      </RadioGroupPrimitive.Indicator>
                    </RadioGroupPrimitive.Item>
                    {/* radio의 aria-label과 같은 문구 — 스크린리더 중복 낭독을 막기 위해 숨긴다.
                        title은 말줄임된 이름을 마우스 사용자가 호버로 온전히 볼 수 있게 한다. */}
                    <span className="os-swatch-tile-label" aria-hidden="true" title={option.label}>
                      {option.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </RadioGroupPrimitive.Root>
      <p className="os-swatch-caption" data-testid="swatch-caption">
        {captionPrefix}: {selected?.label ?? '—'}
      </p>
    </div>
  );
}
