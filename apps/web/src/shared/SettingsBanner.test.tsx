import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsBanner } from './SettingsBanner.js';

// SettingsBanner가 Link를 렌더하므로(RouterProvider 없이) Link를 단순 <a>로 대체한다.
// contract-presentation.test.tsx·retirement-screen.test.tsx와 같은 패턴.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a href="#" {...props}>
      {children}
    </a>
  ),
}));

describe('SettingsBanner', () => {
  it('UX-013 후속: 저장 위치 배지에 시각적으로 숨긴 "저장 위치: " 문맥을 붙여 스크린리더가 문구만 읽지 않게 한다', () => {
    render(<SettingsBanner badge="Google 동기화" />);

    const badge = screen.getByText('Google 동기화').closest('.os-settings-banner-badge');
    expect(badge).not.toBeNull();
    // 배지가 role 없는 일반 span이라 dom-accessibility-api의 "name from content"는 적용되지
    // 않는다(그건 role이 이름을 허용하는 요소에만 적용) — 실제로는 스크린리더가 문서 순서대로
    // 숨은 텍스트 + 보이는 텍스트를 이어 읽으므로, 여기서는 DOM 텍스트 순서 자체를 검증한다.
    expect(badge?.textContent).toBe('저장 위치: Google 동기화');

    const prefix = badge?.querySelector('.sr-only');
    expect(prefix).not.toBeNull();
    expect(prefix).toHaveTextContent('저장 위치:');
  });

  it('UX-013 다듬기: Google 연결이 없는 채널의 배지는 "이 기기 · 자동 동기화"로, 낭독은 "저장 위치: 이 기기 · 자동 동기화"가 된다', () => {
    render(<SettingsBanner badge="이 기기 · 자동 동기화" />);

    const badge = screen.getByText('이 기기 · 자동 동기화').closest('.os-settings-banner-badge');
    expect(badge?.textContent).toBe('저장 위치: 이 기기 · 자동 동기화');
  });
});
