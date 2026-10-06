// T-10-011 게시판 본문 표기. HTML은 받지 않고 줄 단위 약속만 읽는다 — 텍스트 노드로만 그려서 안전하다.
//   "## 제목" → 소제목, "- 항목"·"* 항목" → 목록, 빈 줄 → 문단 구분, 그 밖의 줄 → 문단(줄바꿈 유지)
import type {
  BoardKey,
  CommentReportReason,
  NameReportKind,
} from '@offside/contracts/board-limits';
import { boardLabelText } from './i18n/ko/boardLabel.js';

export type Block =
  { kind: 'h'; text: string } | { kind: 'ul'; items: string[] } | { kind: 'p'; lines: string[] };

const HEAD = /^#{1,3}\s+(.+)$/;

export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const last = out[out.length - 1];
    const head = HEAD.exec(line);
    const item = /^\s*[-*]\s+(.+)$/.exec(line);
    if (head) out.push({ kind: 'h', text: head[1]! });
    else if (item) {
      if (last?.kind === 'ul') last.items.push(item[1]!);
      else out.push({ kind: 'ul', items: [item[1]!] });
    } else if (!line.trim()) out.push({ kind: 'p', lines: [] });
    else if (last?.kind === 'p') last.lines.push(line);
    else out.push({ kind: 'p', lines: [line] });
  }
  return out.filter((b) => b.kind !== 'p' || b.lines.length > 0);
}

/**
 * `hide`에 걸리는 줄을 본문에서 뺀다. 소제목이 걸리면 다음 소제목 전까지 통째로 뺀다.
 * iOS 앱이 다른 플랫폼 언급을 가릴 때 쓴다(T-11-087, App Store 2.3.10). 서버 원문은 그대로 둔다.
 */
export function hideLines(body: string, hide: RegExp): string {
  let skipping = false;
  return body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => {
      if (HEAD.test(line)) skipping = hide.test(line);
      return !skipping && !hide.test(line);
    })
    .join('\n');
}

/** 2026-09-25 형식(보는 사람 시간대). */
export const dateOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/** 26. 9. 25. 오후 12:00 형식(한국 시간) — 운영 도구처럼 기준 시간대를 맞춰 볼 때. */
export const kstDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'short',
    timeStyle: 'short',
  });

const KST_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
/** 한국 시간 날짜(26.09.25)·시각(14:05)을 따로 — 모두가 같은 기록을 보는 화면(서버 최초 기록)에서 기준을 맞출 때. */
export function kstParts(iso: string): { day: string; time: string } {
  const p = Object.fromEntries(
    KST_PARTS.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}.${p.month}.${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** 한국 시간 "9/30 14:05"(월/일 시:분) — 경기 기록 한 줄. */
export function kstMonthDayTime(iso: string): string {
  const p = Object.fromEntries(
    KST_PARTS.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${Number(p.month)}/${Number(p.day)} ${p.hour}:${p.minute}`;
}

/** 한국 시간 "10월 6일 0시"(분이 있으면 "0시 30분") — 시즌 개막·마감 안내(T-10-090). */
export function kstMonthDayHour(iso: string): string {
  const p = Object.fromEntries(
    KST_PARTS.formatToParts(new Date(iso)).map((x) => [x.type, Number(x.value)]),
  );
  return boardLabelText.monthDayHour({
    month: p.month ?? 0,
    day: p.day ?? 0,
    hour: p.hour ?? 0,
    minute: p.minute ?? 0,
  });
}

/** 목록 한 줄의 날짜 · 조회 · 좋아요 · 댓글(0이면 좋아요·댓글은 뺀다). */
export const postMeta = (p: {
  createdAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}) =>
  [
    dateOf(p.createdAt),
    boardLabelText.views({ n: p.viewCount }),
    p.likeCount ? boardLabelText.likes({ n: p.likeCount }) : '',
    p.commentCount ? boardLabelText.commentCount({ n: p.commentCount }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

/** 글 상세 머리줄의 날짜 · (고쳤으면 수정됨) · 조회. */
export const postDetailMeta = (p: { createdAt: string; updatedAt: string; viewCount: number }) =>
  `${dateOf(p.createdAt)}${p.updatedAt !== p.createdAt ? ` · ${boardLabelText.edited}` : ''} · ${boardLabelText.views({ n: p.viewCount })}`;

// 게시판 이름·신고 사유는 읽을 때 지금 언어로 고른다(모듈 최상위에서 굳히지 않는다).
export const BOARD_LABEL: Record<BoardKey, string> = {
  get notice() {
    return boardLabelText.noticeLabel;
  },
  get release() {
    return boardLabelText.releaseLabel;
  },
};

/** 댓글 신고 사유 — 웹·앱 신고 패널이 이 순서로 버튼을 놓는다. */
/** 이름 신고 대상(운영 도구). */
export const NAME_KIND_LABEL: Record<NameReportKind, string> = { career: '선수', team: '구단' };

export const REPORT_REASON_LABEL: Record<CommentReportReason, string> = {
  get spam() {
    return boardLabelText.reportSpam;
  },
  get abuse() {
    return boardLabelText.reportAbuse;
  },
  get sexual() {
    return boardLabelText.reportSexual;
  },
  get other() {
    return boardLabelText.reportOther;
  },
};
