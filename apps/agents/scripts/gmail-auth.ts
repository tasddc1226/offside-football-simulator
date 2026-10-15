// 고객 문의(T-11-291) Gmail 연결: 운영자가 브라우저에서 문의 Gmail로 동의하면 갱신 토큰을 받아 Worker 비밀값에 바로 넣는다.
// 토큰은 화면에 찍지 않는다. 클라이언트 ID · 비밀번호는 Google Cloud "데스크톱 앱" OAuth 클라이언트 값이다.
// 실행(apps/agents에서): GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-auth.ts
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';

const id = process.env.GMAIL_CLIENT_ID;
const secret = process.env.GMAIL_CLIENT_SECRET;
if (!id || !secret) {
  console.error('GMAIL_CLIENT_ID · GMAIL_CLIENT_SECRET가 필요해요');
  process.exit(1);
}
const PORT = Number(process.env.PORT ?? 8765);
const redirect = `http://127.0.0.1:${PORT}`;
const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];
const state = crypto.randomUUID();
const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: id,
  redirect_uri: redirect,
  response_type: 'code',
  scope: scopes.join(' '),
  access_type: 'offline',
  prompt: 'consent',
  state,
})}`;

const put = (name: string, value: string) => {
  const r = spawnSync('pnpm', ['exec', 'wrangler', 'secret', 'put', name], {
    input: value,
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  if (r.status !== 0) throw new Error(`wrangler secret put ${name} 실패`);
};

const server = createServer(async (req, res) => {
  const q = new URL(req.url ?? '/', redirect).searchParams;
  if (q.get('state') !== state || !q.get('code')) {
    res.writeHead(400).end('잘못된 요청이에요');
    return;
  }
  try {
    const t = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: q.get('code')!,
        client_id: id,
        client_secret: secret,
        redirect_uri: redirect,
        grant_type: 'authorization_code',
      }),
    });
    const data = (await t.json()) as {
      refresh_token?: string;
      access_token?: string;
      scope?: string;
      error?: string;
    };
    if (!data.refresh_token || !data.access_token)
      throw new Error(`토큰을 받지 못했어요 (${data.error ?? t.status})`);
    const profile = (await (
      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
    ).json()) as { emailAddress?: string };
    put('GMAIL_CLIENT_ID', id);
    put('GMAIL_CLIENT_SECRET', secret);
    put('GMAIL_REFRESH_TOKEN', data.refresh_token);
    console.log(`연결한 Gmail: ${profile.emailAddress}, 권한: ${data.scope}`);
    res
      .writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end('연결했어요. 창을 닫아도 돼요.');
  } catch (e) {
    console.error(String(e));
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('연결하지 못했어요.');
  } finally {
    server.close();
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`이 주소를 브라우저에서 여세요:\n${url}`));
