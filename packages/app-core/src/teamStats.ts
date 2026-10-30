// T-11-358 팀 경기 통계의 흐름 요약 · 경기 종류별 전적 표기. 웹 TeamStats · 앱 TeamStats가 같이 쓴다.
import type { TeamForm, TeamStatsMatch, TeamStatsPlayer, TeamStatsResponse } from './api/team.js';
import { kstDay } from '@offside/contracts/kst';
import { teamMatchText as L } from './i18n/ko/teamMatch.js';
import { statsDayLabel } from './teamText.js';

/** 최근 흐름 한 칸 글자(승 · 무 · 패 / W · D · L). */
export const formLetter = (r: TeamForm): string =>
  r === 'w' ? L.statsFormW : r === 'd' ? L.statsFormD : L.statsFormL;

/** 최근 흐름 전체를 읽어 주는 말(스크린 리더). */
export const formAria = (form: readonly TeamForm[]): string =>
  L.statsFormAria({ list: form.map(formLetter).join(' ') });

/** 지금 이어지는 결과("3연승 중"). 경기가 없으면 null. */
export const streakText = (s: { kind: TeamForm; n: number } | null): string | null =>
  !s
    ? null
    : s.kind === 'w'
      ? L.statsStreakW({ n: s.n })
      : s.kind === 'd'
        ? L.statsStreakD({ n: s.n })
        : L.statsStreakL({ n: s.n });

/** 가장 큰 승리 · 패배 한 줄("5 : 0 · 상대 · 10/15", 날짜는 한국 시각). */
export const bigMatchLine = (m: TeamStatsMatch): string =>
  L.statsBigLine({ gf: m.gf, ga: m.ga, opponent: m.opponent, day: statsDayLabel(kstDay(m.at)) });

type Wdl = TeamStatsResponse['total'];
export type StatsKindRow = {
  key: 'rank' | 'friendly' | 'cup';
  label: string;
  /** 치른 경기가 없으면 null(“기록 없음”). */
  record: Wdl | null;
};

/** 경기 종류별 전적 줄(랭크 · 친선전 · 컵). summary가 없는 옛 응답이면 빈 배열. */
export function statsKindRows(s: TeamStatsResponse): StatsKindRow[] {
  if (!s.summary) return [];
  const played = (t: Wdl) => (t.w + t.d + t.l > 0 ? t : null);
  return [
    { key: 'rank', label: L.statsKindRank, record: played(s.total) },
    { key: 'friendly', label: L.statsKindFriendly, record: played(s.summary.friendly) },
    { key: 'cup', label: L.statsKindCup, record: played(s.summary.cup) },
  ];
}

/** T-11-518 선수 탭 정렬. */
export type StatsSort = 'goals' | 'assists' | 'apps';
export const statsSorts = (): [StatsSort, string][] => [
  ['goals', L.statsSortGoals],
  ['assists', L.statsSortAssists],
  ['apps', L.statsSortApps],
];

export type StatsPlayerRow = {
  p: TeamStatsPlayer;
  /** 출전 수. 선발 명단이 남은 경기가 없으면(옛 응답 · 이 기능 전 경기만) null. */
  apps: number | null;
  /** 이름 밑 한 줄(가장 많이 선 자리 · 경기당 골). 없으면 빈 문자열. */
  sub: string;
};

const SORT_KEYS: Record<StatsSort, (keyof Pick<TeamStatsPlayer, 'goals' | 'assists' | 'apps'>)[]> =
  {
    goals: ['goals', 'assists', 'apps'],
    assists: ['assists', 'goals', 'apps'],
    apps: ['apps', 'goals', 'assists'],
  };

/**
 * T-11-518 선수 탭 줄. 출전은 선발 명단이 남은 경기에서만 세서, 센 경기가 모두 명단이 남아 있을 때만 경기당 골을 붙인다
 * (그 전 경기의 골이 섞이면 경기당 골이 부풀려진다).
 */
export function statsPlayerRows(
  s: TeamStatsResponse,
  sort: StatsSort,
): { rows: StatsPlayerRow[]; showApps: boolean; note: string | null } {
  const tracked = s.xiMatches ?? 0;
  const showApps = tracked > 0;
  const full = showApps && tracked === s.matches;
  const keys = SORT_KEYS[showApps ? sort : sort === 'apps' ? 'goals' : sort];
  const rows = [...s.players]
    .sort((a, b) => {
      for (const k of keys) {
        const d = (b[k] ?? 0) - (a[k] ?? 0);
        if (d) return d;
      }
      return 0;
    })
    .map((p) => {
      const apps = showApps ? (p.apps ?? 0) : null;
      let sub = '';
      if (apps !== null) {
        if (p.careerId === null) sub = apps ? L.statsYouthSub : '';
        else {
          const parts: string[] = p.pos ? [p.pos] : [];
          if (full && apps > 0)
            parts.push(
              p.goals ? L.statsPerGame({ v: (p.goals / apps).toFixed(2) }) : L.statsNoGoal,
            );
          sub = parts.join(' · ');
        }
      }
      return { p, apps, sub };
    });
  return {
    rows,
    showApps,
    note: showApps ? (full ? L.statsAppsNote : L.statsAppsPartial({ n: tracked })) : null,
  };
}
