import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup, RadioGroupItem } from './RadioGroup.js';

function renderGroup() {
  return render(
    <RadioGroup defaultValue="a" aria-label="테스트 그룹">
      <RadioGroupItem value="a">A</RadioGroupItem>
      <RadioGroupItem value="b">B</RadioGroupItem>
      <RadioGroupItem value="c" disabled>
        C
      </RadioGroupItem>
    </RadioGroup>,
  );
}

describe('RadioGroup', () => {
  it('renders radio items with the correct checked state', () => {
    renderGroup();
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'false');
  });

  it('moves focus with arrow keys and selects the focused item with Space', async () => {
    const user = userEvent.setup();
    renderGroup();

    screen.getByRole('radio', { name: 'A' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'B' })).toHaveFocus();

    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'false');
  });

  it('selects the focused item with Enter and calls onValueChange once', async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" aria-label="테스트 그룹" onValueChange={handleValueChange}>
        <RadioGroupItem value="a">A</RadioGroupItem>
        <RadioGroupItem value="b">B</RadioGroupItem>
      </RadioGroup>,
    );

    // 화살표 이동이 아니라 포커스만 옮겨(.focus()) Radix의 "화살표로 이동 시 자동 선택"
    // 경로를 배제하고 Enter 자체의 선택 동작만 검증한다.
    screen.getByRole('radio', { name: 'B' }).focus();
    await user.keyboard('{Enter}');

    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'false');
  });

  it('does nothing when Enter is pressed on the already-selected item', async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" aria-label="테스트 그룹" onValueChange={handleValueChange}>
        <RadioGroupItem value="a">A</RadioGroupItem>
        <RadioGroupItem value="b">B</RadioGroupItem>
      </RadioGroup>,
    );

    screen.getByRole('radio', { name: 'A' }).focus();
    await user.keyboard('{Enter}');

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
  });

  it('skips disabled items and marks them unavailable', () => {
    renderGroup();
    expect(screen.getByRole('radio', { name: 'C' })).toBeDisabled();
  });

  it('has a 44px minimum touch target', () => {
    renderGroup();
    expect(screen.getByRole('radio', { name: 'A' })).toHaveStyle({ minHeight: 'var(--os-touch-min)' });
  });
});
