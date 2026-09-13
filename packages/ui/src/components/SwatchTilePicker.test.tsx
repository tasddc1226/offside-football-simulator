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

  it('UX-013 다듬기: caption을 주면 보이는 캡션은 caption을, aria-label은 label을 그대로 쓴다', () => {
    const groupsWithCaption: readonly SwatchTileGroup[] = [
      {
        id: 'team',
        label: '구단',
        options: [
          { id: 'x', label: '금빛 FC 컬러', caption: '금빛 FC', swatchVar: '--os-swatch-team-x' },
        ],
      },
    ];

    render(
      <SwatchTilePicker
        groups={groupsWithCaption}
        value="x"
        onValueChange={vi.fn()}
        aria-label="테스트"
      />,
    );

    expect(screen.getByRole('radio', { name: '금빛 FC 컬러' })).toBeInTheDocument();
    const label = document.querySelector('.os-swatch-tile-label');
    expect(label).toHaveTextContent('금빛 FC');
    expect(label).not.toHaveTextContent('컬러');
  });

  it('UX-013 다듬기: 그리드 하단에 "선택: <이름>" 캡션을 더는 그리지 않는다 — 선택 상태는 aria-checked로 확인한다', () => {
    render(
      <SwatchTilePicker groups={GROUPS} value="b" onValueChange={vi.fn()} aria-label="테스트" />,
    );

    expect(screen.queryByTestId('swatch-caption')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '그린' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '네이비' })).toHaveAttribute('aria-checked', 'false');
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
