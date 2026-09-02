import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompareCards } from './CompareCards.js';

const CARDS = [
  {
    id: 'a',
    title: '한강 FC',
    renderAction: (layout: 'stacked' | 'grid') => (
      <button type="button" id={`select-a-${layout}`}>
        한강 FC 선택
      </button>
    ),
  },
  {
    id: 'b',
    title: '서울 유나이티드',
    renderAction: (layout: 'stacked' | 'grid') => (
      <button type="button" id={`select-b-${layout}`}>
        서울 유나이티드 선택
      </button>
    ),
  },
  {
    id: 'c',
    title: '부산 시티',
    renderAction: (layout: 'stacked' | 'grid') => (
      <button type="button" id={`select-c-${layout}`}>
        부산 시티 선택
      </button>
    ),
  },
];

const ROWS = [
  { id: 'role', label: '역할', cells: [{ value: 'STARTER', highlighted: true }, { value: 'BENCH' }, { value: 'BENCH' }] },
  { id: 'fit', label: '전술 적합도', cells: [{ value: '72' }, { value: '65' }, { value: '58' }] },
];

describe('CompareCards', () => {
  it('renders a mobile stacked layout without horizontal scroll classes', () => {
    render(<CompareCards cards={CARDS} rows={ROWS} />);

    const stacked = document.querySelector('[data-compare-layout="stacked"]');
    expect(stacked).not.toBeNull();
    expect(stacked?.className).not.toMatch(/overflow-x/);
    expect(stacked?.className).toContain('flex-col');
  });

  it('renders every card and row in the stacked layout', () => {
    render(<CompareCards cards={CARDS} rows={ROWS} />);
    const stacked = document.querySelector('[data-compare-layout="stacked"]') as HTMLElement;

    for (const card of CARDS) {
      const cardBlock = within(stacked).getByText(card.title).closest('div');
      expect(cardBlock).not.toBeNull();
      expect(within(cardBlock as HTMLElement).getByText('역할')).toBeInTheDocument();
    }
  });

  it('renders a desktop grid layout with one column per card plus a label column', () => {
    render(<CompareCards cards={CARDS} rows={ROWS} />);
    const grid = document.querySelector('[data-compare-layout="grid"]') as HTMLElement;

    expect(grid.style.gridTemplateColumns).toContain('minmax(120px, 1fr)');
    expect(within(grid).getAllByText(/^(한강 FC|서울 유나이티드|부산 시티)$/)).toHaveLength(3);
  });

  it('calls renderAction once per layout with a distinguishable layout id, avoiding duplicate DOM ids', () => {
    render(<CompareCards cards={CARDS} rows={ROWS} />);

    const buttons = screen.getAllByRole('button', { name: '한강 FC 선택' });
    expect(buttons).toHaveLength(2);

    const ids = buttons.map((button) => button.id).sort();
    expect(ids).toEqual(['select-a-grid', 'select-a-stacked']);
  });
});
