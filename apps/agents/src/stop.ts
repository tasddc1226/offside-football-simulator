// 운영자 멈춤. 스레드에서 에이전트를 불러 "멈춰"라고만 쓰면 모델을 거치지 않고 Worker가 바로 처리한다:
// 그 스레드의 네 역할 대기열을 비우고, 돌고 있는 답은 다음 턴 전에 끊고, 그 스레드가 띄운 @dev Actions 실행을 취소하고,
// 작업 카드를 보류로 둔다. 운영 배포는 마이그레이션 중간에 끊기면 위험해서 멈추지 않는다.
import { enabled, ROLES, type Env } from './env.ts';
import { cardOf } from './card.ts';
import { appGh, cancelDevRuns } from './dev.ts';
import type { Gh } from './github.ts';
import { ledger } from './ledger.ts';
import { chatClient } from './chat.ts';
import { threadReply } from './reply.ts';
import { threadOf, type Task } from './thread.ts';

const STOP =
  /^(멈춰|멈춰요|멈춰\s?줘|멈춰\s?주세요|중단|중단해|중단해\s?줘|그만|그만해|stop)[.!\s]*$/i;

/** 멘션 · 부르기를 뺀 글이 멈춤 명령 하나뿐인지. "멈춰 있는 이유 알려줘"처럼 문장이면 아니다. */
export const isStopCommand = (text: string) => STOP.test(text.trim());

export async function stopThread(
  env: Env,
  task: Task,
  gh: () => Promise<Gh> = () => appGh(env),
): Promise<string> {
  const slack = chatClient(env, task.role);
  const say = (text: string) =>
    slack('chat.postMessage', threadReply(task.channel, task.threadTs, text));
  if (task.threadTs === task.sourceTs) {
    await say('멈출 일은 스레드 안에서 불러 주세요. 그 스레드의 일만 멈춰요.');
    return 'not thread';
  }
  if (!(await ledger(env).claimStop(task.sourceTs))) return 'duplicate';
  let cleared = 0;
  let running = 0;
  for (const role of ROLES) {
    if (!enabled(env, role)) continue;
    const r = await threadOf(env, role, task.channel, task.threadTs).stop();
    cleared += r.cleared;
    if (r.running) running++;
  }
  const lines: string[] = [];
  let runs: number[] = [];
  let runError: string | undefined;
  if (enabled(env, 'dev') && env.GITHUB_APP_PRIVATE_KEY) {
    try {
      runs = await cancelDevRuns(await gh(), `${task.channel}:${task.threadTs}`);
    } catch (e) {
      runError = String(e instanceof Error ? e.message : e).slice(0, 120);
    }
  }
  const card = await cardOf(env, task.channel, task.threadTs)
    .patch({ status: '보류', note: '운영자 멈춤', next: null })
    .catch(() => undefined);
  lines.push(
    running ? `돌고 있던 답 ${running}개는 다음 턴 전에 끊어요.` : '돌고 있던 답은 없었어요.',
  );
  if (cleared) lines.push(`기다리던 일 ${cleared}개를 지웠어요.`);
  if (runs.length)
    lines.push(
      `@dev 작업 실행 ${runs.length}개를 취소했어요(${runs.map((id) => `<https://github.com/${env.GITHUB_REPO}/actions/runs/${id}|${id}>`).join(' · ')}).`,
    );
  if (runError)
    lines.push(`@dev 작업 실행은 확인하지 못했어요(${runError}). GitHub에서 직접 봐 주세요.`);
  if (card) lines.push('작업 카드는 보류로 두었어요.');
  lines.push('운영 배포 · 이미 연 PR · 올라간 승인 카드는 그대로예요. 다시 하려면 불러 주세요.');
  await say(`멈췄어요.\n${lines.map((l) => `• ${l}`).join('\n')}`);
  return 'stopped';
}
