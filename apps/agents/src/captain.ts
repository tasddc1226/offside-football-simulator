// ADR-015 5 · 6단계(T-11-325) 주장(@plan 박지성) 도구. card_update로 스레드의 작업 카드를 열고 고친다. work_order로 고칠 일을
// 작업 명세로 정리해 위험도대로 시작한다: 낮음은 바로 @dev 작업(하루 3건), 중간은 #agent-approvals 시작 카드(운영자가 눌러야 시작),
// 높음은 시작하지 않고 운영자에게 묻는다. 머지 · 배포는 위험도와 상관없이 지금처럼 승인 카드로만 한다.
import type { Tool } from './claude.ts';
import { cardOf, isStatus, type CardSource, type CardStatus } from './card.ts';
import { appGh, dispatchWork, workRunsUrl } from './dev.ts';
import { isRole, list, type Env } from './env.ts';
import type { Gh } from './github.ts';
import { kstDay, ledger, type WorkOrder } from './ledger.ts';
import { higher, isRisk, RISK_LABEL, riskOf, type Risk } from './risk.ts';
import { chatClient, threadLink } from './chat.ts';
import { threadReply } from './slack.ts';
import type { Task } from './thread.ts';

/** 낮음 자동 시작 하루 상한. 넘으면 시작 카드로 바뀐다. */
export const AUTO_LIMIT = 3;
export const START_ACTIONS = ['plan_start', 'plan_start_reject'];

const planSlack = (env: Env) => chatClient(env, 'plan');
const devSlack = (env: Env) => chatClient(env, 'dev');

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const clean = (v: unknown, n: number) =>
  String(v ?? '')
    .replace(EMAIL, '(메일 주소 가림)')
    .trim()
    .slice(0, n);

/** 주장이 쓴 작업 명세를 @dev(Actions) 지시로. 유저 원문 · 메일 주소는 넣지 않는다(EMAIL은 한 번 더 가린다). */
export function orderRequest(o: {
  goal: string;
  repro: string;
  scope: string[];
  done: string;
  risk: Risk;
}): string {
  return [
    '주장 @plan(박지성)이 쓴 작업 명세예요. 유저 원문은 들어 있지 않아요. 명세 밖의 일은 하지 않아요.',
    '',
    `목표: ${o.goal}`,
    `재현 조건: ${o.repro || '없음'}`,
    `바꿀 범위: ${o.scope.length ? o.scope.join(', ') : '명세에 없음(가장 작은 범위로)'}`,
    `끝났다고 보는 기준: ${o.done}`,
    `위험도: ${RISK_LABEL[o.risk]}. 범위 밖 파일(특히 마이그레이션 · 결제 · 세이브 포맷 · 밸런스 스펙 · 인증 · 설정)은 바꾸지 않아요.`,
  ].join('\n');
}

const sourceOf = (env: Env, task: Task): CardSource =>
  list(env.ALERT_CHANNELS).includes(task.channel)
    ? 'alert'
    : task.kind === 'handoff' && task.from === 'ops'
      ? 'alert'
      : 'operator';

