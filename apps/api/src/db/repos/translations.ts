import type { Locale } from '@offside/contracts/i18n';
import { sha256Hex } from '../hash.js';

// T-11-146 사용자 글 번역 캐시(schema.ts translations). 원문은 저장하지 않고 해시 키로만 찾는다.
export const translationKey = (text: string, to: Locale) => sha256Hex(`${to}\n${text}`);

export async function getTranslation(db: D1Database, key: string): Promise<string | undefined> {
  const row = await db
    .prepare('SELECT text FROM translations WHERE key = ?')
    .bind(key)
    .first<{ text: string }>();
  return row?.text;
}

/** 동시에 같은 글을 번역해도 먼저 쓴 것을 둔다. */
export async function putTranslation(db: D1Database, key: string, text: string, now: string) {
  await db
    .prepare('INSERT OR IGNORE INTO translations (key, text, created_at) VALUES (?, ?, ?)')
    .bind(key, text, now)
    .run();
}
