// UX-002: 설정 화면 맨 아래(허브로 버튼 위) 제작자·피드백·버전 푸터. 1인 개발 게임임을 알리고
// 버그·건의를 받을 통로를 준다 — 커뮤니티 유대감이 목적이라 카드보다 낮은 존재감으로 둔다.
// 이슈 160: 이용약관·개인정보 처리방침은 SPA 내부 라우트 링크(ADR-009 — 외부 이동 아님).
import { Link } from '@tanstack/react-router';
import { OPERATOR, CHANNELS } from '../legal/operator.js';
import { ENGINE_CLIENT_VERSION } from '@offside/engine-client';

const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

const FEEDBACK_SUBJECT = encodeURIComponent('[OFFSIDE] 건의');

export function SettingsFooter() {
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

      <nav className="flex flex-wrap items-center justify-center gap-os-3" aria-label="약관·개인정보">
        <Link to="/legal/terms" className="font-os text-os-text-2 underline" style={CAPTION_STYLE}>
          이용약관
        </Link>
        <Link to="/legal/privacy" className="font-os text-os-text-2 underline" style={CAPTION_STYLE}>
          개인정보 처리방침
        </Link>
      </nav>

      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        만든 사람: {OPERATOR.name}
      </p>
      <p className="os-num font-os text-os-text-2" style={CAPTION_STYLE}>
        베타 v{ENGINE_CLIENT_VERSION}
      </p>
    </footer>
  );
}
