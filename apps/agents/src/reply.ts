// 에이전트 답 메시지 모양. 에이전트 코드는 슬랙 Web API 모양(chat.postMessage · Block Kit)으로 쓰고 디스코드 브리지가 옮긴다(T-11-576).
export type SlackCall = (
  method: string,
  body: Record<string, unknown>,
) => Promise<{ ok: boolean; error?: string; ts?: string }>;

/** markdown 블록은 12,000자까지 받는다. */
const MD_LIMIT = 11_500;

/** 에이전트 답을 스레드에 단다(threadTs가 없으면 새 글). 본문은 markdown 블록, 아래에 비용 줄. */
export function threadReply(
  channel: string,
  threadTs: string | undefined,
  text: string,
  footer?: string,
) {
  const body = text.length > MD_LIMIT ? `${text.slice(0, MD_LIMIT)}\n\n…(길어서 잘랐어요)` : text;
  return {
    channel,
    thread_ts: threadTs,
    text: body.slice(0, 3000),
    unfurl_links: false,
    unfurl_media: false,
    blocks: [
      { type: 'markdown', text: body },
      ...(footer ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: footer }] }] : []),
    ],
  };
}
