import { Dialog, DialogContent, DialogTrigger } from '@offside/ui';
import type { Notice } from '@offside/contracts';
import { useNotices } from '../engine/notices.js';
import { SUPPORT_EMAIL } from './home-notices.js';
import './home-hub.css';

export const FEEDBACK_EMAIL = SUPPORT_EMAIL;

/** 기존 표시 형식("2026.09.06")을 유지한다 — publishedAt의 날짜 부분만 쓴다. */
function formatPublishedDate(publishedAt: string): string {
  return publishedAt.slice(0, 10).replaceAll('-', '.');
}

function NoticeRow({ notice }: { notice: Notice }) {
  const date = formatPublishedDate(notice.publishedAt);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="os-home-notice">
          <span>{notice.title}</span>
          <time dateTime={notice.publishedAt.slice(0, 10)}>{date}</time>
        </button>
      </DialogTrigger>
      <DialogContent className="os-home-notice-dialog" title={notice.title} description={date} closeLabel="닫기">
        <div className="flex flex-col gap-os-3">
          {notice.body.map((paragraph) => (
            <p key={paragraph} className="font-os text-os-text-2">
              {paragraph}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HomeCommunity({ compact = false }: { compact?: boolean }) {
  const headingId = compact ? 'public-news' : 'home-news';
  const { data: notices, isLoading } = useNotices();
  const items = notices ?? [];

  return (
    <section className="flex flex-col gap-os-3" aria-labelledby={headingId}>
      <div className="flex items-end justify-between gap-os-3">
        <div>
          <p className="os-eyebrow">OFFSIDE 소식</p>
          <h2 id={headingId} className="os-section-title">
            공지사항
          </h2>
        </div>
        {!isLoading && (
          <span className="os-num os-muted" style={{ fontSize: 'var(--os-fs-caption)' }}>
            {items.length}개
          </span>
        )}
      </div>
      <div className="os-home-notice-list">
        {isLoading ? (
          <>
            <div className="os-home-notice-skeleton" aria-hidden="true" />
            <div className="os-home-notice-skeleton" aria-hidden="true" />
          </>
        ) : items.length === 0 ? (
          <p className="font-os text-os-text-2 os-home-notice-empty">아직 공지가 없습니다.</p>
        ) : (
          items.map((notice) => <NoticeRow key={notice.id} notice={notice} />)
        )}
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
