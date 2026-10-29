// 운영 알림 웹훅(BILLING_SLACK_WEBHOOK, 이름은 슬랙 시절 그대로). 디스코드 웹훅만 받는다(T-11-576 · T-11-578).
export type NotifyHook = { url: URL };

export function notifyHook(raw: string | undefined): NotifyHook | null {
  if (!raw) return null;
  const url = new URL(raw);
  if (url.origin === 'https://discord.com' && /^\/api\/webhooks\/\d+\/[\w-]+$/.test(url.pathname))
    return { url };
  return null;
}

/** 글 하나로 보낸다(2,000자, 멘션 · 링크 미리보기 끔). text는 메시지 대체 글이다. 디스코드는 204를 돌려준다. */
export async function postNotify(hook: NotifyHook, message: { text: string }) {
  const response = await fetch(hook.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      content: message.text.slice(0, 2000),
      allowed_mentions: { parse: [] },
      flags: 4,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}
