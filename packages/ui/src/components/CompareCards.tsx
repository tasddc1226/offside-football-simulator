import type { ReactNode } from 'react';

export type CompareCardsLayout = 'stacked' | 'grid';

export interface CompareCardItem {
  id: string;
  title: string;
  /**
   * 카드 하단 주 버튼 슬롯. 두 레이아웃(모바일 스택·데스크톱 그리드)이 DOM에 동시에
   * 그려지므로, 호출자가 layout별로 다른 key/id를 붙일 수 있게 렌더 함수로 받는다.
   */
  renderAction?: (layout: CompareCardsLayout) => ReactNode;
}

export interface CompareCardCell {
  value: string;
  /** 강조 여부(예: 다른 카드와 값이 다른 행). */
  highlighted?: boolean;
}

export interface CompareRow {
  id: string;
  label: string;
  /** cards와 같은 순서·길이의 값 목록. */
  cells: CompareCardCell[];
}

export interface CompareCardsProps {
  /** 2~3개 카드. */
  cards: CompareCardItem[];
  rows: CompareRow[];
}

export function CompareCards({ cards, rows }: CompareCardsProps) {
  return (
    <div>
      <div className="flex flex-col gap-os-4 lg:hidden" data-compare-layout="stacked">
        {cards.map((card, cardIndex) => (
          <div key={card.id} className="flex flex-col gap-os-3 rounded-os-m border border-os-border bg-os-surface p-os-4">
            <h3 className="font-os font-semibold text-os-text" style={{ fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' }}>
              {card.title}
            </h3>
            <dl className="flex flex-col gap-os-2">
              {rows.map((row) => {
                const cell = row.cells[cardIndex];
                return (
                  <div key={row.id} className="flex items-baseline justify-between gap-os-2">
                    <dt className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
                      {row.label}
                    </dt>
                    <dd
                      className={[
                        'os-num font-os',
                        cell?.highlighted ? 'rounded-os-s bg-os-surface-2 px-os-2 font-semibold text-os-text' : 'text-os-text',
                      ].join(' ')}
                      style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}
                    >
                      {cell?.value}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {card.renderAction?.('stacked')}
          </div>
        ))}
      </div>

      <div
        className="hidden gap-os-3 lg:grid"
        style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${cards.length}, 2fr)` }}
        data-compare-layout="grid"
      >
        <div aria-hidden="true" />
        {cards.map((card) => (
          <h3
            key={card.id}
            className="font-os font-semibold text-os-text"
            style={{ fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' }}
          >
            {card.title}
          </h3>
        ))}

        {rows.flatMap((row) => [
          <div key={`${row.id}-label`} className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
            {row.label}
          </div>,
          ...row.cells.map((cell, cellIndex) => (
            <div
              key={`${row.id}-${cards[cellIndex]?.id ?? cellIndex}`}
              className={['os-num font-os', cell.highlighted ? 'rounded-os-s bg-os-surface-2 px-os-2 font-semibold text-os-text' : 'text-os-text'].join(' ')}
              style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}
            >
              {cell.value}
            </div>
          )),
        ])}

        <div aria-hidden="true" />
        {cards.map((card) => (
          <div key={`${card.id}-action`}>{card.renderAction?.('grid')}</div>
        ))}
      </div>
    </div>
  );
}
