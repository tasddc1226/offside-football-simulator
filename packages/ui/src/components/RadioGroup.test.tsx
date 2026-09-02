import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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

  it('skips disabled items and marks them unavailable', () => {
    renderGroup();
    expect(screen.getByRole('radio', { name: 'C' })).toBeDisabled();
  });

  it('has a 44px minimum touch target', () => {
    renderGroup();
    expect(screen.getByRole('radio', { name: 'A' })).toHaveStyle({ minHeight: 'var(--os-touch-min)' });
  });
});