/** 주장 도구. 운영자 지시 · 답글 · 넘겨받은 일에서만 준다(유저 원문이 바로 들어오는 반응 살피기 · 문의 정리에는 없다). */
export function captainTools(
  env: Env,
  task: Task,
  gh: () => Promise<Gh> = () => appGh(env),
): Tool[] {
  if (task.kind !== 'mention' && task.kind !== 'reply' && task.kind !== 'handoff') return [];
  if (!task.threadTs) return [];
  const card = () => cardOf(env, task.channel, task.threadTs);
  const thread = `${task.channel}:${task.threadTs}`;
  let ordered = false;
  return [
    {
      name: 'card_update',
      description:
        '이 스레드의 작업 카드를 연다(없으면 goal 필요) · 고친다. status: 접수 · 조사 · 수정 · 승인 대기 · 배포 · 확인 중 · 닫힘 · 보류. owner: ops · plan · dev · mkt. next_in_hours와 next_what으로 다음 확인을 정한다. 닫을 때는 note에 결론 한 줄.',
      input_schema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: '목표 한 줄' },
          status: { type: 'string' },
          owner: { type: 'string' },
          risk: { type: 'string', description: 'low · mid · high' },
          next_in_hours: { type: 'number' },
          next_what: { type: 'string' },
          link: { type: 'string', description: '이슈 · PR · 실행 기록 주소' },
          note: { type: 'string' },
        },
      },
      run: async (input) => {
        const status = input.status === undefined ? undefined : String(input.status);
        if (status !== undefined && !isStatus(status)) return `모르는 상태예요: ${status}`;
        const owner = input.owner === undefined ? undefined : String(input.owner);
        if (owner !== undefined && !isRole(owner)) return `모르는 역할이에요: ${owner}`;
        const risk = isRisk(input.risk) ? input.risk : undefined;
        const hours = Number(input.next_in_hours);
        const next =
          hours > 0 && input.next_what
            ? {
                at: Date.now() + Math.min(hours, 24 * 14) * 3600_000,
                what: String(input.next_what),
              }
            : undefined;
        const patch = {
          ...(input.goal ? { goal: String(input.goal) } : {}),
          ...(status ? { status: status as CardStatus } : {}),
          ...(owner && isRole(owner) ? { owner } : {}),
          ...(risk ? { risk } : {}),
          ...(next ? { next } : {}),
          ...(input.link ? { link: String(input.link).slice(0, 300) } : {}),
          ...(input.note !== undefined ? { note: String(input.note) } : {}),
        };
        const had = await card().patch(patch);
        if (had) return `카드를 고쳤어요(${had.status}).`;
        if (!input.goal) return '이 스레드에 카드가 없어요. 열려면 goal을 주세요.';
        const opened = await card().open({
          channel: task.channel,
          threadTs: task.threadTs,
          goal: String(input.goal),
          source: sourceOf(env, task),
          owner: owner && isRole(owner) ? owner : 'plan',
          ...(risk ? { risk } : {}),
          ...(status ? { status: status as CardStatus } : {}),
        });
        const rest = await card().patch({
          ...(next ? { next } : {}),
          ...(input.link ? { link: String(input.link).slice(0, 300) } : {}),
        });
        return `카드를 열었어요(${(rest ?? opened).status}).`;
      },
    },
    {
      name: 'work_order',
      description: `고칠 일을 작업 명세로 정리해 위험도대로 시작한다. 위험도는 scope 경로로 다시 판정해 risk_guess와 높은 쪽을 쓴다. 낮음(문구 · 다국어 · 문서 · 테스트 · 화면 그리기)은 바로 @dev 작업을 띄운다(하루 ${AUTO_LIMIT}건, 넘으면 시작 카드). 중간(API · 쿼리 · 게임 로직)은 #agent-approvals에 시작 카드를 올린다. 높음(마이그레이션 · 결제 · 세이브 · 밸런스 · 인증 · 설정)은 시작하지 않는다. 유저 원문 · 가명 · 메일 주소는 넣지 않는다. 한 답에 한 번만.`,
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '작업 제목 한 줄(작업 ID 있으면 앞에)' },
          goal: { type: 'string', description: '무엇이 어떻게 바뀌어야 하는지' },
          repro: { type: 'string', description: '재현 조건(확인한 것만)' },
          scope: {
            type: 'array',
            items: { type: 'string' },
            description: '바꿀 파일 · 폴더 경로(저장소 기준)',
          },
          done: { type: 'string', description: '끝났다고 보는 기준(돌릴 검사 포함)' },
          risk_guess: { type: 'string', description: 'low · mid · high' },
        },
        required: ['title', 'goal', 'scope', 'done'],
      },
      run: async (input) => {
        if (ordered) return '이미 이 답에서 작업 명세를 냈어요';
        const scope = (Array.isArray(input.scope) ? input.scope : [])
          .map((p) => clean(p, 200))
          .filter(Boolean)
          .slice(0, 30);
        const guess = isRisk(input.risk_guess) ? input.risk_guess : 'low';
        const risk = higher(guess, riskOf(scope));
        const title = clean(input.title, 120);
        const request = orderRequest({
          goal: clean(input.goal, 2000),
          repro: clean(input.repro, 2000),
          scope,
          done: clean(input.done, 1000),
          risk,
        });
        const order: WorkOrder = {
          id: crypto.randomUUID(),
          title,
          request,
          thread,
          risk,
          by: 'plan',
          at: Date.now(),
        };
        ordered = true;
        const opened = async (status: CardStatus, note?: string) => {
          const c = card();
          const p = { status, risk, ...(note ? { note } : {}) };
          if (!(await c.patch(p)))
            await c.open({
              channel: task.channel,
              threadTs: task.threadTs,
              goal: title,
              source: sourceOf(env, task),
              owner: status === '수정' ? 'dev' : 'plan',
              risk,
              status,
            });
          if (status === '수정') await c.patch({ owner: 'dev' });
        };
        if (risk === 'high') {
          await opened('보류', '위험도 높음: 운영자가 @dev에게 직접 맡겨야 시작해요');
          return `위험도 높음이라 시작하지 않았어요(범위: ${scope.join(', ') || '없음'}). 운영자에게 @dev에게 직접 맡겨 달라고 적어 주세요.`;
        }
        const book = ledger(env);
        let why = '';
        if (risk === 'low') {
          if ((await book.autoStarts()) >= AUTO_LIMIT)
            why = `오늘 낮음 자동 시작 ${AUTO_LIMIT}건을 다 써서`;
          else {
            const failed = await dispatchWork(env, await gh(), { title, request, thread });
            if (failed) return failed;
            await book.autoStart();
            await book.setOrder({ ...order, started: true });
            await opened('수정');
            await devSlack(env)(
              'chat.postMessage',
              threadReply(
                task.channel,
                task.threadTs,
                `주장 박지성의 작업 명세(위험도 낮음)로 바로 시작했어요. <${workRunsUrl(env)}|진행 보기> · 끝나면 이 스레드에 PR이 올라와요.`,
              ),
            );
            return `위험도 낮음이라 @dev 작업을 바로 띄웠어요(오늘 자동 시작 ${(await book.autoStarts()).toString()}/${AUTO_LIMIT}). 머지는 승인 카드로 해요.`;
          }
        }
        await book.setOrder(order);
        const posted = await planSlack(env)('chat.postMessage', startCard(env, order, why));
        if (!posted.ok) return `시작 카드를 못 올렸어요(${posted.error})`;
        if (posted.ts)
          await book.pendingAdd({
            ts: posted.ts,
            channel: env.APPROVAL_CHANNEL,
            label: `작업 시작 ${title}`.slice(0, 120),
            at: Date.now(),
          });
        await opened('승인 대기', '시작 카드 승인 대기');
        return `${why ? `${why} ` : ''}#agent-approvals에 시작 카드를 올렸어요(위험도 ${RISK_LABEL[risk]}). 운영자가 누르면 @dev 작업이 시작돼요.`;
      },
    },
  ];
}

