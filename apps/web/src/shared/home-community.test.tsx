import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FEEDBACK_EMAIL, HomeCommunity } from './home-community.js';

describe('HomeCommunity', () => {
  it('공지 상세를 열고 닫는다', async () => {
    const user = userEvent.setup();
    render(<HomeCommunity />);
    await user.click(screen.getByRole('button', { name: /화면과 이동 경험을 개선했습니다/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/선택지에 더 빨리 도달/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /화면과 이동 경험을 개선했습니다/ })).toHaveFocus();
  });

  it('자동 접수로 오해하지 않도록 메일 앱 링크와 평문 주소를 함께 제공한다', () => {
    render(<HomeCommunity />);
    const link = screen.getByRole('link', { name: '버그·의견 보내기' });
    expect(link).toHaveAttribute('href', expect.stringContaining(`mailto:${FEEDBACK_EMAIL}`));
    expect(screen.getByText(/메일 앱이 열리며 자동 전송되지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(FEEDBACK_EMAIL))).toBeInTheDocument();
  });
});
