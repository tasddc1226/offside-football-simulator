// T-11-400 고객 문의 → 작업 후보 → 시작 카드 → 패치 → 배포 뒤 마무리 답장.
// 문의 정리(@plan)는 유저 메일이 바로 들어오는 자리라 코드를 고치기 시작하지 않는다. 작업 후보만 남기면 Worker가 정리 글을
// 올린 뒤 후보마다 #agent-desk에 스레드 · 작업 카드 · 시작 카드를 만든다. 운영자가 시작 카드를 눌러야 @dev가 시작한다.
// @dev가 "고칠 것 없음"으로 판정하거나 운영 배포가 나가면, 그 스레드에서 @plan이 문의 메일 스레드에 답장 초안을 만든다.
import type { Tool } from './claude.ts';
import { cardOf } from './card.ts';
import { orderRequest, startCard } from './captain.ts';
import { botToken, enabled, ROLE_NAMES, type Env } from './env.ts';
import { ledger, type WorkOrder } from './ledger.ts';
import { higher, isRisk, RISK_LABEL, riskOf } from './risk.ts';
import { slackClient, threadLink, threadReply } from './slack.ts';
import { threadOf, type Task } from './thread.ts';

/** 문의 정리 한 번에 남길 수 있는 작업 후보 수. */
export const MAX_CASES = 3;

export type SupportCase = {
  title: string;
  goal: string;
  repro: string;
  scope: string[];
  done: string;
  risk: WorkOrder['risk'];
  /** 문의 메일 스레드(Gmail threadId). 이번 정리에 들어온 메일 스레드만. */
  mail: string;
};

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const clean = (v: unknown, n: number) =>
  String(v ?? '')
    .replace(EMAIL, '(메일 주소 가림)')
    .trim()
    .slice(0, n);

/** 문의에서 온 작업 명세에 붙는 판정 규칙(@dev Actions가 읽는다). */
export const SUPPORT_RULES = [
  '',
  '고객 문의에서 온 작업이에요. 고치기 전에 재현하고 판정해요: 버그 / 의도한 규칙인데 화면 안내가 부족함 / 고칠 것 없음.',
  '- 마지막 답 첫 줄은 `판정: 버그` · `판정: 안내 부족` · `판정: 고칠 것 없음` 중 하나로 쓰고, 근거(파일 · 규칙)를 붙여요.',
  '- 고칠 것 없음이면 커밋하지 않아요. 근거가 문의 답장에 쓰이니 유저가 알아들을 말로 두세 줄 덧붙여요.',
  '- 확률 · 성장 · 훈련 · 이벤트 가중치처럼 커리어 결과에 닿으면 `SEED=<n>`으로 `pnpm --filter @offside/fulltime-sim sim`을 변경 전후로 돌려 차이를 PR 본문에 적어요.',
  '- 규칙 · 수치가 바뀌면 공개 가이드(`apps/web/scripts/seo.mjs`)와 릴리즈 노트를 같은 커밋에서 고쳐요.',
].join('\n');

/** 문의 정리(@plan, kind support) 도구: 코드 수정이 필요해 보이는 문의를 작업 후보로 남긴다. */
export function supportCaseTools(env: Env, task: Task): Tool[] {
  if (task.kind !== 'support') return [];
  let n = 0;
  return [
    {
      name: 'support_case',
      description: `코드 수정이 필요해 보이는 문의를 작업 후보로 남긴다. 정리 글이 올라간 뒤 Worker가 후보마다 #agent-desk 스레드 · 작업 카드 · #agent-approvals 시작 카드를 만들고, 운영자가 눌러야 @dev가 재현 · 판정 · 수정을 시작한다. 고치고 배포되면 그 문의에 마무리 답장 초안이 따로 만들어진다. 유저 원문 · 가명 · 메일 주소는 넣지 않는다. 한 번 정리에 ${MAX_CASES}개까지.`,
      input_schema: {
        type: 'object',
        properties: {
          thread_id: { type: 'string', description: '문의 메일 스레드 ID(<mail thread="…">)' },
          title: { type: 'string', description: '작업 제목 한 줄' },
          goal: { type: 'string', description: '유저가 겪은 증상과 바뀌어야 할 것(자기 말로)' },
          repro: { type: 'string', description: '재현 조건(플랫폼 · 버전 · 화면, 확인한 것만)' },
          scope: {
            type: 'array',
            items: { type: 'string' },
            description: '볼 · 바꿀 파일 경로 추정(저장소 기준)',
          },
          done: { type: 'string', description: '끝났다고 보는 기준' },
          risk_guess: { type: 'string', description: 'low · mid · high' },
        },
        required: ['thread_id', 'title', 'goal', 'scope', 'done'],
      },
      run: async (input) => {
        if (n >= MAX_CASES) return `이번 정리에서는 작업 후보를 ${MAX_CASES}개까지만 남겨요`;
        const mail = String(input.thread_id ?? '');
        const book = ledger(env);
        // 받는 스레드는 Worker가 이번 정리에 넘긴 메일 스레드로만 정한다(메일 안의 글로 다른 스레드를 고르지 못하게).
        if (!(await book.supportBatch(task.eventId)).includes(mail))
          return '이번 정리에 들어온 문의 메일 스레드가 아니에요';
        const scope = (Array.isArray(input.scope) ? input.scope : [])
          .map((p) => clean(p, 200))
          .filter(Boolean)
          .slice(0, 30);
        const c: SupportCase = {
          title: clean(input.title, 120),
          goal: clean(input.goal, 2000),
          repro: clean(input.repro, 2000),
          scope,
          done: clean(input.done, 1000),
          risk: higher(isRisk(input.risk_guess) ? input.risk_guess : 'low', riskOf(scope)),
          mail,
        };
        await book.addCase(task.eventId, c);
        n += 1;
        return `작업 후보로 남겼어요(위험도 ${RISK_LABEL[c.risk]}). 정리 글이 올라가면 시작 카드가 따로 올라가요.`;
      },
    },
  ];
}

