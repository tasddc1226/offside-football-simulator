// UX-014 커리어 상단 헤더 단위 테스트: 역할 라벨·OVR 표시·무소속(팀 배지 없음) 세 경우를 props만으로
// 확인한다(ADR-005 — 이 컴포넌트는 게임 규칙을 계산하지 않는다, 값은 career-header-data.test.ts가
// 다룬다). CareerHeaderBar(연결 컨테이너)는 useCareer 등 훅이 필요해 라우터 테스트에서 다룬다.
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CareerHeader } from './CareerHeader.js';

// CareerHeader가 홈 버튼에 Link를 쓰므로(RouterProvider 없이) 단순 <a>로 대체한다.
// SettingsBanner.test.tsx·contract-presentation.test.tsx와 같은 패턴.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a href="#" {...props}>
      {children}
    </a>
  ),
}));

describe('CareerHeader', () => {
  it('이름·역할·나이·OVR·구단 배지를 보여준다', () => {
    const { container } = render(
      <CareerHeader
        name="김서준"
        teamName="한강 유나이티드 U18"
        teamId="hangang-u18"
        roleLabel="주전"
        age={19}
        ovr={53}
      />,
    );

    expect(screen.getByText('김서준')).toBeInTheDocument();
    expect(screen.getByText('주전 19세')).toBeInTheDocument();
    // "OVR"·"53"은 시각적으로 라벨/큰 숫자 두 요소로 나뉘어 있다(브라우저 textContent는 이어
    // 붙지만 RTL의 getByText는 직접 텍스트 자식만 본다) — 전체 블록의 textContent로 확인한다.
    expect(container.querySelector('.os-career-header-ovr')?.textContent).toBe('OVR 53');
    expect(screen.getByText('한강 유나이티드 U18')).toBeInTheDocument();
    expect(container.querySelector('.os-team-badge')).toBeInTheDocument();
  });

  it('무소속(teamId null)이면 배지를 그리지 않고, OVR 미확정이면 "OVR —"를 보여준다', () => {
    const { container } = render(
      <CareerHeader
        name="김서준"
        teamName="무소속"
        teamId={null}
        roleLabel="무소속"
        age={20}
        ovr={null}
      />,
    );

    expect(screen.getByText('무소속 20세')).toBeInTheDocument();
    expect(container.querySelector('.os-career-header-ovr')?.textContent).toBe('OVR —');
    expect(container.querySelector('.os-team-badge')).not.toBeInTheDocument();
  });

  it('대시보드가 아닌 화면에서는 tabs를 생략해도 헤더만 그린다', () => {
    render(
      <CareerHeader name="김서준" teamName="한강 유나이티드 U18" teamId="hangang-u18" roleLabel="신인" age={18} ovr={null} />,
    );

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('신인 18세')).toBeInTheDocument();
  });
});
