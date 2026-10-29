// T-11-576 슬랙 메시지 모양 ↔ 디스코드 메시지. 에이전트 코드는 슬랙 Block Kit으로 쓰고, 디스코드로 보낼 때 여기서 옮긴다.
import type { SlackEvent } from './events.ts';

/** 디스코드 메시지 본문 상한. */
export const CONTENT_LIMIT = 2000;

export type Button = {
  label: string;
  style?: 'primary' | 'danger';
  action_id: string;
  value: string;
};

type Text = { type?: string; text?: string };
type Block = {
  type: string;
  text?: Text | string;
  elements?: (Text & { action_id?: string; value?: string; style?: 'primary' | 'danger' })[];
};

/** 슬랙 링크 `<url|글>` → 마크다운 링크. 미리보기 카드가 붙지 않게 주소를 꺾쇠로 감싼다. */
const links = (s: string) =>
  s
    .replace(/<(https?:\/\/[^|>\s]+)\|([^>\n]+)>/g, '[$2](<$1>)')
    .replace(/<(https?:\/\/[^|>\s]+)>/g, '<$1>');

/** 슬랙 mrkdwn(`*굵게*` · `~지움~` · 링크 · HTML 이스케이프) → 디스코드 마크다운. */
export const mrkdwnToMd = (s: string) =>
  links(s)
    .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?![*\w])/g, '$1**$2**')
    .replace(/(^|[^~])~(?=\S)([^~\n]+?)~(?!~)/g, '$1~~$2~~')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** 디스코드는 마크다운 표를 그리지 않는다. 코드 블록 밖의 표를 코드 블록으로 감싸 칸이 맞게 보이게 한다. */
export function tablesToCode(md: string): string {
  const out: string[] = [];
  let fence = false;
  let table: string[] = [];
  const flush = () => {
    if (table.length >= 2 && table.some((l) => /^\s*\|?\s*:?-{3,}/.test(l)))
      out.push('```', ...table, '```');
    else out.push(...table);
    table = [];
  };
  for (const line of md.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (!fence && /^\s*\|.*\|\s*$/.test(line)) {
      table.push(line);
      continue;
    }
    flush();
    out.push(line);
  }
  flush();
  return out.join('\n');
}

const plain = (t: Text | string | undefined) => (typeof t === 'string' ? t : (t?.text ?? ''));
const asMd = (t: Text | string | undefined) =>
  typeof t !== 'string' && t?.type === 'mrkdwn' ? mrkdwnToMd(plain(t)) : plain(t);

/** 슬랙 chat.postMessage 본문(text · blocks) → 디스코드 본문과 버튼. */
export function slackToDiscord(body: { text?: unknown; blocks?: unknown }): {
  content: string;
  buttons: Button[];
} {
  const blocks = Array.isArray(body.blocks) ? (body.blocks as Block[]) : [];
  const buttons: Button[] = [];
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === 'markdown') parts.push(tablesToCode(links(plain(b.text))));
    else if (b.type === 'section') parts.push(asMd(b.text));
    else if (b.type === 'header') parts.push(`### ${plain(b.text)}`);
    else if (b.type === 'context')
      parts.push(`-# ${(b.elements ?? []).map((e) => asMd(e)).join(' · ')}`);
    else if (b.type === 'actions')
      for (const e of b.elements ?? [])
        if (e.type === 'button' && e.action_id)
          buttons.push({
            label: plain(e.text),
            action_id: e.action_id,
            value: e.value ?? '',
            ...(e.style ? { style: e.style } : {}),
          });
  }
  const content = parts.length ? parts.join('\n') : mrkdwnToMd(String(body.text ?? ''));
  return { content, buttons };
}

