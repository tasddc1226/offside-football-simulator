// T-11-334 로그용 오류 한 줄(사용자에게 보이는 오류 문구는 errorText.ts). drizzle 쿼리 오류(DrizzleQueryError)는 메시지가
// "Failed query: <SQL> params: <값>"뿐이라 D1이 실제로 왜 실패했는지(cause: D1_ERROR · 시간 초과 · 연결 끊김 등)가 로그에
// 남지 않았고, 바인딩 값에는 프로필 ID · 선수 이름이 들 수 있다. SQL 앞부분과 cause 사슬만 남기고 값은 뺀다.

const QUERY_MAX = 160;
const CAUSE_DEPTH = 3;

const queryOf = (e: unknown) =>
  e instanceof Error && typeof (e as { query?: unknown }).query === 'string'
    ? (e as unknown as { query: string }).query
    : undefined;

function one(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const q = queryOf(e);
  // 이름이 그냥 Error면 붙이지 않는다(예전 로그 · 저장된 결과와 같은 모양).
  const name = e.name && e.name !== 'Error' ? `${e.name}: ` : '';
  return q === undefined
    ? `${name}${e.message}`
    : `${name}Failed query: ${q.replace(/\s+/g, ' ').slice(0, QUERY_MAX)}`;
}

/** `메시지 | cause: 이름: 메시지 …`(cause는 3단계까지). */
export function logErrorText(e: unknown, max = 500): string {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let i = 0; i < CAUSE_DEPTH && cur != null; i++) {
    parts.push(one(cur));
    cur = cur instanceof Error ? cur.cause : undefined;
  }
  return parts.join(' | cause: ').slice(0, max);
}

/** 스택에서 쿼리 오류의 첫 줄(SQL · 바인딩 값)을 떼어 낸다. 호출 위치(at …)만 남는다. */
export function safeStack(e: Error): string | undefined {
  if (!e.stack || queryOf(e) === undefined) return e.stack;
  const at = e.stack.indexOf('\n    at ');
  return at < 0 ? undefined : `${e.name}${e.stack.slice(at)}`;
}
