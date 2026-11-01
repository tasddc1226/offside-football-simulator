// T-11-577 운영 지표 AdMob 수익 연결: 운영자가 브라우저에서 AdMob 계정 Google로 동의하면 갱신 토큰을 받아 Worker 비밀값에 바로 넣는다.
// AdMob API는 서비스 계정을 받지 않는다. 토큰은 화면에 찍지 않는다. 클라이언트는 고객 문의와 같은 "데스크톱 앱" OAuth 클라이언트를 써도 된다
// (그 Google Cloud 프로젝트에서 AdMob API를 켜 둬야 한다).
// 실행(apps/agents에서): node scripts/admob-auth.ts <Google Cloud에서 받은 client_secret_….json>
// (또는 ADMOB_CLIENT_ID=... ADMOB_CLIENT_SECRET=... node scripts/admob-auth.ts)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const file = process.argv[2]
  ? (
      JSON.parse(readFileSync(process.argv[2], 'utf8')) as {
        installed?: { client_id?: string; client_secret?: string };
      }
    ).installed
  : undefined;
const id = file?.client_id ?? process.env.ADMOB_CLIENT_ID;
const secret = file?.client_secret ?? process.env.ADMOB_CLIENT_SECRET;
if (!id || !secret) {
  console.error('ADMOB_CLIENT_ID · ADMOB_CLIENT_SECRET가 필요해요');
  process.exit(1);
}
const PORT = Number(process.env.PORT ?? 8766);
const redirect = `http://127.0.0.1:${PORT}`;
const state = crypto.randomUUID();
const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: id,
  redirect_uri: redirect,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/admob.readonly',
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
      error?: string;
    };
    if (!data.refresh_token || !data.access_token)
      throw new Error(`토큰을 받지 못했어요 (${data.error ?? t.status})`);
    // 게시자 ID(pub-…)는 계정 목록에서 읽는다(비밀값이 아니지만 같이 넣는다).
    const accounts = (await (
      await fetch('https://admob.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
    ).json()) as { account?: { publisherId?: string }[]; error?: { message?: string } };
    const pub = accounts.account?.[0]?.publisherId;
    if (!pub) throw new Error(`AdMob 계정을 찾지 못했어요 (${accounts.error?.message ?? ''})`);
    put('ADMOB_CLIENT_ID', id);
    put('ADMOB_CLIENT_SECRET', secret);
    put('ADMOB_REFRESH_TOKEN', data.refresh_token);
    put('ADMOB_PUBLISHER_ID', pub);
    console.log(`연결한 AdMob 게시자: ${pub}`);
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
