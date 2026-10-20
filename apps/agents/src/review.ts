// @dev PR을 코드를 쓴 모델(Opus)과 다른 모델(Sonnet)이 읽고, 머지 승인 카드에 리뷰 몇 줄을 붙인다. 고치지 않고 읽기만 한다.
// 리뷰가 실패해도 승인 카드는 그대로 올라간다(운영자가 직접 본다).
import { MODEL_LABEL, MODELS, runAgent } from './claude.ts';
import { apiKey, type Env } from './env.ts';
import type { Gh } from './github.ts';
import type { DevJob } from './ledger.ts';
import system from '../roles/dev-review.md';

export const REVIEW_MODEL = MODELS.sonnet;
/** diff 글자 상한. 넘으면 자르고 잘랐다고 적는다(큰 PR은 운영자가 직접 본다). */
const DIFF_LIMIT = 60_000;

export type Review = NonNullable<DevJob['review']>;

type PrFile = { filename: string; status: string; patch?: string };

/** PR 파일 목록으로 리뷰할 diff를 만든다. 바이너리 · 너무 큰 파일은 patch가 없어 이름만 남는다. */
export function diffText(files: PrFile[]): { text: string; cut: boolean } {
  let text = '';
  for (const f of files) {
    const part = `### ${f.filename} (${f.status})\n${f.patch ?? '(diff 없음: 바이너리이거나 너무 큼)'}\n\n`;
    if (text.length + part.length > DIFF_LIMIT)
      return { text: `${text}…(diff가 길어 여기서 잘랐어요)`, cut: true };
    text += part;
  }
  return { text, cut: false };
}

/** 첫 줄로 판정을 읽는다. 형식을 어기면 확인 필요로 본다(문제 없음으로 잘못 넘기지 않게). */
export const verdictOf = (text: string): Review['verdict'] =>
  /^\s*(?:\*\*)?리뷰(?:\*\*)?\s*[:：]\s*(?:\*\*)?문제 없음/.test(
    text.split('\n').find((l) => l.trim()) ?? '',
  )
    ? 'ok'
    : 'check';

export async function reviewPr(
  env: Env,
  g: Gh,
  pr: { number: number; title: string; body?: string | null },
  request: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<Review> {
  const { data } = await g<PrFile[]>(`/pulls/${pr.number}/files?per_page=100`);
  const files = Array.isArray(data) ? data : [];
  const diff = diffText(files);
  const content = [
    request
      ? `<request>\n${request.slice(0, 8_000)}\n</request>`
      : '<request>(지시 기록 없음)</request>',
    `<pr>\n제목: ${pr.title}\n\n${(pr.body ?? '').slice(0, 4_000)}\n</pr>`,
    `<diff files="${files.length}">\n${diff.text}\n</diff>`,
  ].join('\n\n');
  const r = await runAgent({
    apiKey: apiKey(env, 'dev'),
    system,
    tools: [],
    messages: [{ role: 'user', content }],
    maxTurns: 2,
    budgetUsd: 1,
    model: REVIEW_MODEL,
    fetcher,
  });
  const text = r.text.trim() || '리뷰: 확인 필요\n- 리뷰 답이 비었어요. 직접 확인해 주세요.';
  return {
    verdict: verdictOf(text),
    text: (diff.cut ? `${text}\n- diff가 길어 앞부분만 봤어요.` : text).slice(0, 1_500),
    costUsd: r.costUsd,
    model: MODEL_LABEL[REVIEW_MODEL],
  };
}
