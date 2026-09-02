import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardSection } from './DashboardSection.js';

describe('DashboardSection', () => {
  it('renders title, description, and body content when unlocked', () => {
    render(
      <DashboardSection title="전술실" description="전술 적합도와 역할을 본다">
        <p>전술실 본문</p>
      </DashboardSection>,
    );

    expect(screen.getByRole('heading', { name: '전술실' })).toBeInTheDocument();
    expect(screen.getByText('전술 적합도와 역할을 본다')).toBeInTheDocument();
    expect(screen.getByText('전술실 본문')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '전술실' }).closest('section')).not.toHaveAttribute('aria-disabled');
  });

  it('shows the lock reason and marks the section aria-disabled when locked', () => {
    render(
      <DashboardSection title="전술실" description="전술 적합도와 역할을 본다" locked lockReason="첫 프로 계약 후 열림">
        <p>전술실 본문</p>
      </DashboardSection>,
    );

    const section = screen.getByRole('heading', { name: '전술실' }).closest('section');
    expect(section).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('첫 프로 계약 후 열림')).toBeInTheDocument();
    expect(screen.getByText('전술실 본문')).toBeInTheDocument();
  });
});
