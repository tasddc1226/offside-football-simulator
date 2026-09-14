import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadRuleset } from '@offside/content';
import { AccentPresetPicker } from './AccentPresetPicker.js';

// 구단 컬러 프리셋은 룰셋 1.5.0(K1 12개)을 직접 읽는다(AccentPresetPicker.tsx 참고) — activeRuleset이
// 아직 1.4.0이라도 라벨이 항상 정확한 팀명을 쓴다.
const presetRuleset = loadRuleset('1.5.0');

describe('AccentPresetPicker', () => {
  it('각 프리셋을 색 이름 라벨의 radio 타일로 노출하고, 선택 항목만 checked다(UX-013 다듬기: 그리드 하단 "선택: <이름>" 캡션은 없앴다 — aria-checked로 확인)', () => {
    render(<AccentPresetPicker value="green" onValueChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: '홈 색상' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '그린' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '네이비(기본)' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.queryByTestId('swatch-caption')).not.toBeInTheDocument();
  });

  it('UX-013 다듬기: 구단 타일 아래 보이는 캡션은 "컬러" 접미사 없이 팀 이름만 쓴다(aria-label·요약줄 이름은 그대로 "<팀명> 컬러")', () => {
    render(<AccentPresetPicker value="DEFAULT" onValueChange={vi.fn()} />);

    const team = presetRuleset.teams.find((candidate) => candidate.id === 'suwon-hwahong-fc');
    expect(team).toBeDefined();
    const teamName = team?.name ?? '';
    const radio = screen.getByRole('radio', { name: `${teamName} 컬러` });
    const caption = radio
      .closest('.os-swatch-tile-wrap')
      ?.querySelector('.os-swatch-tile-label');

    expect(caption).toHaveTextContent(teamName);
    expect(caption?.textContent).not.toContain('컬러');
  });

  it('UX-013: 활성 룰셋 12개 구단 컬러 프리셋을 "구단" 그룹에 "<팀명> 컬러"로 노출한다', () => {
    render(<AccentPresetPicker value="DEFAULT" onValueChange={vi.fn()} />);

    const teamGroup = screen.getByRole('group', { name: '구단' });
    expect(screen.getByRole('group', { name: '기본' })).toBeInTheDocument();
    expect(teamGroup.querySelectorAll('[role="radio"]')).toHaveLength(12);
    const firstTeam = presetRuleset.teams.find((candidate) => candidate.id === 'seoul-hangang-fc');
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

    const team = presetRuleset.teams.find((candidate) => candidate.id === 'jeju-halla-city');
    await user.click(screen.getByRole('radio', { name: `${team?.name} 컬러` }));

    expect(onValueChange).toHaveBeenCalledWith('team-jeju-halla-city');
  });
});
