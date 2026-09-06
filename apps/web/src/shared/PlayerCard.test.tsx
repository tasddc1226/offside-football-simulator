import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerCard } from './PlayerCard.js';

describe('PlayerCard', () => {
  it('구단이 없으면 이니셜 워터마크와 함께 브랜드 중립 카드를 렌더한다', () => {
    render(
      <PlayerCard
        eyebrow="PLAYER PROFILE"
        name="김서준"
        subtitle="윙어 · 인사이드 포워드"
        rows={[{ label: '국적', value: '대한민국' }]}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: '김서준' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: '김서준 선수 카드' })).not.toHaveAttribute('data-team');
    expect(screen.getByText('국적')).toBeInTheDocument();
    expect(screen.getByText('대한민국')).toBeInTheDocument();
  });

  it('구단이 있으면 팀 컬러 카드로 전환하고 TeamBadge 워터마크·등번호를 보여준다', () => {
    render(
      <PlayerCard
        eyebrow="WELCOME TO"
        name="김서준"
        team={{ id: 'hangang-u18', name: '한강 U18' }}
        shirtNumber={7}
        rows={[{ label: '주급', value: '1,000,000원', numeric: true }]}
      />,
    );

    const card = screen.getByRole('article', { name: '김서준 선수 카드' });
    expect(card).toHaveAttribute('data-team', 'true');
    expect(card).toHaveStyle({ '--os-player-card-accent': 'var(--os-team-hangang-u18)' });
    expect(screen.getByText('한강 U18')).toBeInTheDocument();
    expect(screen.getByLabelText('등번호 7')).toHaveTextContent('#7');
  });
});
