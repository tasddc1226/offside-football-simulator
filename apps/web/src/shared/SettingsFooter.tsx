// UX-002: 설정 화면 맨 아래 제작자·피드백·버전 푸터. 1인 개발 게임임을 알리고 버그·건의를 받을
// 통로를 준다 — 커뮤니티 유대감이 목적이라 카드보다 낮은 존재감으로 둔다.
// UX-013: 이용약관·개인정보 처리방침 링크는 설정 본문의 "서비스 정책" 목록(settings.tsx)으로
// 옮겼다(중복 제거). 버전은 서비스 앱 버전(app-version.ts) 한 줄 + `versionDetails` 슬롯(설정
// 화면이 이슈 154의 서비스 시즌 기반 "상세 버전" 토글을 넣는다)만 둔다.
import type { ReactNode } from 'react';
import { OPERATOR, CHANNELS } from '../legal/operator.js';
import { APP_VERSION_LABEL } from './app-version.js';

const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

const FEEDBACK_SUBJECT = encodeURIComponent('[OFFSIDE] 건의');

export interface SettingsFooterProps {
  /** "상세 버전" 소형 토글 자리. 서비스 시즌 조회(react-query)가 필요해 호출부가 넣는다. */
  versionDetails?: ReactNode;
}

export function SettingsFooter({ versionDetails }: SettingsFooterProps) {
  return (
    <footer className="flex flex-col items-center gap-os-2 pt-os-2 text-center">
      <a
        href={`mailto:${OPERATOR.contactEmail}?subject=${FEEDBACK_SUBJECT}`}
        className="font-os text-os-accent underline"
        style={CAPTION_STYLE}
      >
        버그·건의 보내기
      </a>

      {CHANNELS.length > 0 ? (
        <nav className="flex flex-wrap items-center justify-center gap-os-3" aria-label="채널">
          {CHANNELS.map((channel) => (
            <a
              key={channel.url}
              href={channel.url}
              target="_blank"
              rel="noreferrer"
              className="font-os text-os-text-2 underline"
              style={CAPTION_STYLE}
            >
              {channel.label}
            </a>
          ))}
        </nav>
      ) : null}

      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        만든 사람: {OPERATOR.name}
      </p>
      <p id="settings-version" className="os-num font-os text-os-text-2" style={CAPTION_STYLE}>
        OFFSIDE {APP_VERSION_LABEL}
      </p>
      {versionDetails}
    </footer>
  );
}
