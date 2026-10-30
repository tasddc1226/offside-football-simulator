import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { localizeMessage } from './errorText.js';

// T-11-588 사용자에게 던지는 오류 문장(…Error('…') · AppError({ message: '…' }))은 영어 · 일본어 · 번체 중국어 표에 있어야 한다.
// 운영 도구 · 배포 작업만 받는 문장은 한국어로 둔다(CLAUDE.md 다국어 규칙). 값이 끼는 템플릿 문장은 errorText.ts 패턴이 맡고 여기서는 보지 않는다.
const OPERATOR_FILES = new Set([
  'auth/admin.ts',
  'routes/admin.ts',
  'routes/balance.ts',
  'routes/releaseNotes.ts',
  'db/repos/releaseNotes.ts',
]);
const OPERATOR_MESSAGES = new Set(['운영자는 정지할 수 없어요.', '열린 신고가 없어요.']);

const root = new URL('./', import.meta.url).pathname;
function sources(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = `${dir}${f}`;
    if (statSync(p).isDirectory()) {
      if (f !== 'i18n' && f !== 'test') sources(`${p}/`, out);
    } else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
const THROWN =
  /(?:\w+Error|AppError)\(\s*(?:\{[^}]*?message:\s*)?(['`])((?:(?!\1).)*[가-힣](?:(?!\1).)*)\1/gs;

describe('서버 오류 문장 번역', () => {
  it('사용자에게 던지는 고정 문장은 세 언어로 옮겨진다', () => {
    const missing: string[] = [];
    for (const file of sources(root)) {
      const rel = file.slice(root.length);
      if (OPERATOR_FILES.has(rel)) continue;
      for (const [, quote, msg] of readFileSync(file, 'utf8').matchAll(THROWN)) {
        if ((quote === '`' && msg!.includes('${')) || OPERATOR_MESSAGES.has(msg!)) continue;
        for (const lang of ['en', 'ja', 'zh'] as const)
          if (localizeMessage(msg!, lang) === msg) missing.push(`${rel} ${lang}: ${msg}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
