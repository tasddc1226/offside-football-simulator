import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { activeRuleset } from '../engine/content.js';
import { AccentPresetPicker } from './AccentPresetPicker.js';

describe('AccentPresetPicker', () => {
  it('각 프리셋을 색 이름 라벨의 radio 타일로 노출하고, 선택 항목만 checked이며 캡션에 선택 이름을 쓴다', () => {
    render(<AccentPresetPicker value="green" onValueChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: '홈 색상' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '그린' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '네이비(기본)' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByTestId('swatch-caption')).toHaveTextContent('선택: 그린');
  });

  it('UX-013: 활성 룰셋 12개 구단 컬러 프리셋을 "구단" 그룹에 "<팀명> 컬러"로 노출한다', () => {
    render(<AccentPresetPicker value="DEFAULT" onValueChange={vi.fn()} />);

    const teamGroup = screen.getByRole('group', { name: '구단' });
    expect(screen.getByRole('group', { name: '기본' })).toBeInTheDocument();
    expect(teamGroup.querySelectorAll('[role="radio"]')).toHaveLength(12);
    const firstTeam = activeRuleset.teams[0];
    expect(firstTeam).toBeDefined();
    expect(screen.getByRole('radio', { name: `${firstTeam?.name ?? ''} 컬러` })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('화살표 키로 이동해 Space로 고르면 onValueChange가 그 프리셋 id로 불린다', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AccentPresetPicker value="DEFAULT" onValueChange={onValueChange} />);

    screen.getByRole('radio', { name: '네이비(기본)' }).focus();
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');

    expect(onValueChange).toHaveBeenCalledWith('green');
  });

  it('구단 타일을 클릭하면 team-<id> 프리셋 id로 불린다', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AccentPresetPicker value="DEFAULT" onValueChange={onValueChange} />);

    const team = activeRuleset.teams.find((candidate) => candidate.id === 'geumbit-fc');
    await user.click(screen.getByRole('radio', { name: `${team?.name} 컬러` }));

    expect(onValueChange).toHaveBeenCalledWith('team-geumbit-fc');
  });
});
