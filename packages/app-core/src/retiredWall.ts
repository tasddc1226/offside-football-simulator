// ───────── 기록실 '영구결번' 벽 표시 로직 (웹·앱 공용, T-10-076 · 공용 T-11-044) ─────────
import type { RetiredNumbersResponse, RetiredNumbersSummary } from '@offside/contracts';
import { defaultClubName, leagueOfClub } from '@offside/contracts/club-names';

type Item = RetiredNumbersResponse['items'][number];

export const rnLeagueName = (clubId: string) => leagueOfClub(clubId)?.name ?? '';
/** 결번 당시 기록된 이름은 유저가 바꿔 부른 이름일 수 있다 — 모두가 보는 벽에는 게임 기본 이름을 건다. */
export const rnClubName = (it: Pick<Item, 'clubId' | 'club'>) =>
  defaultClubName(it.clubId) ?? it.club;
/** 결번 날짜(기기 시간대 기준 "2026.10.2"). */
export const rnDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

/** 구단별 — 결번이 많은 구단 먼저, 같으면 먼저 결번을 낸 구단. 구단 안에서는 번호 순. */
export function rnByClub<T extends Pick<Item, 'clubId' | 'number' | 'seq'>>(
  items: readonly T[],
): T[][] {
  const by: Record<string, T[]> = {};
  for (const it of items) (by[it.clubId] ??= []).push(it);
  return Object.values(by)
    .map((list) => list.sort((a, b) => a.number - b.number))
    .sort(
      (a, b) =>
        b.length - a.length || Math.min(...a.map((x) => x.seq)) - Math.min(...b.map((x) => x.seq)),
    );
}

/** 최신순(결번 순번 큰 것 먼저). 원본은 그대로 둔다. */
export const rnRecent = <T extends Pick<Item, 'seq'>>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => b.seq - a.seq);

type ClubSum = RetiredNumbersSummary['clubs'][number];

/** T-11-101 벽 첫 화면의 구단 목록 정렬 — 결번 많은 순(서버 순서 그대로) 또는 리그별. */
export type RnClubOrder = 'count' | 'league';

/** 리그별 — 결번이 많은 리그 먼저, 리그 안에서는 서버 순서(결번 많은 구단 먼저). 리그를 모르는 구단은 '기타'. */
export function rnByLeague<T extends Pick<ClubSum, 'clubId' | 'count'>>(
  clubs: readonly T[],
): { league: string; count: number; clubs: T[] }[] {
  const by = new Map<string, { league: string; count: number; clubs: T[] }>();
  for (const c of clubs) {
    const league = rnLeagueName(c.clubId) || '기타';
    const g = by.get(league) ?? { league, count: 0, clubs: [] };
    g.count += c.count;
    g.clubs.push(c);
    by.set(league, g);
  }
  return [...by.values()].sort((a, b) => b.count - a.count);
}
