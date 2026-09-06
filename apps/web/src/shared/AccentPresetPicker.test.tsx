import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccentPresetPicker } from './AccentPresetPicker.js';

describe('AccentPresetPicker', () => {
  it('각 프리셋을 색 이름 라벨로 노출하고, 선택 항목만 checked다', () => {
    render(<AccentPresetPicker value="green" onValueChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: '그린' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '네이비(기본)' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('화살표 키로 이동해 Space로 고르면 onValueChange가 그 프리셋 id로 불린다', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AccentPresetPicker value="DEFAULT" onValueChange={onValueChange} />);

    screen.getByRole('radio', { name: '네이비(기본)' }).focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');

    expect(onValueChange).toHaveBeenCalledWith('green');
  });
});