/** 2,000자씩 줄 단위로 나눈다. 코드 블록 중간에서 끊기면 닫고 다음 조각에서 다시 연다. */
export function splitContent(s: string, limit = CONTENT_LIMIT): string[] {
  const out: string[] = [];
  let cur = '';
  let fence = false;
  const lines = s.split('\n').flatMap((l) => {
    const pieces: string[] = [];
    for (let i = 0; i < l.length || i === 0; i += limit - 20)
      pieces.push(l.slice(i, i + limit - 20));
    return pieces;
  });
  for (const line of lines) {
    const next = cur ? `${cur}\n${line}` : line;
    if (cur && next.length + (fence ? 4 : 0) > limit) {
      out.push(fence ? `${cur}\n\`\`\`` : cur);
      cur = fence ? `\`\`\`\n${line}` : line;
    } else cur = next;
    if (/^\s*```/.test(line)) fence = !fence;
  }
  if (cur.trim()) out.push(cur);
  return out.length ? out : [' '];
}

/** 버튼을 디스코드 컴포넌트 줄(한 줄에 5개)로. custom_id는 `action_id|열쇠`(값은 브리지 저장소에 둔다). */
export function buttonRows(buttons: readonly Button[], keys: readonly string[]) {
  const rows: { type: 1; components: unknown[] }[] = [];
  buttons.forEach((b, i) => {
    if (i % 5 === 0) rows.push({ type: 1, components: [] });
    rows.at(-1)!.components.push({
      type: 2,
      style: b.style === 'primary' ? 1 : b.style === 'danger' ? 4 : 2,
      label: b.label.slice(0, 80),
      custom_id: `${b.action_id}|${keys[i]}`.slice(0, 100),
    });
  });
  return rows;
}

/** 슬랙 이모지 이름 → 유니코드(에이전트가 쓰는 것만). */
export const EMOJI: Record<string, string> = {
  eyes: '👀',
  white_check_mark: '✅',
  x: '❌',
  hourglass_flowing_sand: '⏳',
};

/** 스레드 이름(원글 첫 줄, 디스코드 상한 100자). */
export const threadName = (content: string | undefined) =>
  (content ?? '')
    .split('\n')
    .map((l) =>
      l
        .replace(/<@!?\d+>/g, '')
        .replace(/[*_`#>~|-]/g, '')
        .trim(),
    )
    .find(Boolean)
    ?.slice(0, 90) || '작업';

export type DiscordMessage = {
  id: string;
  channel_id: string;
  guild_id?: string;
  type?: number;
  content?: string;
  webhook_id?: string;
  application_id?: string;
  author?: { id: string; bot?: boolean };
  mentions?: { id: string }[];
};

/**
 * 게이트웨이 MESSAGE_CREATE → 슬랙 이벤트 모양. `parent`는 스레드 안 글이면 상위 채널 ID, 아니면 ''.
 * 스레드 ID는 그 스레드를 연 원글 ID와 같아서 슬랙의 thread_ts 자리에 그대로 둔다.
 */
export function toSlackEvent(
  m: DiscordMessage,
  parent: string,
  botUser: string | undefined,
): { ev: SlackEvent; mentioned: boolean } {
  const mentioned = !!botUser && (m.mentions ?? []).some((u) => u.id === botUser);
  const text = (m.content ?? '')
    .replace(/<@!?(\d+)>/g, (_, id: string) => (id === botUser ? '' : `<@${id}>`))
    .trim();
  const webhook = !!m.webhook_id;
  // 0 기본 글 · 19 답장만 글로 본다(입장 · 고정 알림 등은 건너뛴다).
  const subtype = webhook
    ? 'bot_message'
    : [0, 19].includes(m.type ?? 0)
      ? undefined
      : 'channel_join';
  const ev: SlackEvent = {
    type: 'message',
    text,
    channel: parent || m.channel_id,
    ts: m.id,
    ...(subtype ? { subtype } : {}),
    ...(webhook ? { bot_id: m.webhook_id } : m.author?.bot ? { bot_id: m.author.id } : {}),
    ...(!webhook && m.author ? { user: m.author.id } : {}),
    ...(parent ? { thread_ts: m.channel_id } : {}),
  };
  return { ev, mentioned };
}
