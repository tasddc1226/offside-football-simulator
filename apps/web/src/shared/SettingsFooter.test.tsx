import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OPERATOR } from '../legal/operator.js';
import { APP_VERSION_LABEL } from './app-version.js';
import { SettingsFooter } from './SettingsFooter.js';

describe('SettingsFooter', () => {
  it('건의 메일 링크·제작자 표기·앱 버전을 보여준다', () => {
    render(<SettingsFooter />);
    const link = screen.getByRole('link', { name: '버그·건의 보내기' });
    expect(link).toHaveAttribute('href', expect.stringContaining(`mailto:${OPERATOR.contactEmail}`));
    expect(screen.getByText(new RegExp(OPERATOR.name))).toBeInTheDocument();
    expect(screen.getByText(`OFFSIDE ${APP_VERSION_LABEL}`)).toBeInTheDocument();
  });

  it('채널 목록이 비어 있으면 채널 nav를 렌더링하지 않는다', () => {
    render(<SettingsFooter />);
    expect(screen.queryByRole('navigation', { name: '채널' })).not.toBeInTheDocument();
  });

  it('UX-013: 약관·개인정보 링크는 본문의 서비스 정책 목록으로 옮겨 푸터에는 없고, 상세 버전 슬롯을 그린다', () => {
    render(<SettingsFooter versionDetails={<p>상세 버전 슬롯</p>} />);
    expect(screen.queryByRole('navigation', { name: '약관·개인정보' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '이용약관' })).not.toBeInTheDocument();
    expect(screen.getByText('상세 버전 슬롯')).toBeInTheDocument();
  });
});
