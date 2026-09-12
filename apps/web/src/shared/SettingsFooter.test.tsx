import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ENGINE_CLIENT_VERSION } from '@offside/engine-client';
import { OPERATOR } from '../legal/operator.js';
import { SettingsFooter } from './SettingsFooter.js';

// 이슈 160: 푸터가 내부 라우트 Link를 렌더하므로(RouterProvider 없이) Link를 단순 <a>로
// 대체한다. contract-presentation.test.tsx와 같은 패턴.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('SettingsFooter', () => {
  it('건의 메일 링크·제작자 표기·버전을 보여준다', () => {
    render(<SettingsFooter />);
    const link = screen.getByRole('link', { name: '버그·건의 보내기' });
    expect(link).toHaveAttribute('href', expect.stringContaining(`mailto:${OPERATOR.contactEmail}`));
    expect(screen.getByText(new RegExp(OPERATOR.name))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`베타 v${ENGINE_CLIENT_VERSION}`))).toBeInTheDocument();
  });

  it('채널 목록이 비어 있으면 채널 nav를 렌더링하지 않는다', () => {
    render(<SettingsFooter />);
    expect(screen.queryByRole('navigation', { name: '채널' })).not.toBeInTheDocument();
  });

  it('이슈 160: 이용약관·개인정보 처리방침 내부 라우트 링크를 보여준다', () => {
    render(<SettingsFooter />);
    const nav = screen.getByRole('navigation', { name: '약관·개인정보' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/legal/terms');
    expect(screen.getByRole('link', { name: '개인정보 처리방침' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    );
  });
});
