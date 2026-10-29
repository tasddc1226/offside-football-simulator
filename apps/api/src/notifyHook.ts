// 운영 알림 웹훅(BILLING_SLACK_WEBHOOK). 슬랙 수신 웹훅 또는 디스코드 웹훅(T-11-576)만 받는다.
export type NotifyHook = { url: URL; kind: 'slack' | 'discord' };

export function notifyHook(raw: string | undefined): NotifyHook | null {
  if (!raw) return null;
  const url = new URL(raw);
  if (url.origin === 'https://hooks.slack.com' && url.pathname.startsWith('/services/'))
    return { url, kind: 'slack' };
  if (url.origin === 'https://discord.com' && /^\/api\/webhooks\/\d+\/[\w-]+$/.test(url.pathname))
    return { url, kind: 'discord' };
  return null;
}

/** 슬랙 본문 그대로, 디스코드는 글 하나(2,000자, 멘션 · 링크 미리보기 끔). text는 슬랙 대체 글과 같다. */
export async function postNotify(hook: NotifyHook, slackBody: { text: string }) {
  const body =
    hook.kind === 'discord'
      ? { content: slackBody.text.slice(0, 2000), allowed_mentions: { parse: [] }, flags: 4 }
      : slackBody;
  const response = await fetch(hook.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  // 슬랙은 200 'ok', 디스코드는 204.
  return hook.kind === 'discord'
    ? response.ok
    : response.ok && (await response.text()).trim() === 'ok';
}
