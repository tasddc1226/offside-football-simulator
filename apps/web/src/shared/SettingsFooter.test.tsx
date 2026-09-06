import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ENGINE_CLIENT_VERSION } from '@offside/engine-client';
import { OPERATOR } from '../legal/operator.js';
import { SettingsFooter } from './SettingsFooter.js';

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
});
