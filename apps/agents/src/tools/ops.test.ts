import { describe, expect, it } from 'vitest';
import { fileView, opsTools } from './ops.ts';

const text = Array.from(
  { length: 1000 },
  (_, i) => `line ${i + 1}${i === 499 ? ' owner_teams' : ''}`,
).join('\n');

describe('fileView', () => {
  it('줄 번호를 붙여 from부터 lines줄을 보이고 이어 읽을 줄을 알려 준다', () => {
    const v = fileView(text, { from: 101, lines: 3 });
    expect(v).toBe(
      '101\tline 101\n102\tline 102\n103\tline 103\n…(전체 1000줄, 이어 읽으려면 from_line 104)',
    );
  });

  it('마지막까지 읽으면 이어 읽기 안내가 없다', () => {
    expect(fileView(text, { from: 999, lines: 300 })).toBe('999\tline 999\n1000\tline 1000');
  });

  it('pattern이면 맞은 줄과 앞뒤 2줄만 준다', () => {
    const v = fileView(text, { from: 1, lines: 300, pattern: 'OWNER_teams' });
    expect(v).toContain('맞은 줄 1개');
    expect(v).toContain('498\tline 498');
    expect(v).toContain('500\tline 500 owner_teams');
    expect(v).toContain('502\tline 502');
    expect(v).not.toContain('503\t');
  });

  it('긴 줄이 많아도 줄 중간에서 자르지 않고 다음 줄 번호를 준다', () => {
    const wide = Array.from({ length: 50 }, () => 'x'.repeat(1000)).join('\n');
    const v = fileView(wide, { from: 1, lines: 300 });
    expect(v).toMatch(/이어 읽으려면 from_line 14\)$/);
  });

  it('맞는 줄이 없거나 정규식이 틀리면 알려 준다', () => {
    expect(fileView(text, { from: 1, lines: 10, pattern: 'nothing-here' })).toBe(
      '맞는 줄이 없어요(전체 1000줄)',
    );
    expect(() => fileView(text, { from: 1, lines: 10, pattern: '(' })).toThrow(/정규식/);
  });
});

const tool = (fetcher: typeof fetch, name: string) =>
  opsTools({ accountId: 'a', databaseId: 'd', d1Token: 't', repo: 'o/r', fetcher }).find(
    (t) => t.name === name,
  )!;

describe('repo_find · pr_list', () => {
  it('repo_find는 낱말이 모두 든 경로만, node_modules는 빼고 준다', async () => {
    const fetcher = (async () =>
      Response.json({
        tree: [
          { path: 'apps/api/src/team/sim.ts', type: 'blob' },
          { path: 'apps/api/src/team', type: 'tree' },
          { path: 'apps/api/node_modules/x/team/sim.js', type: 'blob' },
          { path: 'apps/web/src/team.ts', type: 'blob' },
        ],
      })) as unknown as typeof fetch;
    expect(await tool(fetcher, 'repo_find').run({ query: 'Team SIM' })).toBe(
      'apps/api/src/team/sim.ts',
    );
  });

  it('pr_list는 작업 ID로 찾고 머지된 PR을 merged로 표시한다', async () => {
    let url = '';
    const fetcher = (async (u: string) => {
      url = u;
      return Response.json([
        {
          number: 738,
          title: 'T-11-300: 무엇',
          state: 'closed',
          merged_at: '2026-10-16T09:00:00Z',
          head: { ref: 'T-11-300-x' },
          html_url: 'u738',
        },
        {
          number: 737,
          title: 'T-11-299: 다른 것',
          state: 'open',
          merged_at: null,
          head: { ref: 'T-11-299' },
          html_url: 'u737',
        },
      ]);
    }) as unknown as typeof fetch;
    const out = JSON.parse(await tool(fetcher, 'pr_list').run({ query: 't-11-300' }));
    expect(url).toContain('/repos/o/r/pulls?state=all');
    expect(out).toEqual([
      {
        number: 738,
        title: 'T-11-300: 무엇',
        state: 'merged',
        branch: 'T-11-300-x',
        merged_at: '2026-10-16T09:00:00Z',
        url: 'u738',
      },
    ]);
  });
});
