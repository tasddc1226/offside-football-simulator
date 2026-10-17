// ADR-015 4단계 @mkt(안정환): 운영 배포가 끝나면(agent-release.yml) 지난 드림보트 게시 뒤 운영에 나간 변경으로
// 업데이트 요약 초안을 쓰고, #agent-approvals 승인 카드로 올린다. 운영자가 "보내기"를 눌러야 드림보트에 보낸다.
// 드림보트 주소(받기 · 보내기 키가 들어 있다)는 비밀값 DREAMBOAT_URL이다(공개 저장소).
import type { Tool } from './claude.ts';
import { botToken, ROLE_NAMES, type Env } from './env.ts';
import { ghAuth, repoReadToken } from './github.ts';
import { ledger } from './ledger.ts';
import { slackClient } from './slack.ts';
import { threadOf, type Task } from './thread.ts';

export const dreamboatReady = (env: Env) => !!env.DREAMBOAT_URL;

const mktSlack = (env: Env) => slackClient(botToken(env, 'mkt'), fetch, ROLE_NAMES.mkt);

/** 운영 배포 성공 알림(agent-release.yml). 같은 커밋은 한 번만 맡긴다. */
export async function releaseTask(env: Env, r: { sha: string; url?: string }) {
  if (!/^[0-9a-f]{40}$/.test(r.sha)) throw new Error('bad sha');
  return threadOf(env, 'mkt', env.DESK_CHANNEL, 'release').enqueue({
    eventId: `release:${r.sha}`,
    kind: 'release',
    role: 'mkt',
    channel: env.DESK_CHANNEL,
    threadTs: '',
    sourceTs: '',
    text: `운영 배포가 끝났어요. main ${r.sha.slice(0, 7)}${r.url ? ` (${r.url})` : ''}`,
  });
}

/** 드림보트 업데이트 요약 형식(CLAUDE.local.md 규칙): `- `로 시작하는 줄 1~3개, 줄마다 60자 안쪽, 내부 표기 없음. */
export function checkNotes(notes: string): string | null {
  const lines = notes
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > 3) return '줄은 1~3개여야 해요';
  for (const l of lines) {
    if (!l.startsWith('- ')) return '줄마다 "- "로 시작해야 해요';
    if ([...l.slice(2)].length > 60) return `60자를 넘는 줄이 있어요: ${l.slice(0, 30)}…`;
    if (/[`·]|T-\d|#\d|\.(ts|js|svelte|mjs|json|yml)\b|\/[a-z]|https?:/i.test(l))
      return `코드 · 작업 번호 · 주소 · 가운뎃점은 쓰지 않아요: ${l.slice(0, 30)}…`;
  }
  return null;
}

const normalize = (notes: string) =>
  notes
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');

type CommitItem = { sha: string; commit: { message: string; committer?: { date?: string } } };
type CommitFiles = { files?: { filename: string; status: string; raw_url?: string }[] };

/** @mkt 도구. 배포 뒤 요약 · 운영자 지시 · 그 스레드 답글에서 연다. */
export function mktTools(env: Env, task: Task, fetcher: typeof fetch = fetch): Tool[] {
  if (!dreamboatReady(env) || !['release', 'mention', 'reply'].includes(task.kind)) return [];
  const gh = repoReadToken(env);
  let drafted = false;
  return [
    {
      name: 'release_changes',
      description:
        '드림보트에 마지막으로 게시된 시각(since)과, 그 뒤 main에 들어간 커밋(제목)과 그 커밋이 더한 게임 안 릴리즈 노트(.release-notes JSON의 한국어 title · items). 업데이트 요약은 이것 하나로 쓴다.',
      input_schema: { type: 'object', properties: {} },
      run: async () => {
        const since = ((await (await fetcher(env.DREAMBOAT_URL!)).json()) as { since?: string })
          .since;
        if (!since) return JSON.stringify({ error: '드림보트 since를 받지 못했어요' });
        const headers = {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'offside-agents',
          ...(await ghAuth(gh)),
        };
        const base = `https://api.github.com/repos/${env.GITHUB_REPO}`;
        const list = (await (
          await fetcher(`${base}/commits?sha=main&per_page=40&since=${encodeURIComponent(since)}`, {
            headers,
          })
        ).json()) as CommitItem[];
        if (!Array.isArray(list)) return JSON.stringify({ since, error: 'GitHub 커밋 목록 실패' });
        const commits = [];
        for (const c of list.slice(0, 25)) {
          const title = c.commit.message.split('\n')[0]!;
          const notes: unknown[] = [];
          const files = (
            (await (await fetcher(`${base}/commits/${c.sha}`, { headers })).json()) as CommitFiles
          ).files;
          for (const f of files ?? []) {
            if (f.status !== 'added' || !/^\.release-notes\/[^/]+\.json$/.test(f.filename))
              continue;
            const raw = await fetcher(
              `https://raw.githubusercontent.com/${env.GITHUB_REPO}/${c.sha}/${f.filename}`,
            );
            const n = (await raw.json().catch(() => null)) as {
              title?: string;
              items?: string[];
            } | null;
            if (n) notes.push({ title: n.title, items: n.items });
          }
          commits.push({ sha: c.sha.slice(0, 7), title, release_notes: notes });
        }
        return JSON.stringify({ since, commits }).slice(0, 6000);
      },
    },
    {
      name: 'dreamboat_draft',
      description:
        '드림보트 업데이트 요약 초안을 #agent-approvals 승인 카드로 올린다(운영자가 "보내기"를 눌러야 게시 초안으로 간다). notes는 "- "로 시작하는 줄 1~3개, 줄 60자 안쪽, 줄 사이 \\n. 형식이 틀리면 거절한다. 한 번만 쓸 수 있다.',
      input_schema: {
        type: 'object',
        properties: {
          notes: { type: 'string' },
          why: {
            type: 'string',
            description: '운영자에게 한 줄: 어떤 변경을 고르고 무엇을 뺐는지',
          },
        },
        required: ['notes'],
      },
      run: async (input) => {
        if (drafted) throw new Error('초안은 한 번만 올려요');
        const notes = normalize(String(input.notes ?? ''));
        const bad = checkNotes(notes);
        if (bad) throw new Error(bad);
        drafted = true;
        const id = crypto.randomUUID();
        await ledger(env).setMktDraft({ id, notes, at: Date.now() });
        const posted = await mktSlack(env)(
          'chat.postMessage',
          dreamboatCard(env, id, notes, String(input.why ?? '')),
        );
        if (!posted.ok) throw new Error(`승인 카드를 못 올렸어요(${posted.error})`);
        if (posted.ts)
          await ledger(env).pendingAdd({
            ts: posted.ts,
            channel: env.APPROVAL_CHANNEL,
            label: '드림보트 요약',
            at: Date.now(),
          });
        return '승인 카드를 올렸어요.';
      },
    },
  ];
}

