// @dev PR 다른 모델 리뷰: diff 만들기 · 판정 읽기 · 승인 카드 줄.
import { describe, expect, it } from 'vitest';
import { reviewLines } from './dev.ts';
import type { Env } from './env.ts';
import type { Gh } from './github.ts';
import { diffText, REVIEW_MODEL, reviewPr, verdictOf } from './review.ts';

describe('@dev PR 리뷰', () => {
  it('첫 줄이 문제 없음일 때만 통과로 읽고, 형식을 어기면 확인 필요로 본다', () => {
    expect(verdictOf('리뷰: 문제 없음\n저장 경로만 봤어요')).toBe('ok');
    expect(verdictOf('**리뷰**: 문제 없음')).toBe('ok');
    expect(verdictOf('리뷰: 확인 필요\n- a.ts:3 빠진 분기')).toBe('check');
    expect(verdictOf('좋아 보여요. 리뷰: 문제 없음')).toBe('check');
    expect(verdictOf('')).toBe('check');
  });

  it('diff가 길면 파일 경계에서 자르고 잘랐다고 적는다', () => {
    const small = diffText([{ filename: 'a.ts', status: 'modified', patch: '+x' }]);
    expect(small).toEqual({ text: '### a.ts (modified)\n+x\n\n', cut: false });
    const big = diffText([
      { filename: 'a.ts', status: 'modified', patch: 'a'.repeat(50_000) },
      { filename: 'b.ts', status: 'modified', patch: 'b'.repeat(20_000) },
    ]);
    expect(big.cut).toBe(true);
    expect(big.text).toContain('### a.ts');
    expect(big.text).not.toContain('### b.ts');
    expect(diffText([{ filename: 'p.png', status: 'added' }]).text).toContain('diff 없음');
  });

  it('Sonnet에 도구 없이 지시 · PR · diff를 넘기고 판정 · 비용을 돌려준다', async () => {
    const sent: { model: string; tools?: unknown; messages: { content: string }[] }[] = [];
    const fetcher = (async (_u: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return Response.json({
        model: REVIEW_MODEL,
        stop_reason: 'end_turn',
        usage: { input_tokens: 10_000, output_tokens: 200 },
        content: [{ type: 'text', text: '리뷰: 확인 필요\n- a.ts:2 빈 목록에서 터져요' }],
      });
    }) as unknown as typeof fetch;
    const g: Gh = async () => ({
      status: 200,
      data: [{ filename: 'a.ts', status: 'modified', patch: '+const x = list[0].id' }] as never,
    });
    const r = await reviewPr(
      { ANTHROPIC_DEV_API_KEY: 'k' } as unknown as Env,
      g,
      { number: 7, title: 'T-11-999: 고침', body: '본문' },
      '목록 첫 항목을 보여 줘',
      fetcher,
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]!.model).toBe('claude-sonnet-5-5');
    expect(sent[0]!.tools).toBeUndefined();
    const body = JSON.stringify(sent[0]!.messages);
    expect(body).toContain('목록 첫 항목을 보여 줘');
    expect(body).toContain('list[0].id');
    expect(r).toMatchObject({ verdict: 'check', model: 'Sonnet 5.5' });
    expect(r.costUsd).toBeGreaterThan(0);
  });

  it('승인 카드에 리뷰 결과를 붙이고, 못 받았으면 그렇다고 적는다', () => {
    expect(reviewLines({})).toEqual(['• 리뷰: 못 받았어요. 바뀐 파일을 직접 확인해 주세요.']);
    const base = { costUsd: 0.05, model: 'Sonnet 5.5' };
    expect(
      reviewLines({ review: { ...base, verdict: 'ok', text: '리뷰: 문제 없음\n봤어요' } }),
    ).toEqual(['• 리뷰(Sonnet 5.5): 문제 없음']);
    expect(
      reviewLines({
        review: {
          ...base,
          verdict: 'check',
          text: '리뷰: 확인 필요\n- a.ts:2 터져요\n- b.ts:9 누락',
        },
      }),
    ).toEqual(['• ⚠️ 리뷰(Sonnet 5.5): 확인 필요', '   - a.ts:2 터져요', '   - b.ts:9 누락']);
  });
});
