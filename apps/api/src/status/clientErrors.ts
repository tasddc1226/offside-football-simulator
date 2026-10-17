// T-11-331 앱·웹 오류 모으기. 보고마다 D1에 쓰지 않으려고 isolate 메모리에 (KST 날짜 × 지문)별로 세어 두었다가
// 서버 상태 집계와 같은 1분 주기(logger.ts)에 `client_errors`로 더한다. isolate가 내려가면 아직 안 더한 몫은 사라진다
// (건수는 근삿값, 어떤 오류가 났는지는 그대로 믿을 만하다). 메일 · 긴 숫자 · 주소의 쿼리는 지우고 저장한다.
import type { ClientErrorReport } from '@offside/contracts';

export type ErrorTally = {
  day: string;
  fingerprint: string;
  platform: string;
  kind: string;
  message: string;
  frame: string;
  where: string;
  stack: string;
  version: string;
  count: number;
  firstAt: string;
  lastAt: string;
};

/** isolate 하나가 들고 있는 서로 다른 오류 수 상한(같은 오류가 몰려도 메모리 · 쓰기가 늘지 않게). */
export const MAX_PENDING = 300;
const MESSAGE_MAX = 300;
const STACK_MAX = 1500;

let pending = new Map<string, ErrorTally>();

const kstDay = (at: number) => new Date(at + 9 * 3600_000).toISOString().slice(0, 10);

/** 저장하기 전에 개인 정보로 보일 만한 것을 지운다. */
export function scrub(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/(https?:\/\/[^\s?#"')]+)[?#][^\s"')]*/g, '$1')
    .replace(/\b[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2,}\b/g, '<code>')
    .replace(/\d{6,}/g, '<n>');
}

/** 묶는 기준 문구: 숫자를 지워 같은 오류가 값만 달라도 한 줄로 모인다. */
export function normalizeMessage(message: string): string {
  return scrub(message).replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, MESSAGE_MAX);
}

/** 스택에서 첫 코드 위치(파일 · 함수). 줄 · 칸 번호와 빌드 해시는 빼서 새 빌드에서도 같은 오류로 모은다. */
export function topFrame(stack: string | undefined): string {
  if (!stack) return '';
  const line = stack
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^at\s|@|\.(js|ts|tsx|bundle)\b/.test(l) && !/^\w*Error\b/.test(l));
  if (!line) return '';
  return line
    .replace(/^at\s+/, '')
    .replace(/https?:\/\/[^/\s)]+/g, '')
    .replace(/[-.][0-9a-f]{6,}(?=\.(js|mjs|bundle))/gi, '')
    .replace(/:\d+(:\d+)?/g, '')
    .replace(/[?#][^\s)]*/g, '')
    .slice(0, 200);
}

async function fingerprintOf(parts: string[]): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('|')));
  return [...new Uint8Array(d)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 보고 하나를 센다. 상한을 넘은 새 오류는 버리고 버린 수를 돌려준다. */
export async function recordClientErrors(r: ClientErrorReport, at: number): Promise<number> {
  const day = kstDay(at);
  const iso = new Date(at).toISOString();
  let dropped = 0;
  for (const item of r.items) {
    const message = normalizeMessage(item.message);
    const frame = topFrame(item.stack);
    const fingerprint = await fingerprintOf([r.platform, item.kind, message, frame]);
    const key = `${day}|${fingerprint}`;
    const t = pending.get(key);
    if (t) {
      t.count += 1;
      t.lastAt = iso;
      t.version = r.version;
      continue;
    }
    if (pending.size >= MAX_PENDING) {
      dropped += 1;
      continue;
    }
    pending.set(key, {
      day,
      fingerprint,
      platform: r.platform,
      kind: item.kind,
      message,
      frame,
      where: scrub(item.where ?? '').slice(0, 120),
      stack: scrub(item.stack ?? '').slice(0, STACK_MAX),
      version: r.version,
      count: 1,
      firstAt: iso,
      lastAt: iso,
    });
  }
  return dropped;
}

/** 모은 것을 넘기고 비운다(logger가 1분 주기에 부른다). */
export function takeClientErrors(): ErrorTally[] {
  if (!pending.size) return [];
  const out = [...pending.values()];
  pending = new Map();
  return out;
}

export async function flushClientErrors(db: D1Database, rows: ErrorTally[]): Promise<void> {
  if (!rows.length) return;
  const stmt = db.prepare(
    `INSERT INTO client_errors (day, fingerprint, platform, kind, message, frame, place, stack, first_version,
       last_version, count, first_at, last_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?10, ?11, ?12)
     ON CONFLICT(day, fingerprint) DO UPDATE SET count = count + excluded.count,
       last_at = excluded.last_at, last_version = excluded.last_version`,
  );
  await db.batch(
    rows.map((t) =>
      stmt.bind(
        t.day,
        t.fingerprint,
        t.platform,
        t.kind,
        t.message,
        t.frame,
        t.where,
        t.stack,
        t.version,
        t.count,
        t.firstAt,
        t.lastAt,
      ),
    ),
  );
}

/** 테스트 전용. */
export function resetClientErrorsForTest(): void {
  pending = new Map();
}
