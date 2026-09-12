import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamBadge } from './TeamBadge.js';

describe('TeamBadge', () => {
  it('renders the initials as decorative markup, sized by the size prop', () => {
    const { container, rerender } = render(
      <TeamBadge initials="한강" colorVar="var(--os-team-hangang-u18)" size="s" />,
    );
    const badge = container.querySelector('span');
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge).toHaveAttribute('data-size', 's');
    expect(badge).toHaveAttribute('data-initials', '한강');
    expect(badge).toHaveStyle({ background: 'var(--os-team-hangang-u18)' });

    rerender(<TeamBadge initials="온새" colorVar="var(--os-neutral)" />);
    expect(container.querySelector('span')).toHaveAttribute('data-size', 'm');
  });

  it('이슈 170: 이니셜을 DOM 텍스트로 두지 않아 textContent·innerText에 팀명 앞으로 섞이지 않는다', () => {
    const { container } = render(
      <h2>
        <TeamBadge initials="강동" colorVar="var(--os-team-gangdong-rovers)" />
        강동 로버스
      </h2>,
    );
    const badge = container.querySelector('.os-team-badge');
    expect(badge?.textContent).toBe('');
    expect(container.querySelector('h2')?.textContent).toBe('강동 로버스');
  });

  it('UX-013: logoSrc가 있으면 장식 이미지로 채우고 이니셜 속성은 두지 않는다', () => {
    const { container } = render(
      <TeamBadge
        initials="한강"
        colorVar="var(--os-team-hangang-u18)"
        logoSrc="data:image/png;base64,AAAA"
      />,
    );
    const badge = container.querySelector('.os-team-badge');
    expect(badge).toHaveAttribute('data-logo', 'true');
    expect(badge).not.toHaveAttribute('data-initials');
    const img = badge?.querySelector('img');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
  });
});
