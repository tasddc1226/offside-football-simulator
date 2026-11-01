// T-11-562 시즌 고르기 칸(웹 SeasonSelect · 앱 SeasonSelect)이 함께 쓰는 목록 규칙. 최신 시즌이 맨 위, 프리시즌은 맨 아래다.
// 기간은 한국 시간 날짜(MM.DD)이고, 마감 시각은 다음 날 00:00이라 하루 앞 날짜를 끝으로 쓴다.
import { PRESEASON, seasonById } from '@offside/contracts/service-seasons';
import { seasonPickText as L } from './i18n/ko/seasonPick.js';
import { seasonLabel, teamSeasonLabel } from './seasonName.js';

export type SeasonStatus = 'live' | 'closed' | 'upcoming';
export type SeasonChoice = {
  id: number;
  /** 시즌 이름(지금 언어). */
  name: string;
  /** 상태 글자(마감이면 빈 글자, 칸에 작게 붙인다). */
  tag: string;
  /** 고른 칸에 보일 글자: 진행 중 · 개막 예정이면 상태를 붙인다. */
  face: string;
  /** 목록 줄: 이름 · 기간 · 상태(기간을 모르면 이름만). */
  row: string;
  /** 두 줄 목록의 둘째 줄: 기간 · 상태(앱 고르기 창). */
  detail: string;
  status: SeasonStatus | null;
};

const KST = 9 * 3_600_000;
const day = (ms: number) => {
  const d = new Date(ms + KST);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
};

/** 한 시즌의 표시. name을 주면(서버 목록) 그 이름을 지금 언어로 옮기고, 없으면 id로 만든다. */
export function seasonChoice(id: number, now: string, name?: string): SeasonChoice {
  const label = name === undefined ? teamSeasonLabel(id) : seasonLabel(id, name);
  const s = seasonById(id);
  if (!s) return { id, name: label, tag: '', face: label, row: label, detail: '', status: null };
  let period: string;
  let status: SeasonStatus;
  if (id === PRESEASON.id) {
    const first = seasonById(1);
    period = first ? L.periodUntil({ to: day(Date.parse(first.startsAt) - 1) }) : '';
    status = 'closed';
  } else {
    const from = day(Date.parse(s.startsAt));
    period = s.endsAt
      ? L.periodRange({ from, to: day(Date.parse(s.endsAt) - 1) })
      : L.periodFrom({ from });
    status = s.startsAt > now ? 'upcoming' : s.endsAt && s.endsAt <= now ? 'closed' : 'live';
  }
  const word = L[status];
  return {
    id,
    name: label,
    tag: status === 'closed' ? '' : word,
    face: status === 'closed' ? label : L.face({ name: label, status: word }),
    row: period ? L.row({ name: label, period, status: word }) : label,
    detail: period ? L.detail({ period, status: word }) : word,
    status,
  };
}

/** 고를 수 있는 시즌 목록(최신이 위, 프리시즌은 맨 아래). 같은 id는 한 번만. */
export function seasonChoices(
  seasons: readonly (number | { id: number; name?: string })[],
  now: string,
): SeasonChoice[] {
  const seen = new Set<number>();
  const out: SeasonChoice[] = [];
  for (const s of seasons) {
    const id = typeof s === 'number' ? s : s.id;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(seasonChoice(id, now, typeof s === 'number' ? undefined : s.name));
  }
  return out.sort((a, b) => (a.id === 0 ? 1 : b.id === 0 ? -1 : b.id - a.id));
}
