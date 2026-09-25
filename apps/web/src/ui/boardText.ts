// T-10-011 게시판 본문 표기. HTML은 받지 않고 줄 단위 약속만 읽는다 — 텍스트 노드로만 그려서 안전하다.
//   "## 제목" → 소제목, "- 항목"·"* 항목" → 목록, 빈 줄 → 문단 구분, 그 밖의 줄 → 문단(줄바꿈 유지)
import type { BoardKey } from '@offside/contracts/board-limits';

export type Block = { kind: 'h'; text: string } | { kind: 'ul'; items: string[] } | { kind: 'p'; lines: string[] };

export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const last = out[out.length - 1];
    const head = /^#{1,3}\s+(.+)$/.exec(line);
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

/** 2026-09-25 형식(보는 사람 시간대). */
export const dateOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/** 26. 9. 25. 오후 12:00 형식(한국 시간) — 운영 도구처럼 기준 시간대를 맞춰 볼 때. */
export const kstDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' });

export const BOARD_LABEL: Record<BoardKey, string> = { notice: '공지사항', release: '릴리즈 노트' };
