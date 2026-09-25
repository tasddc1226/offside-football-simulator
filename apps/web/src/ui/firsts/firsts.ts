// T-10-027 서버 최초 기록 화면의 순수 계산(정렬·날짜 묶기·표시 이름). 컴포넌트와 테스트가 같이 쓴다.
import type { ServerFirst, ServerFirstCat } from '@offside/contracts';
import { anonName } from '../format.js';

export type FirstsTab = 'recent' | ServerFirstCat;
export const FIRSTS_TABS: { id: FirstsTab; label: string }[] = [
  { id: 'recent', label: '최근 기록' },
  { id: 'total', label: '통산' },
  { id: 'season', label: '시즌' },
  { id: 'honor', label: '수상·우승' },
];

type Holder = NonNullable<ServerFirst['holder']>;
export type AchievedFirst = ServerFirst & { achievedAt: string; holder: Holder };

const pad = (n: number) => String(n).padStart(2, '0');
/** 한국 시간 기준 날짜(26.09.25)·시각(14:05). 모두가 같은 기록을 보므로 보는 사람 시간대 대신 한 기준으로 맞춘다. */
export function kstParts(iso: string): { day: string; time: string } {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return {
    day: `${pad(d.getUTCFullYear() % 100)}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/** 달성된 기록만, 최근 것부터. */
export const achievedList = (items: ServerFirst[]): AchievedFirst[] =>
  items.filter((x): x is AchievedFirst => !!x.holder && !!x.achievedAt).sort((a, b) => b.achievedAt.localeCompare(a.achievedAt));

/** 최근 기록 탭: 한국 날짜별로 묶는다(입력 순서 유지). */
export function byDay(list: AchievedFirst[]): { day: string; items: AchievedFirst[] }[] {
  const out: { day: string; items: AchievedFirst[] }[] = [];
  for (const x of list) {
    const day = kstParts(x.achievedAt).day;
    const last = out[out.length - 1];
    if (last?.day === day) last.items.push(x);
    else out.push({ day, items: [x] });
  }
  return out;
}

/** 내 선수(이 기기의 커리어)면 이 기기에 있는 이름을, 아니면 공개 이름 또는 익명 표기를 쓴다. */
export function holderLabel(h: Holder, mine: ReadonlyMap<string, string>): { name: string; mine: boolean } {
  const own = mine.get(h.careerId);
  return own ? { name: own, mine: true } : { name: h.name ?? anonName(h.pos, h.number), mine: false };
}
