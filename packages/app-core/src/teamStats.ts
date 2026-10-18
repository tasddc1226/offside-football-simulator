// T-11-358 팀 경기 통계의 흐름 요약 · 경기 종류별 전적 표기. 웹 TeamStats · 앱 TeamStats가 같이 쓴다.
import type { TeamForm, TeamStatsMatch, TeamStatsResponse } from './api/team.js';
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
