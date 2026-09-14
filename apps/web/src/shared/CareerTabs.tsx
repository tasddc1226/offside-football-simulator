// UX-014 커리어 대시보드 4탭(시즌·커리어·선수·우승 연혁). 루트 앱 셸 헤더(CareerHeaderBar)와
// 탭 내용(career.$careerId.index.tsx의 TabsContent)은 서로 다른 React 서브트리라 Radix Tabs.Root의
// 공유 컨텍스트로 묶을 수 없다 — 이 컴포넌트는 독립된 접근성 있는 tablist고, 선택은 URL(`?view=`)
// 로만 동기화한다(패널 쪽은 그 값을 그대로 받아 Tabs.Root value로만 쓴다). role="tab" 버튼이라
// Enter·Space는 네이티브 클릭으로 이미 동작하고, 화살표 키만 직접 구현한다(롤링 tabindex).
import { useRef, type KeyboardEvent } from 'react';

export interface CareerTabItem {
  value: string;
  label: string;
}

export interface CareerTabsProps {
  items: readonly CareerTabItem[];
  active: string;
  onChange: (value: string) => void;
}

export function CareerTabs({ items, active, onChange }: CareerTabsProps) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function selectAndFocus(index: number) {
    const item = items[(index + items.length) % items.length];
    if (item === undefined) return;
    onChange(item.value);
    buttonRefs.current[item.value]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectAndFocus(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectAndFocus(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectAndFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectAndFocus(items.length - 1);
    }
  }

  return (
    <div className="os-career-tabs" role="tablist" aria-label="커리어 구역">
      {items.map((item, index) => {
        const selected = item.value === active;
        return (
          <button
            key={item.value}
            ref={(el) => {
              buttonRefs.current[item.value] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="os-career-tab"
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
