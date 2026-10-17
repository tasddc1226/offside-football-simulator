// T-11-331 앱·웹 오류 보내기(POST /v1/client-errors). 잡히지 않은 오류를 모았다가 몇 초 뒤 한 번에 보낸다.
// 같은 오류는 한 번만, 한 번 켜진 동안 최대 MAX_PER_SESSION건만 보낸다(서버 · 데이터 보호). 앱이 멈추는 오류(fatal)는
// 저장소에 먼저 적어 두고 다음 실행 때 보낸다. 보내기 실패는 조용히 버린다(오류 보고가 오류를 만들지 않게).
// 타입만 가져와 zod가 번들에 들어오지 않는다.
import type { ClientErrorItem, ClientErrorReport } from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/storage';
import { apiAuth, apiBaseUrl } from './api/client.js';

export const MAX_PER_SESSION = 20;
const BATCH_MAX = 10;
const FLUSH_DELAY_MS = 3000;
const PENDING_KEY = 'offside.errors.pending';

/** 우리 코드가 아닌 오류: 다른 출처 스크립트(내용 없음), 브라우저 확장, 알려진 무해 경고. */
const IGNORE = [
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /(chrome|moz|safari(-web)?)-extension:\/\//i,
  /^Non-Error promise rejection captured/i,
];

type Target = { platform: ClientErrorReport['platform']; version: string };
let target: Target | null = null;
let queue: ClientErrorItem[] = [];
const seen = new Set<string>();
let sent = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** 시작할 때 한 번(configureApi 뒤에) 부른다. 지난 실행에서 남긴 fatal을 보낸다. */
export function configureErrorReport(t: Target): void {
  target = t;
  const pending = loadKey<ClientErrorItem[]>(PENDING_KEY);
  if (Array.isArray(pending) && pending.length) {
    saveKey(PENDING_KEY, []);
    void send(pending.slice(0, BATCH_MAX));
  }
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: `${error.name}: ${error.message}`,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error)?.slice(0, 200) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

/** 오류 하나를 보낼 목록에 넣는다. 무시 대상 · 중복 · 상한 초과면 넣지 않고 false. */
export function reportError(
  kind: ClientErrorItem['kind'],
  error: unknown,
  where?: string,
): boolean {
  if (!target) return false;
  const { message, stack } = describe(error);
  if (!message || IGNORE.some((re) => re.test(message) || (stack && re.test(stack)))) return false;
  const key = `${kind}|${message.slice(0, 200)}`;
  if (seen.has(key) || sent + queue.length >= MAX_PER_SESSION) return false;
  seen.add(key);
  const item: ClientErrorItem = {
    kind,
    message: message.slice(0, 500),
    ...(stack ? { stack: stack.slice(0, 4000) } : {}),
    ...(where ? { where: where.slice(0, 120) } : {}),
  };
  if (kind === 'fatal') {
    // 앱이 곧 꺼질 수 있어 먼저 적어 둔다. 보내기에 성공하면 지운다.
    const pending = loadKey<ClientErrorItem[]>(PENDING_KEY) ?? [];
    saveKey(PENDING_KEY, [...pending, item].slice(-BATCH_MAX));
    void send([item]).then((ok) => ok && saveKey(PENDING_KEY, []));
    return true;
  }
  queue.push(item);
  if (queue.length >= BATCH_MAX) flushErrors();
  else timer ??= setTimeout(flushErrors, FLUSH_DELAY_MS);
  return true;
}

/** 모은 것을 바로 보낸다(화면을 떠날 때 등). */
export function flushErrors(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const items = queue.splice(0, BATCH_MAX);
  void send(items);
}

async function send(items: ClientErrorItem[]): Promise<boolean> {
  if (!target || !items.length) return false;
  sent += items.length;
  const body: ClientErrorReport = { platform: target.platform, version: target.version, items };
  try {
    const res = await fetch(`${apiBaseUrl()}/v1/client-errors`, {
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', ...apiAuth().headers },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 테스트 전용. */
export function resetErrorReportForTest(): void {
  target = null;
  queue = [];
  seen.clear();
  sent = 0;
  if (timer) clearTimeout(timer);
  timer = null;
}
