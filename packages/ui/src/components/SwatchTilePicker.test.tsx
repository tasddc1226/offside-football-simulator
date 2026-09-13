import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SwatchTilePicker, type SwatchTileGroup } from './SwatchTilePicker.js';

const GROUPS: readonly SwatchTileGroup[] = [
  {
    id: 'base',
    label: '기본',
    options: [
      { id: 'a', label: '네이비', swatchVar: '--os-swatch-default' },
      { id: 'b', label: '그린', swatchVar: '--os-swatch-green' },
    ],
  },
];

describe('SwatchTilePicker', () => {
  it('UX-013 후속: 각 타일 아래 이름을 보이는 캡션(aria-hidden)으로도 그린다 — radio의 aria-label과 같은 문구라 낭독은 한 번뿐', () => {
    render(
      <SwatchTilePicker groups={GROUPS} value="a" onValueChange={vi.fn()} aria-label="테스트" />,
    );

    const radio = screen.getByRole('radio', { name: '그린' });
    const label = radio.closest('.os-swatch-tile-wrap')?.querySelector('.os-swatch-tile-label');

    expect(label).not.toBeNull();
    expect(label).toHaveTextContent('그린');
    expect(label).toHaveAttribute('aria-hidden', 'true');
  });

  it('UX-013 후속: 그룹 소제목 id는 useId() 기반이라 한 페이지에 두 개를 렌더해도 겹치지 않는다', () => {
    const twoGroups: readonly SwatchTileGroup[] = [
      {
        id: 'base',
        label: '기본',
        options: [{ id: 'a', label: '네이비', swatchVar: '--os-swatch-default' }],
      },
      {
        id: 'team',
        label: '구단',
        options: [{ id: 'b', label: '금빛 FC 컬러', swatchVar: '--os-swatch-team-x' }],
      },
    ];

    render(
      <>
        <SwatchTilePicker
          groups={twoGroups}
          value="a"
          onValueChange={vi.fn()}
          aria-label="첫 번째"
        />
        <SwatchTilePicker
          groups={twoGroups}
          value="a"
          onValueChange={vi.fn()}
          aria-label="두 번째"
        />
      </>,
    );

    const groupLabelIds = Array.from(document.querySelectorAll('.os-eyebrow')).map(
      (node) => node.id,
    );
    expect(groupLabelIds).toHaveLength(4);
    expect(new Set(groupLabelIds).size).toBe(groupLabelIds.length);
    expect(screen.getAllByRole('group', { name: '기본' })).toHaveLength(2);
  });
});
