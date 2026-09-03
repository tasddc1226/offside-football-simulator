// 13-visual-design-system.md DSN-MOT-001·04 공정성 규칙 단위 테스트: 0·미집계(null)·애니메이션
// 중을 구분하고, "건너뛰기"가 확정값으로 즉시 스냅하는지 확인한다.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CountUp } from './countup.js';
import { useUiStore } from './ui-store.js';

afterEach(() => {
  useUiStore.setState({ reducedMotion: 'SYSTEM' });
});

describe('CountUp', () => {
  it('value가 0이면 애니메이션 없이 "0"을 보여준다(0과 미확정 값 구분)', () => {
    render(<CountUp value={0} label="출전" />);
    const el = screen.getByLabelText('출전 0');
    expect(el).toHaveTextContent('0');
    expect(el).toHaveAttribute('data-value', '0');
    expect(el).toHaveAttribute('data-animating', 'false');
    expect(screen.queryByRole('button', { name: '건너뛰기' })).not.toBeInTheDocument();
  });

  it('value가 null이면 미집계 "—"를 보여준다(애니메이션 없음)', () => {
    render(<CountUp value={null} label="평균 평점" />);
    const el = screen.getByLabelText('평균 평점 미집계');
    expect(el).toHaveTextContent('—');
    expect(el).toHaveAttribute('data-animating', 'false');
    expect(screen.queryByRole('button', { name: '건너뛰기' })).not.toBeInTheDocument();
  });

  it('value가 0이 아니면 애니메이션 중 상태로 시작하고, 확정값을 접근성 이름에 먼저 담는다', () => {
    render(<CountUp value={82} label="출전 시간" />);
    const el = screen.getByLabelText('출전 시간 82');
    expect(el).toHaveAttribute('data-value', '82');
    expect(el).toHaveAttribute('data-animating', 'true');
    expect(screen.getByRole('button', { name: '건너뛰기' })).toBeInTheDocument();
  });

  it('reducedMotion이면 즉시 확정값을 보여주고 애니메이션하지 않는다', () => {
    useUiStore.setState({ reducedMotion: 'ON' });
    render(<CountUp value={82} label="출전 시간" />);
    const el = screen.getByLabelText('출전 시간 82');
    expect(el).toHaveTextContent('82');
    expect(el).toHaveAttribute('data-animating', 'false');
    expect(screen.queryByRole('button', { name: '건너뛰기' })).not.toBeInTheDocument();
  });

  it('건너뛰기를 누르면 표시값이 확정값으로 즉시 스냅하고 애니메이션이 끝난다', () => {
    const onSkip = vi.fn();
    render(<CountUp value={82} label="출전 시간" onSkip={onSkip} />);
    const skipButton = screen.getByRole('button', { name: '건너뛰기' });
    fireEvent.click(skipButton);

    const el = screen.getByLabelText('출전 시간 82');
    expect(el).toHaveTextContent('82');
    expect(el).toHaveAttribute('data-animating', 'false');
    expect(screen.queryByRole('button', { name: '건너뛰기' })).not.toBeInTheDocument();
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
