// T-11-600 라운지 필드 오늘의 득점. 아직 서버에 위치 · 공을 보내지 않는 시제품이라 이 기기에서 본 골만 센다.
// 하루는 한국 시각(KST) 자정에 바뀌고, 날짜가 바뀌면 새로 센다.

export interface GoalRow {
  id: string;
  name: string;
  n: number;
}
interface Stored {
  day: string;
  rows: GoalRow[];
}

const KEY = 'offside_lounge_goals_v1';
const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;

/** 한국 시각 날짜(YYYY-MM-DD). */
export const kstDay = (now = Date.now()) => new Date(now + KST_MS).toISOString().slice(0, 10);
/** 다음 한국 시각 자정까지 남은 ms. */
export const msToKstMidnight = (now = Date.now()) => DAY_MS - ((now + KST_MS) % DAY_MS);

export function loadGoals(now = Date.now()): GoalRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const s = JSON.parse(raw) as Stored;
    return s.day === kstDay(now) && Array.isArray(s.rows) ? s.rows : [];
  } catch {
    return [];
  }
}

/** 골 하나를 더하고 많이 넣은 순서로 정렬한 표를 돌려준다(같으면 먼저 넣은 사람이 위). */
export function addGoal(rows: GoalRow[], id: string, name: string, now = Date.now()): GoalRow[] {
  const next = rows.map((r) => (r.id === id ? { ...r, name, n: r.n + 1 } : r));
  if (!next.some((r) => r.id === id)) next.push({ id, name, n: 1 });
  next.sort((a, b) => b.n - a.n);
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: kstDay(now), rows: next } satisfies Stored));
  } catch {
    // 저장소가 막혀 있어도 이번 화면에서는 센다.
  }
  return next;
}
