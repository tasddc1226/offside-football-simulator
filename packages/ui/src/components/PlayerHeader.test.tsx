import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerHeader } from './PlayerHeader.js';

describe('PlayerHeader', () => {
  it('renders name, team, and the position/archetype/shirt number slots', () => {
    render(
      <PlayerHeader
        name="김서준"
        team="한강 유나이티드 U18"
        position={{ label: '포지션', value: 'W' }}
        archetype={{ label: '아키타입', value: '인사이드 포워드' }}
        shirtNumber={{ label: '등번호', value: '11' }}
      />,
    );

    expect(screen.getByText('김서준')).toBeInTheDocument();
    expect(screen.getByText('한강 유나이티드 U18')).toBeInTheDocument();
    expect(screen.getByText('포지션')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('인사이드 포워드')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });
});
