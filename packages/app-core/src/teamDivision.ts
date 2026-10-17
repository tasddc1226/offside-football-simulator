// T-11-375 구단 디비전 화면 규칙(웹 · 앱 공용). 경계는 서버 최신 밸런스(`/v1/balance`, 부팅 때 받는다)를 쓰고, 못 받았으면
// 기본값이다. 디비전 자체는 서버가 경기 때 정해 팀 응답에 싣는다 — 여기서는 남은 점수 · 막대 · 문구만 만든다.
import {
  clampDivision,
  divisionProgress,
  divisionRules,
  TEAM_DIVISION_KEYS,
  TEAM_DIVISION_TOP,
  type DivisionRules,
} from '@offside/contracts/team-division';
import { latestBalance } from '@offside/game/balance';
import { loadKey, saveKey } from '@offside/game/storage';
import { teamDivisionText as L } from './i18n/ko/teamDivision.js';
import { teamSeasonLabel } from './seasonName.js';
import { num } from './teamText.js';

export { TEAM_DIVISION_KEYS, TEAM_DIVISION_TOP };

/** 지금 화면이 쓰는 경계 · 강등 보호(서버 최신, 못 받았으면 기본값). */
export const currentDivisionRules = (): DivisionRules => divisionRules(latestBalance().values);

const names = () => [L.d0, L.d1, L.d2, L.d3, L.d4, L.d5, L.d6, L.d7];
export const divisionName = (d: number): string => names()[clampDivision(d)]!;
/** 엠블럼 색 · 단계(CSS 클래스 · 앱 색표가 같은 키를 쓴다). */
export const divisionKey = (d: number) => TEAM_DIVISION_KEYS[clampDivision(d)]!;
/** 엠블럼 틀: 아마추어 · 세미프로 = 동, 프로 = 은, 엘리트 = 금, 마스터 = 금 + 왕관. */
export const divisionTier = (d: number): 'bronze' | 'silver' | 'gold' | 'master' => {
  const c = clampDivision(d);
  return c === TEAM_DIVISION_TOP ? 'master' : c >= 5 ? 'gold' : c >= 3 ? 'silver' : 'bronze';
};

export type DivisionHeadView = {
  division: number;
  name: string;
  /** 막대 비율(0~100). */
  pct: number;
  /** 막대 아래 한 줄(다음 디비전까지 · 가장 높은 디비전 · 강등 보호 중). */
  line: string;
  guard: boolean;
  aria: string;
};

/** 팀 화면 머리의 디비전 카드. 디비전을 모르는 옛 응답이면 null(그리지 않는다). */
export function divisionHead(
  team: { rating: number; division?: number | undefined } | null,
  rules: DivisionRules = currentDivisionRules(),
): DivisionHeadView | null {
  if (!team || team.division === undefined) return null;
  const p = divisionProgress(team.rating, team.division, rules);
  const name = divisionName(p.division);
  const pct = Math.round(p.ratio * 100);
  const line =
    p.guardLeft !== null
      ? L.guard({ n: num(p.guardLeft) })
      : p.gap === null
        ? L.top
        : L.toNext({ n: num(p.gap), name: divisionName(p.division + 1) });
  return {
    division: p.division,
    name,
    pct,
    line,
    guard: p.guardLeft !== null,
    aria: L.progressAria({ name, pct }),
  };
}

export type DivisionShift = { from: number; to: number };
/** 경기 결과 창의 승격 · 강등 한 줄. 바뀌지 않았으면 null. */
export function divisionShiftView(shift: DivisionShift | undefined | null) {
  if (!shift || shift.from === shift.to) return null;
  const up = shift.to > shift.from;
  const name = divisionName(shift.to);
  return {
    up,
    division: clampDivision(shift.to),
    title: up ? L.promoted({ name }) : L.relegated({ name }),
    body: up ? L.promotedBody : L.relegatedBody,
  };
}

/** 시즌 보상 안내 한 줄(보상 시작 시즌 전이면 미리 보기 안내). */
export function divisionRewardNote(season: number): string {
  const v = latestBalance().values;
  return season < v.teamDivRewardFrom
    ? L.previewNote
    : L.rewardNote({ from: teamSeasonLabel(v.teamDivRewardFrom), matches: v.teamDivMinMatches });
}

// 받은 경기로 디비전이 바뀌면 다음 접속 때 한 번 알린다. 이 기기에서 마지막으로 본 (시즌, 디비전)을 기억한다.
const SEEN_KEY = 'ft_team_div_seen';
type Seen = { season: number; division: number };
const readSeen = (): Seen | null => {
  const raw = loadKey<unknown>(SEEN_KEY);
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Seen>;
  return Number.isInteger(r.season) && Number.isInteger(r.division)
    ? { season: r.season!, division: r.division! }
    : null;
};

/**
 * 팀 화면을 열 때 부른다. 같은 시즌에 이 기기가 본 디비전과 다르면 알릴 바뀜을 돌려주고, 지금 디비전을 기억한다.
 * 처음 보는 시즌(새 시즌 · 새 기기)은 알리지 않는다.
 */
export function takeDivisionChange(
  season: number,
  division: number | undefined,
): (DivisionShift & { text: string }) | null {
  if (division === undefined) return null;
  const seen = readSeen();
  saveKey(SEEN_KEY, { season, division });
  if (!seen || seen.season !== season || seen.division === division) return null;
  return {
    from: seen.division,
    to: division,
    text: L.changedAway({ name: divisionName(division) }),
  };
}

/** 내가 경기를 걸어 바뀐 디비전은 결과 창에서 이미 보여 줬다 — 다음 접속 때 다시 알리지 않게 기억만 고친다. */
export function markDivisionSeen(season: number, division: number | undefined): void {
  if (division !== undefined) saveKey(SEEN_KEY, { season, division });
}
