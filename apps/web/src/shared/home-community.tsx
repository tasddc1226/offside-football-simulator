import { Dialog, DialogContent, DialogTrigger } from '@offside/ui';
import { HOME_NOTICES, SUPPORT_EMAIL } from './home-notices.js';
import './home-hub.css';

export const FEEDBACK_EMAIL = SUPPORT_EMAIL;

export function HomeCommunity({ compact = false }: { compact?: boolean }) {
  const headingId = compact ? 'public-news' : 'home-news';
  return (
    <section className="flex flex-col gap-os-3" aria-labelledby={headingId}>
      <div className="flex items-end justify-between gap-os-3">
        <div>
          <p className="os-eyebrow">OFFSIDE 소식</p>
          <h2 id={headingId} className="os-section-title">
            공지사항
          </h2>
        </div>
        <span className="os-num os-muted" style={{ fontSize: 'var(--os-fs-caption)' }}>
          {HOME_NOTICES.length}개
        </span>
      </div>
      <div className="os-home-notice-list">
        {HOME_NOTICES.map((notice) => (
          <Dialog key={notice.id}>
            <DialogTrigger asChild>
              <button type="button" className="os-home-notice">
                <span>{notice.title}</span>
                <time dateTime={notice.date.replaceAll('.', '-')}>{notice.date}</time>
              </button>
            </DialogTrigger>
            <DialogContent
              className="os-home-notice-dialog"
              title={notice.title}
              description={notice.date}
              closeLabel="닫기"
            >
              <div className="flex flex-col gap-os-3">
                {notice.body.map((paragraph) => (
                  <p key={paragraph} className="font-os text-os-text-2">
                    {paragraph}
                  </p>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>
      <div className="os-home-support">
        <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)' }}>
          버그나 개선 의견을 알려주세요. 메일 앱이 열리며 자동 전송되지 않습니다.
        </p>
        <a
          href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('[OFFSIDE] 버그·개선 의견')}`}
        >
          버그·의견 보내기
        </a>
      </div>
      <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)' }}>
        메일 앱이 열리지 않으면 {FEEDBACK_EMAIL}으로 보내주세요.
      </p>
      <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)' }}>
        복구 코드나 비밀번호 같은 민감한 정보는 보내지 마세요.
      </p>
    </section>
  );
}