export function startCard(env: Env, o: WorkOrder, why = '') {
  const [channel, ts] = o.thread.split(':');
  const value = JSON.stringify({ order: o.id });
  const text = [
    `*작업 시작 승인 요청* · ${o.title}`,
    `• 위험도: ${RISK_LABEL[o.risk]}${why ? ` (${why} 시작 카드로 왔어요)` : ''}`,
    `• 무엇을: 아래 명세로 @dev가 Actions에서 고치고 PR을 열어요. 머지는 따로 승인 카드로 받아요.`,
    `• 요청: <${threadLink(env, channel!, ts!)}|스레드>`,
    '```',
    o.request.slice(0, 2500),
    '```',
  ].join('\n');
  return {
    channel: env.APPROVAL_CHANNEL,
    text: `작업 시작 승인 요청 ${o.title}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '승인하고 시작' },
            style: 'primary',
            action_id: 'plan_start',
            value,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '거절' },
            style: 'danger',
            action_id: 'plan_start_reject',
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

/** 시작 카드 버튼. 운영자가 아니면 아무것도 하지 않는다. 같은 명세는 한 번만 시작한다. */
export async function startInteraction(
  env: Env,
  p: Interaction,
  gh: () => Promise<Gh> = () => appGh(env),
) {
  const act = p.actions?.[0];
  if (p.type !== 'block_actions' || !act || !START_ACTIONS.includes(act.action_id))
    return 'ignored';
  const slack = planSlack(env);
  const channel = p.channel?.id ?? env.APPROVAL_CHANNEL;
  if (p.user.id !== env.OPERATOR_USER_ID) {
    await slack('chat.postEphemeral', {
      channel,
      user: p.user.id,
      text: '승인은 운영자만 할 수 있어요.',
    });
    return 'forbidden';
  }
  const { order: id } = JSON.parse(act.value) as { order: string };
  const book = ledger(env);
  const o = await book.order(id);
  const [tc, tt] = (o?.thread ?? ':').split(':');
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
    if (tc && tt) await slack('chat.postMessage', threadReply(tc, tt, line));
  };
  if (!o) {
    await finish('작업 명세를 찾지 못했어요. 스레드에서 다시 맡겨 주세요.');
    return 'gone';
  }
  if (o.started) {
    await finish('이 명세는 이미 시작했어요.');
    return 'duplicate';
  }
  if (act.action_id === 'plan_start_reject') {
    await cardOf(env, tc!, tt!)
      .patch({ status: '보류', note: '시작 카드 거절' })
      .catch(() => undefined);
    await finish(`<@${p.user.id}>님이 작업 시작을 거절했어요. 카드는 보류로 두었어요.`);
    return 'rejected';
  }
  const failed = await dispatchWork(env, await gh(), {
    title: o.title,
    request: o.request,
    thread: o.thread,
  });
  if (failed) {
    await finish(failed);
    return 'failed';
  }
  await book.setOrder({ ...o, started: true });
  await cardOf(env, tc!, tt!)
    .patch({ status: '수정', owner: 'dev', note: '' })
    .catch(() => undefined);
  await finish(
    `<@${p.user.id}>님 승인으로 @dev 작업을 시작했어요(${kstDay()}). <${workRunsUrl(env)}|진행 보기>`,
  );
  return 'started';
}
