import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { useId } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

export interface SwatchTileOption {
  id: string;
  /** 타일의 접근 가능한 이름(aria-label) — 색만으로 구분하지 않기 위함. */
  label: string;
  /** 타일 아래 보이는 캡션. 생략 시 label을 그대로 쓴다. label과 다른 값을 주면(예: 구단 프리셋의
   * "<팀명> 컬러"에서 "컬러"를 뺀 짧은 이름) 캡션만 짧아지고 aria-label은 그대로 유지된다 — 문자열
   * 가공은 호출부(예: apps/web accent-presets.ts) 몫이고 ui는 caption ?? label만 그린다. */
  caption?: string;
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
  className?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}

/**
 * UX-013 홈 색상 프리셋 타일 그리드. 하나의 radiogroup 안에 그룹별 4열 3:2 타일(radio)을 두고,
 * 선택 타일은 링 + 체크 아이콘으로 표시한다. Radix RadioGroup이 화살표 키 이동·Space 선택을 맡고,
 * Enter는 packages/ui RadioGroupItem과 같은 이유로 클릭을 합성한다.
 * 게임 규칙을 계산하지 않는다 — 옵션·라벨·캡션·색 변수는 전부 props다.
 *
 * UX-013 후속: 마우스 사용자는 aria-label(스크린리더 전용)만으로 타일을 구분할 수 없으므로 각 타일
 * 아래 이름을 보이는 캡션(aria-hidden, caption ?? label — 라디오의 aria-label과 같은 뜻이라
 * 중복 낭독 방지)으로도 그린다. 그룹 소제목 id는 useId()로 인스턴스마다 고유해 한 페이지에 두 개를
 * 렌더해도 겹치지 않는다.
 *
 * UX-013 다듬기: 그리드 하단에 "선택: <이름>" 캡션을 따로 그리지 않는다 — 선택 상태는 타일의
 * aria-checked·체크 아이콘과, 호출부가 접이식 요약줄에 이미 보여주는 현재 프리셋 이름으로 충분하다.
 */
export function SwatchTilePicker({
  groups,
  value,
  onValueChange,
  columns = 4,
  className,
  ...ariaProps
}: SwatchTilePickerProps) {
  const instanceId = useId();
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
                    {/* radio의 aria-label과 같은 뜻(caption ?? label)이라 스크린리더 중복 낭독을
                        막기 위해 숨긴다. title은 말줄임된 이름을 마우스 사용자가 호버로 온전히
                        볼 수 있게 한다. */}
                    <span
                      className="os-swatch-tile-label"
                      aria-hidden="true"
                      title={option.caption ?? option.label}
                    >
                      {option.caption ?? option.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </RadioGroupPrimitive.Root>
    </div>
  );
}
