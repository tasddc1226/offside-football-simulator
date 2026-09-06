import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerBanner } from './PlayerBanner.js';

describe('PlayerBanner', () => {
  it('이름·팀·포지션·등번호·나이·OVR을 한 번에 보여준다', () => {
    render(
      <PlayerBanner
        name="김서준"
        teamName="한강 유나이티드 U18"
        teamId="hangang-u18"
        position="윙어"
        shirtNumber="11"
        age={18}
        ovr={62}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: '김서준' })).toBeInTheDocument();
    expect(screen.getByText('한강 유나이티드 U18')).toBeInTheDocument();
    expect(screen.getByText('OVR 62')).toBeInTheDocument();
    expect(screen.getByText('윙어 · #11 · 18세')).toBeInTheDocument();
  });

  it('프로필 미확정(OVR null)·무소속(teamId null)이면 자리표시를 보여주고 배지를 그리지 않는다', () => {
    const { container } = render(
      <PlayerBanner
        name="김서준"
        teamName="계약 전 · 다음 팀 준비"
        teamId={null}
        position="—"
        shirtNumber="—"
        age={19}
        ovr={null}
      />,
    );

    expect(screen.getByText('OVR —')).toBeInTheDocument();
    expect(container.querySelector('.os-team-badge')).not.toBeInTheDocument();
  });
});
