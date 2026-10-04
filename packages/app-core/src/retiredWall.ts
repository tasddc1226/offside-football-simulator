// ───────── 기록실 '영구결번' 벽 표시 로직 (웹·앱 공용, T-10-076 · 공용 T-11-044) ─────────
import type { RetiredNumbersResponse } from '@offside/contracts';
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