export function dreamboatCard(env: Env, id: string, notes: string, why: string) {
  const value = JSON.stringify({ draft: id });
  const text = [
    '*드림보트 업데이트 요약 승인 요청*',
    '• 무엇을: 아래 줄을 드림보트에 보내기. 받은 내용은 초안으로 있다가 매일 04:00 KST에 새 버전으로 게시돼요.',
    '• 되돌리기: 게시 전엔 드림보트에서 지우거나 다시 보내면 바뀌어요(마지막으로 보낸 것만 써요).',
    ...(why ? [`• 고른 이유: ${why.slice(0, 300)}`] : []),
    '',
    notes,
  ].join('\n');
  return {
    channel: env.APPROVAL_CHANNEL,
    text: '드림보트 업데이트 요약 승인 요청',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: text.slice(0, 2900) } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '승인하고 보내기' },
            style: 'primary',
            action_id: 'dreamboat_send',
            value,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '버리기' },
            style: 'danger',
            action_id: 'dreamboat_discard',
            value,
          },
        ],
      },
    ],
  };
}

type Interaction = {
  type: string;
  user: { id: string };
  channel?: { id: string };
  message?: { ts: string; blocks?: unknown[] };
  actions?: { action_id: string; value: string }[];
};

/** 드림보트 승인 버튼. 운영자만, 한 초안은 한 번만 처리한다. */
export async function mktInteraction(env: Env, p: Interaction, fetcher: typeof fetch = fetch) {
  const act = p.actions?.[0];
  if (
    p.type !== 'block_actions' ||
    !act ||
    !['dreamboat_send', 'dreamboat_discard'].includes(act.action_id)
  )
    return 'ignored';
  const slack = mktSlack(env);
  const channel = p.channel?.id ?? env.APPROVAL_CHANNEL;
  if (p.user.id !== env.OPERATOR_USER_ID) {
    await slack('chat.postEphemeral', {
      channel,
      user: p.user.id,
      text: '승인은 운영자만 할 수 있어요.',
    });
    return 'forbidden';
  }
  const finish = async (line: string) => {
    if (p.message?.ts)
      await slack('chat.update', {
        channel,
        ts: p.message.ts,
        text: line,
        blocks: [
          ...((p.message.blocks ?? []).slice(0, 1) as unknown[]),
          { type: 'context', elements: [{ type: 'mrkdwn', text: line }] },
        ],
      });
  };
  const { draft } = JSON.parse(act.value) as { draft: string };
  const book = ledger(env);
  const d = await book.mktDraft(draft);
  const send = act.action_id === 'dreamboat_send';
  const record = (result: string) =>
    book.recordMktApproval({
      draft,
      action: send ? 'send' : 'discard',
      user: p.user.id,
      at: Date.now(),
      result,
    });
  if (!d || d.done) {
    await finish('이미 처리했거나 기록이 없는 초안이라 아무것도 하지 않았어요.');
    return 'missing';
  }
  await book.setMktDraft({ ...d, done: true });
  if (!send) {
    await record('discarded');
    await finish(`<@${p.user.id}>님이 초안을 버렸어요. 드림보트에는 보내지 않았어요.`);
    return 'discarded';
  }
  if (!env.DREAMBOAT_URL) {
    await record('no url');
    await finish('드림보트 주소가 없어 보내지 못했어요.');
    return 'blocked';
  }
  const r = await fetcher(env.DREAMBOAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: d.notes }),
  });
  const body = (await r.json().catch(() => ({}))) as { ok?: boolean; scheduled?: string };
  if (!r.ok || !body.ok) {
    // 카드는 그대로 두고 다시 누를 수 있게 한다.
    await book.setMktDraft({ ...d, done: false });
    await record(`failed ${r.status}`);
    await slack('chat.postEphemeral', {
      channel,
      user: p.user.id,
      text: `드림보트가 받지 않았어요(HTTP ${r.status}). 잠시 뒤 다시 눌러 주세요.`,
    });
    return 'failed';
  }
  await record('sent');
  await finish(
    `<@${p.user.id}>님 승인으로 드림보트에 보냈어요. ${(body.scheduled ?? '').slice(0, 120)}`,
  );
  return 'sent';
}
