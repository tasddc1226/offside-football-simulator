import { z } from 'zod';

/** `docs/content/README.md` narrative token 사전. */
export const NARRATIVE_TOKEN_KEYS = ['name', 'club', 'manager', 'rival', 'captain', 'team', 'delta'] as const;
export type NarrativeTokenKey = (typeof NARRATIVE_TOKEN_KEYS)[number];

/** README 조사 쌍. 순서가 정본이며 `{club:와/과}`처럼 순서가 뒤집히면 오류다. */
export const PARTICLE_PAIRS = ['이/가', '을/를', '은/는', '과/와', '으로/로', '아/야'] as const;

export const NarrativeDictionarySchema = z
  .object({
    name: z.array(z.string()).min(1),
    club: z.array(z.string()).min(1),
    manager: z.array(z.string()).min(1),
    rival: z.array(z.string()).min(1),
    captain: z.array(z.string()).min(1),
    team: z.array(z.string()).min(1),
    delta: z.array(z.string()),
  })
  .strict();

const TOKEN_PATTERN = /\{([a-zA-Z]+)(?::([^}]*))?\}/g;

export type NarrativeTokenIssue = { token: string; message: string };

/** 순수 함수. narrative 문자열의 token 이름·조사 쌍을 검사한다. I/O 없음. */
export function findNarrativeTokenIssues(text: string): NarrativeTokenIssue[] {
  const issues: NarrativeTokenIssue[] = [];

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const full = match[0];
    const name = match[1] ?? '';
    const suffix = match[2];
    if (!(NARRATIVE_TOKEN_KEYS as readonly string[]).includes(name)) {
      issues.push({ token: full, message: `사전에 없는 token: ${full}` });
      continue;
    }
    if (suffix === undefined) continue;

    if (name === 'delta') {
      if (suffix !== 'formatted') {
        issues.push({ token: full, message: `delta token은 {delta:formatted}만 허용한다: ${full}` });
      }
      continue;
    }

    if (!(PARTICLE_PAIRS as readonly string[]).includes(suffix)) {
      issues.push({ token: full, message: `잘못된 조사 쌍: ${full}` });
    }
  }

  return issues;
}
