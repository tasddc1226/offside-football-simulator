import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusStrip } from './StatusStrip.js';

const ITEMS = [
  { id: 'ovr', label: '기본 OVR', value: 59 },
  { id: 'form', label: '폼', value: 50 },
  { id: 'fitness', label: '체력', value: 80 },
];

describe('StatusStrip', () => {
  it('renders every label and value', () => {
    render(<StatusStrip items={ITEMS} />);
    expect(screen.getByText('기본 OVR')).toBeInTheDocument();
    expect(screen.getByText('59')).toBeInTheDocument();
    expect(screen.getByText('폼')).toBeInTheDocument();
    expect(screen.getByText('체력')).toBeInTheDocument();
  });

  it('renders values with tabular-nums for fixed-width digits', () => {
    render(<StatusStrip items={ITEMS} />);
    expect(screen.getByText('59').className).toContain('os-num');
  });

  it('uses an auto-fitting stat grid instead of scrolling horizontally', () => {
    render(<StatusStrip items={ITEMS} />);
    const list = screen.getByText('기본 OVR').closest('ul');
    expect(list?.className).toContain('os-stat-strip');
    expect(list?.className).not.toMatch(/overflow-x/);
  });
});
