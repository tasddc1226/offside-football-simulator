// T-11-332 스레드를 넘는 기억. 에이전트는 한 스레드의 최근 대화만 보므로, 닫힌 작업 카드의 결론(card.ts가 자동으로)과
// 운영자가 정한 결정(주장이 `remember`로)을 장부에 남기고 `recall`로 찾는다. 유저 원문 · 개인 정보는 남기지 않는다.
import type { Tool } from './claude.ts';
import type { Env, Role } from './env.ts';
import { kstDay, ledger, type Memory } from './ledger.ts';
import { threadLink } from './chat.ts';
import type { Task } from './thread.ts';

const line = (env: Env, m: Memory) =>
  `- ${kstDay(m.at)} ${m.kind === 'card' ? '카드' : '결정'}(@${m.role}): ${m.text} · ${threadLink(env, m.channel, m.threadTs)}`;

type Recall = Pick<ReturnType<typeof ledger>, 'recall' | 'remember'>;

export function memoryTools(env: Env, role: Role, task: Task, store?: Recall): Tool[] {
  // 장부는 도구를 쓸 때 연다(역할 설명만 만드는 테스트 · 경로에서는 열지 않는다).
  const db = () => store ?? ledger(env);
  const tools: Tool[] = [
    {
      name: 'recall',
      description:
        '다른 스레드 · 지난 날의 결론과 운영자 결정 찾기. query에 낱말(기능 · 증상 · 작업 ID 등)을 넣으면 낱말이 많이 맞는 것부터 8개, 비우면 최근 8개. 닫힌 작업 카드 결론과 운영자가 정한 결정만 있다(대화 원문은 없다).',
      input_schema: { type: 'object', properties: { query: { type: 'string' } } },
      run: async (input) => {
        const found = await db().recall(typeof input.query === 'string' ? input.query : '', 8);
        return found.length ? found.map((m) => line(env, m)).join('\n') : '찾은 기억 없음';
      },
    },
  ];
  if (role === 'plan' && task.threadTs && ['mention', 'reply', 'handoff'].includes(task.kind))
    tools.push({
      name: 'remember',
      description:
        '운영자가 이 스레드에서 정한 결정 · 규칙을 한 줄로 남긴다(다른 스레드에서 recall로 찾게). 운영자가 분명히 정한 것만(예: "임대 화면 고도화는 11월 데이터 보고 판단"). 추정 · 진행 상황 · 유저 원문 · 개인 정보는 남기지 않는다. 한 답에 한 번.',
      input_schema: {
        type: 'object',
        properties: { decision: { type: 'string', description: '결정 한 줄(400자 안)' } },
        required: ['decision'],
      },
      run: async (input) => {
        const text = String(input.decision ?? '').trim();
        if (!text) return '결정 문장이 비었어요';
        await db().remember({
          at: Date.now(),
          kind: 'decision',
          role: 'plan',
          text,
          channel: task.channel,
          threadTs: task.threadTs!,
        });
        return '남겼어요';
      },
    });
  return tools;
}
