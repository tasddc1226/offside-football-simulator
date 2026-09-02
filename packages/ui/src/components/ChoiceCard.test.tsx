import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ChoiceCard } from './ChoiceCard.js';
import { RadioGroup } from './RadioGroup.js';

function renderChoices() {
  return render(
    <RadioGroup defaultValue="stay" aria-label="진로 선택">
      <ChoiceCard
        value="stay"
        label="아카데미 잔류"
        riskLevel="LOW"
        riskLabel="낮음"
        effects={['정찰 범위 유지']}
        selectedLabel="선택됨"
      />
      <ChoiceCard
        value="trial"
        label="입단 테스트"
        riskLevel="HIGH"
        riskLabel="높음"
        effects={['실패 시 하부 리그로']}
        selectedLabel="선택됨"
      />
      <ChoiceCard
        value="locked"
        label="대학 진학"
        riskLevel="MEDIUM"
        riskLabel="보통"
        effects={[]}
        selectedLabel="선택됨"
        disabled
        lockReason="Phase 3 콘텐츠에서 열립니다"
      />
    </RadioGroup>,
  );
}

describe('ChoiceCard', () => {
  it('renders the label, risk badge, and preview effects', () => {
    renderChoices();
    expect(screen.getByText('아카데미 잔류')).toBeInTheDocument();
    expect(screen.getByText('낮음')).toBeInTheDocument();
    expect(screen.getByText('정찰 범위 유지')).toBeInTheDocument();
  });

  it('marks the selected card with data-state=checked and CSS-gates the "선택됨" badge to it', () => {
    renderChoices();
    const selected = screen.getByRole('radio', { name: /아카데미 잔류/ });
    const other = screen.getByRole('radio', { name: /입단 테스트/ });

    expect(selected).toHaveAttribute('data-state', 'checked');
    expect(other).toHaveAttribute('data-state', 'unchecked');

    const badge = within(selected).getByText('선택됨');
    expect(badge.className).toContain('group-data-[state=checked]:inline-flex');
  });

  it('moves focus between enabled cards with arrow keys and selects with Space', async () => {
    const user = userEvent.setup();
    renderChoices();

    screen.getByRole('radio', { name: /아카데미 잔류/ }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: /입단 테스트/ })).toHaveFocus();

    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: /입단 테스트/ })).toHaveAttribute('data-state', 'checked');
    expect(screen.getByRole('radio', { name: /아카데미 잔류/ })).toHaveAttribute('data-state', 'unchecked');
  });

  it('cannot select a locked card and shows the lock reason', async () => {
    const user = userEvent.setup();
    renderChoices();

    const lockedCard = screen.getByRole('radio', { name: /대학 진학/ });
    expect(lockedCard).toBeDisabled();
    expect(screen.getByText('Phase 3 콘텐츠에서 열립니다')).toBeInTheDocument();

    await user.click(lockedCard);
    expect(lockedCard).toHaveAttribute('data-state', 'unchecked');
  });
});