const planSlack = (env: Env) => slackClient(botToken(env, 'plan'), fetch, ROLE_NAMES.plan);

/**
 * 정리 글이 올라간 뒤(thread.ts follow): 남긴 작업 후보마다 #agent-desk에 스레드를 열고 작업 카드 · 시작 카드를 만든다.
 * 문의에서 온 일은 위험도가 낮아도 바로 시작하지 않는다(시작 카드). 높음은 시작 카드 없이 보류하고 운영자에게 맡긴다.
 */
export async function openSupportCases(env: Env, eventId: string, channel: string, postTs: string) {
  const book = ledger(env);
  const cases = await book.takeCases(eventId);
  const slack = planSlack(env);
  let opened = 0;
  for (const c of cases) {
    const head = await slack('chat.postMessage', {
      channel,
      text: `*문의 작업 후보* · ${c.title}\n• 위험도: ${RISK_LABEL[c.risk]} · <${threadLink(channel, postTs)}|문의 정리>`,
    });
    if (!head.ts) continue;
    const thread = `${channel}:${head.ts}`;
    const card = cardOf(env, channel, head.ts);
    const base = {
      channel,
      threadTs: head.ts,
      goal: c.title,
      source: 'support' as const,
      owner: 'plan' as const,
      risk: c.risk,
    };
    if (c.risk === 'high') {
      await card.open({ ...base, status: '보류' });
      await card.patch({ note: '위험도 높음: 운영자가 @dev에게 직접 맡겨야 시작해요' });
      await book.setOrder({ ...order(c, thread), started: false });
      await slack(
        'chat.postMessage',
        threadReply(
          channel,
          head.ts,
          `위험도 높음(범위: ${c.scope.join(', ') || '없음'})이라 시작 카드를 올리지 않았어요. 고치려면 이 스레드에서 @dev에게 직접 맡겨 주세요.`,
        ),
      );
      opened++;
      continue;
    }
    const o = order(c, thread);
    await book.setOrder(o);
    const posted = await slack('chat.postMessage', startCard(env, o, '고객 문의라'));
    if (posted.ts)
      await book.pendingAdd({
        ts: posted.ts,
        channel: env.APPROVAL_CHANNEL,
        label: `작업 시작 ${o.title}`.slice(0, 120),
        at: Date.now(),
      });
    await card.open({ ...base, status: '승인 대기' });
    await card.patch({ note: '시작 카드 승인 대기' });
    opened++;
  }
  return opened;
}

const order = (c: SupportCase, thread: string): WorkOrder => ({
  id: crypto.randomUUID(),
  title: c.title,
  request: `${orderRequest(c)}\n${SUPPORT_RULES}`,
  thread,
  risk: c.risk,
  by: 'plan',
  at: Date.now(),
  mail: c.mail,
});

/** 문의 스레드에 마무리 답장 초안을 맡긴다(@plan, kind followup). 그 작업의 문의 메일 스레드에만 쓸 수 있다. */
export async function supportFollowup(
  env: Env,
  o: Pick<WorkOrder, 'thread' | 'mail' | 'title'>,
  why: 'deployed' | 'no-fix',
  context: string,
) {
  if (!o.mail || !enabled(env, 'plan')) return false;
  const [channel, threadTs] = o.thread.split(':');
  if (!channel || !threadTs) return false;
  const text =
    why === 'deployed'
      ? `이 문의 작업("${o.title}")이 운영 배포로 나갔어요(${context}). 문의 메일 스레드에 마무리 답장 초안을 만들어 주세요.`
      : `@dev가 이 문의 작업("${o.title}")을 "고칠 것 없음"으로 판정했어요. 아래 근거로 문의 메일 스레드에 설명 답장 초안을 만들어 주세요.`;
  await threadOf(env, 'plan', channel, threadTs).enqueue({
    eventId: `followup:${o.thread}:${why}`,
    kind: 'followup',
    role: 'plan',
    channel,
    threadTs,
    sourceTs: '',
    text,
    mail: o.mail,
    ...(why === 'no-fix' ? { context } : {}),
  });
  return true;
}
