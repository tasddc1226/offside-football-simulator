import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stepper } from './Stepper.js';

const STEPS = [
  { id: 'name', label: '이름' },
  { id: 'style', label: '스타일' },
  { id: 'confirm', label: '확인' },
];

describe('Stepper', () => {
  it('renders every step label', () => {
    render(<Stepper steps={STEPS} currentStepId="style" />);
    expect(screen.getByText('이름')).toBeInTheDocument();
    expect(screen.getByText('스타일')).toBeInTheDocument();
    expect(screen.getByText('확인')).toBeInTheDocument();
  });

  it('marks only the current step with aria-current="step"', () => {
    render(<Stepper steps={STEPS} currentStepId="style" />);
    const current = screen.getByText('스타일').closest('li');
    const other = screen.getByText('이름').closest('li');

    expect(current).toHaveAttribute('aria-current', 'step');
    expect(other).not.toHaveAttribute('aria-current');
  });

  it('exposes the current position as n / N', () => {
    render(<Stepper steps={STEPS} currentStepId="confirm" />);
    expect(screen.getByRole('list', { name: '3 / 3' })).toBeInTheDocument();
  });
});
