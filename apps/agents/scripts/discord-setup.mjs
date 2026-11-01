// T-11-576 디스코드 서버 준비(운영자가 한 번 실행). 봇 토큰을 숨김 입력으로 받아
// (1) 에이전트 · 알림 채널을 만들고(있으면 그대로), (2) 알림 채널마다 웹훅(offside-notify)을 만들고,
// (3) 봇 토큰 · 웹훅 주소를 비밀값(에이전트 Worker · GitHub · 운영 API)에 바로 넣는다. 토큰 · 웹훅 주소는 화면에 찍지 않는다.
//
//   node apps/agents/scripts/discord-setup.mjs            # 채널 · 웹훅 만들고 비밀값까지
//   node apps/agents/scripts/discord-setup.mjs --no-secrets  # 채널 · 웹훅만(비밀값은 그대로)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const GUILD = '1565285712062976002';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** notify: 알림 웹훅을 만들고 넣을 비밀값. */
const CHANNELS = [
  { name: 'agent-desk', topic: '에이전트에게 일을 맡기고 정리 글을 받는 곳' },
  { name: 'agent-approvals', topic: '머지 · 배포 · 답장 승인 카드(운영자만 누를 수 있어요)' },
  {
    name: 'offside-alerts',
    topic: '운영 점검 경보(이운재가 첫 정리를 달아요)',
    gh: 'SLACK_ALERTS_WEBHOOK',
  },
  { name: 'offside-daily', topic: '아침 리포트', gh: 'SLACK_DAILY_WEBHOOK' },
  {
    name: 'offside-purchases',
    topic: '실결제 · 환불 · 컵 · 리그 정체',
    gh: 'SLACK_PURCHASES_WEBHOOK',
    api: 'BILLING_SLACK_WEBHOOK',
  },
  {
    name: 'offside-feedback',
    topic: '커뮤니티 · 릴리즈 노트 피드백 후보',
    gh: 'SLACK_FEEDBACK_WEBHOOK',
  },
  { name: 'offside-releases', topic: '운영 배포 결과 · 스토어 메일', gh: 'SLACK_RELEASES_WEBHOOK' },
];

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) process.stdout.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const token = process.env.DISCORD_BOT_TOKEN || (await askHidden('디스코드 봇 토큰: '));
if (!token) throw new Error('봇 토큰이 없어요');

async function api(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://discord.com/api/v10${path}`, {
      method,
      headers: {
        Authorization: `Bot ${token}`,
        'User-Agent': 'DiscordBot (https://offside-lab.com, 1)',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.status === 429 && attempt < 3) {
      const { retry_after = 1 } = await r.json();
      await new Promise((ok) => setTimeout(ok, retry_after * 1000));
      continue;
    }
    const data = r.status === 204 ? null : await r.json();
    if (!r.ok)
      throw new Error(
        `${method} ${path.replace(/\/webhooks\/.*/, '/webhooks/…')} → ${r.status} ${data?.message ?? ''}`,
      );
    return data;
  }
}

/** 값을 표준 입력으로 넘겨 비밀값에 넣는다(명령줄 · 화면에 남지 않는다). */
function putSecret(label, cmd, args, cwd, value) {
  const r = spawnSync(cmd, args, { cwd, input: value, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${label} 실패: ${(r.stderr || r.stdout).slice(0, 300)}`);
  console.log(`  ✓ ${label}`);
}

const me = await api('GET', '/users/@me');
const guild = await api('GET', `/guilds/${GUILD}`);
console.log(
  `봇 ${me.username}(${me.id}) · 서버 ${guild.name} · 운영자(서버 주인) ${guild.owner_id}`,
);

const existing = await api('GET', `/guilds/${GUILD}/channels`);
const ids = {};
const hooks = {};
for (const c of CHANNELS) {
  const found = existing.find((x) => x.type === 0 && x.name === c.name);
  const ch =
    found ??
    (await api('POST', `/guilds/${GUILD}/channels`, { name: c.name, type: 0, topic: c.topic }));
  ids[c.name] = ch.id;
  if (!c.gh) continue;
  const list = await api('GET', `/channels/${ch.id}/webhooks`);
  const hook =
    list.find((h) => h.name === 'offside-notify' && h.token) ??
    (await api('POST', `/channels/${ch.id}/webhooks`, { name: 'offside-notify' }));
  hooks[c.name] = `https://discord.com/api/webhooks/${hook.id}/${hook.token}`;
}
console.log('채널 ID:', JSON.stringify(ids, null, 2));

if (!process.argv.includes('--no-secrets')) {
  console.log('비밀값 넣는 중…');
  putSecret(
    '에이전트 Worker DISCORD_BOT_TOKEN',
    'pnpm',
    ['exec', 'wrangler', 'secret', 'put', 'DISCORD_BOT_TOKEN'],
    `${ROOT}apps/agents`,
    token,
  );
  for (const c of CHANNELS) {
    if (c.gh) putSecret(`GitHub ${c.gh}`, 'gh', ['secret', 'set', c.gh], ROOT, hooks[c.name]);
    if (c.api)
      putSecret(
        `운영 API ${c.api}`,
        'pnpm',
        ['exec', 'wrangler', 'secret', 'put', c.api, '--env', 'production'],
        `${ROOT}apps/api`,
        hooks[c.name],
      );
  }
  // 스토어 메일 알림(운영자 기기, tooling/scripts/slack-store-mail.mjs 사본)도 디스코드로 돌린다.
  const local = join(homedir(), '.config/offside-ops');
  if (existsSync(join(local, 'hooks.json'))) {
    const saved = JSON.parse(readFileSync(join(local, 'hooks.json'), 'utf8'));
    writeFileSync(
      join(local, 'hooks.json'),
      `${JSON.stringify({ ...saved, 'offside-releases': hooks['offside-releases'] }, null, 2)}\n`,
      { mode: 0o600 },
    );
    copyFileSync(
      `${ROOT}tooling/scripts/slack-ops-client.mjs`,
      join(local, 'slack-ops-client.mjs'),
    );
    console.log('  ✓ 스토어 메일 알림(~/.config/offside-ops)');
  }
}
console.log(
  JSON.stringify({
    operator: guild.owner_id,
    desk: ids['agent-desk'],
    approvals: ids['agent-approvals'],
    alerts: ids['offside-alerts'],
  }),
);
