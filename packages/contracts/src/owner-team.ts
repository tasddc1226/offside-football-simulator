/**
 * T-10-092 구단주 팀(팀 슬롯). zod가 없는 서브패스(`@offside/contracts/owner-team`)라 웹이 값으로 가져와도
 * 번들에 zod가 들어가지 않는다 — 서버의 팀 OVR·경기 시뮬레이션과 웹의 편성 미리보기가 같은 규칙을 쓴다.
 *
 * 팀은 구글 로그인한 구단주만 시즌마다 한 팀씩 만든다(원작처럼 시즌마다 새 팀). 선수는 그 구단주의 은퇴한 커리어 중
 * 그 시즌에 처음 올라온 선수만 넣고, 빈 자리는 유스 선수(고정 OVR)가 채운다 — 은퇴 선수가 11명이 안 되는 구단주도
 * 한 명만 넣으면 경기할 수 있다.
 */

import { DETAIL_GROUP, type DetailPos, type PeakProfile, type PosGroup } from './positions.js';
import type { TeamSynergy } from './team-synergy.js';

export * from './team-synergy.js';

/** 팀 이름 길이(앞뒤 공백 제외). */
export const TEAM_NAME_MIN = 2;
export const TEAM_NAME_MAX = 12;
/** 감독 이름 길이(앞뒤 공백 제외). */
export const MANAGER_NAME_MIN = 2;
export const MANAGER_NAME_MAX = 10;
/** 팀 레이팅 — 새 팀은 TEAM_RATING_START에서 시작해 경기마다 엘로 방식으로 오르내린다(두 팀 합은 그대로). */
export const TEAM_RATING_START = 1000;
export const TEAM_RATING_K = 32;
/** 라이브 랭킹(팀 랭킹) 한 페이지의 팀 수. */
export const TEAM_RANK_PER_PAGE = 20;

// T-10-095 공정한 팀 경쟁 — 한 팀만 골라 되풀이해 이기며 레이팅을 쌓지 못하게 한다. 같은 상대에게는 한국 시각 하루에
// 한 번만 건다(서버가 상대 후보에서 빼고, 다시 걸면 거절한다).
/** 같은 두 팀이 이 기간(일) 안에 다시 만나면 레이팅 변화를 줄인다(누가 걸었든 센다). */
export const TEAM_REPEAT_WINDOW_DAYS = 7;
/** 다시 만날 때마다 레이팅 변화에 곱하는 값과 그 하한 — 1번째 재대결 ×0.5, 2번째부터 ×0.25. */
export const TEAM_REPEAT_FACTOR = 0.5;
export const TEAM_REPEAT_FLOOR = 0.25;
/**
 * 경기를 건 쪽(홈)의 이점을 레이팅 점수로 — 같은 전력이면 홈 기대 점수가 약 0.528(경기 시뮬레이션 2만 판)이라 기대 승률에
 * 이만큼 얹는다. 없으면 건 쪽이 기대보다 자주 이겨 경기를 많이 거는 팀의 레이팅이 부푼다.
 */
export const TEAM_HOME_ADV_RATING = 20;

/** 최근 TEAM_REPEAT_WINDOW_DAYS일 동안 두 팀이 이미 치른 경기 수 → 레이팅 변화 배율. */
export const repeatFactor = (meetings: number): number =>
  Math.max(TEAM_REPEAT_FLOOR, TEAM_REPEAT_FACTOR ** meetings);

/** 한 팀 쪽 경기 결과(승 1 · 무 0.5 · 패 0). */
export const matchScore = (goalsFor: number, goalsAgainst: number): 0 | 0.5 | 1 =>
  goalsFor > goalsAgainst ? 1 : goalsFor < goalsAgainst ? 0 : 0.5;

/**
 * 경기 한 판의 레이팅 변화(away는 부호만 반대라 두 팀 합은 그대로). score = home(경기를 건 팀) 결과(승 1 · 무 0.5 · 패 0).
 * 강한 팀이 약한 팀을 이기면 조금, 약한 팀이 이기면 많이 오른다. 기대 승률에는 홈 이점(TEAM_HOME_ADV_RATING)을 넣고,
 * 최근에 만난 상대면 repeatFactor만큼 줄인다.
 */
export function ratingChange(
  home: number,
  away: number,
  score: 0 | 0.5 | 1,
  meetings = 0,
): { home: number; away: number } {
  const expected = 1 / (1 + 10 ** ((away - home - TEAM_HOME_ADV_RATING) / 400));
  const delta = Math.round(TEAM_RATING_K * (score - expected) * repeatFactor(meetings));
  return { home: delta, away: -delta };
}
/** 빈 자리를 채우는 유스 선수의 OVR. */
export const YOUTH_OVR = 50;
export const YOUTH_NAME = '유스 선수';
/** 구단주 한 명이 한국 시각 하루(자정 기준)에 치를 수 있는 경기 수. */
export const TEAM_MATCHES_PER_DAY = 10;
/** 한 팀의 선발 인원. */
export const LINEUP_SIZE = 11;
/** T-11-114 선발에 넣을 수 있는 지난 시즌 선수(와일드카드) 수. 나머지는 그 시즌 선수다. */
export const TEAM_WILDCARD_MAX = 3;
/** 팀 시즌보다 앞 시즌 카드면 와일드카드. 시즌을 모르는 옛 응답은 그 시즌 선수로 본다. */
export const isWildcardSeason = (cardSeason: number | null | undefined, teamSeason: number) =>
  (cardSeason ?? teamSeason) < teamSeason;
export const WILDCARD_FULL_TEXT = `지난 시즌 선수는 선발에 ${TEAM_WILDCARD_MAX}명까지 넣을 수 있어요.`;

// T-11-098 친구 · 친선전. 친선전은 레이팅·전적·업적에 들어가지 않고 친구끼리 상대 전적만 남긴다.
/** 친구(보낸·받은 신청 포함) 상한. */
export const FRIENDS_MAX = 50;
/** 구단주 한 명이 한국 시각 하루에 걸 수 있는 친선전 수(랭크 경기와 따로 센다). */
export const FRIENDLY_MATCHES_PER_DAY = 10;
export {
  FRIEND_CODE_CHARS,
  FRIEND_CODE_LENGTH,
  FRIEND_CODE_RE,
  FRIEND_INVITE_PARAM,
  normalizeFriendCode,
} from './friend-code.js';

// 세부 포지션(T-10-091)은 커리어의 dpos와 같은 정의를 쓴다.
export {
  DETAIL_GROUP,
  DETAIL_LABEL,
  anonName,
  type DetailPos,
  type PeakProfile,
  type PosGroup,
} from './positions.js';

export const FORMATION_IDS = ['4-3-3', '4-4-2', '3-5-2'] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

/** 포메이션의 11자리. 순서는 골키퍼 → 수비 → 미드필더 → 공격, 줄 안에서는 왼쪽부터다. */
export const FORMATIONS: Record<FormationId, readonly DetailPos[]> = {
  '4-3-3': ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST', 'W'],
  '4-4-2': ['GK', 'FB', 'CB', 'CB', 'FB', 'W', 'CM', 'CM', 'W', 'ST', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'FB', 'DM', 'AM', 'CM', 'FB', 'ST', 'ST'],
};

/** 그라운드에 그릴 줄마다의 인원(골키퍼 줄부터). 합은 11. */
export const FORMATION_ROWS: Record<FormationId, readonly number[]> = {
  '4-3-3': [1, 4, 3, 3],
  '4-4-2': [1, 4, 4, 2],
  '3-5-2': [1, 3, 5, 2],
};

/** 자유 편성 좌표(공격이 위, 가로·세로 0~100)와 그 자리의 경기 포지션. */
export type TeamPosition = { x: number; y: number; slot: DetailPos };
export type TeamLayout = readonly TeamPosition[];

/** 옛 팀은 저장된 포메이션으로 좌표를 만든다. */
export function presetLayout(formation: FormationId): TeamPosition[] {
  const rows = FORMATION_ROWS[formation];
  let at = 0;
  return rows.flatMap((count) =>
    Array.from({ length: count }, (_, col) => {
      const slot = FORMATIONS[formation][at++]!;
      const x = (100 * (col + 1)) / (count + 1);
      return {
        x:
          slot === 'FB' || slot === 'W'
            ? col < count / 2
              ? 18
              : 82
            : slot === 'CB'
              ? Math.max(30, Math.min(70, x))
              : x,
        y: { GK: 91, FB: 75, CB: 75, DM: 62, CM: 49, AM: 37, W: 25, ST: 16 }[slot],
        slot,
      };
    }),
  );
}

/** 옮긴 필드 위치를 경기 포지션으로 해석한다. 골키퍼는 첫 자리 하나로 유지한다. */
export function positionRole(x: number, y: number, index: number): DetailPos {
  if (index === 0) return 'GK';
  const wide = x < 28 || x > 72;
  if (y < 28) return wide ? 'W' : 'ST';
  if (y < 43) return 'AM';
  if (y < 56) return 'CM';
  if (y < 67) return 'DM';
  return wide ? 'FB' : 'CB';
}

/**
 * 최고 시점 능력치(PeakProfile)가 없는 선수(이 기능 전에 은퇴한 선수)가 그 자리에서 내는 비율. 세부 포지션이
 * 같으면 1.0, 세부 포지션을 모르고(null) 같은 계열이면 0.95, 같은 계열의 다른 세부 포지션이면 0.9, 필드
 * 플레이어끼리 다른 계열이면 0.75, 골키퍼 ↔ 필드는 0.3.
 */
export function fit(slot: DetailPos, pos: PosGroup, dpos?: DetailPos | null): number {
  const group = DETAIL_GROUP[slot];
  if (group === pos) {
    if (dpos == null) return 0.95;
    return dpos === slot ? 1 : 0.9;
  }
  return group === 'GK' || pos === 'GK' ? 0.3 : 0.75;
}

/** 자리 실력을 정하는 선수 정보. roles가 있으면(최고 시점 능력치) 그 자리 역할의 실력을 그대로 쓴다. */
export type SlotPlayer = {
  peak: number;
  pos: PosGroup;
  dpos?: DetailPos | null;
  roles?: PeakProfile['roles'] | null;
};

/**
 * 그 자리에서의 실력. 최고 시점 능력치가 있으면 그 자리 역할의 실력(최고 OVR을 넘지 않는다) — 발 빠른 센터백은
 * 풀백 자리에서도 잘 뛰고, 슈팅형 스트라이커는 윙어 자리에서 떨어진다. 없으면 최고 OVR × 적합도(반올림).
 */
export const slotRating = (slot: DetailPos, p: SlotPlayer): number =>
  p.roles ? Math.min(p.roles[slot], p.peak) : Math.round(p.peak * fit(slot, p.pos, p.dpos));

/** 그 자리 적합도(보여 주기) — 자리별 실력이 있으면 최고 OVR 대비 비율(소수 둘째 자리), 없으면 적합도 규칙. */
export const slotFit = (slot: DetailPos, p: SlotPlayer, rating = slotRating(slot, p)): number =>
  p.roles && p.peak > 0 ? Math.round((rating / p.peak) * 100) / 100 : fit(slot, p.pos, p.dpos);

/** 팀의 세 줄. */
export const LINES = ['atk', 'mid', 'def'] as const;
export type Line = (typeof LINES)[number];
export type LineStrength = Record<Line, number> & { gk: number };

/**
 * 자리마다 공격·중원·수비에 보태는 몫(합 1, 골키퍼는 골문만). 풀백은 수비 중심에 측면 공격 가담, 수비형
 * 미드필더는 중원과 수비 반반, 윙어는 공격 중심에 중원 가담.
 */
export const SLOT_LINES: Record<Exclude<DetailPos, 'GK'>, Record<Line, number>> = {
  ST: { atk: 0.9, mid: 0.1, def: 0 },
  W: { atk: 0.65, mid: 0.3, def: 0.05 },
  AM: { atk: 0.4, mid: 0.55, def: 0.05 },
  CM: { atk: 0.15, mid: 0.65, def: 0.2 },
  DM: { atk: 0.05, mid: 0.5, def: 0.45 },
  FB: { atk: 0.2, mid: 0.3, def: 0.5 },
  CB: { atk: 0, mid: 0.05, def: 0.95 },
};
/**
 * 줄마다 기준 인원(필드 10명의 몫 합과 같은 10). 한 줄에 몫이 기준보다 많으면 그 줄이 LINE_PRESENCE_K점씩 세지고,
 * 합이 늘 10이라 다른 줄은 그만큼 약해진다 — 포메이션을 바꾸면 공격·중원·수비 무게가 옮겨 간다.
 */
export const LINE_BASE: Record<Line, number> = { atk: 3.25, mid: 2.85, def: 3.9 };
export const LINE_PRESENCE_K = 4;

/**
 * 11자리 실력 → 공격·중원·수비(몫 가중 평균 + 인원 보정)와 골키퍼. 빈 자리는 유스 선수로 센다. synergy를 주면(T-11-105)
 * 자리 실력에 주발 보정을, 줄 힘에 듀오·팀 색깔 보정을 더한다.
 */
export function lineStrength(
  formation: readonly DetailPos[],
  ratings: readonly (number | null)[],
  synergy?: Pick<TeamSynergy, 'foot' | 'lines'> | null,
): LineStrength {
  const sum: Record<Line, number> = { atk: 0, mid: 0, def: 0 };
  const w: Record<Line, number> = { atk: 0, mid: 0, def: 0 };
  let gk = YOUTH_OVR;
  formation.forEach((slot, i) => {
    const r = (ratings[i] ?? YOUTH_OVR) + (synergy?.foot[i] ?? 0);
    if (slot === 'GK') {
      gk = r;
      return;
    }
    for (const l of LINES) {
      const share = SLOT_LINES[slot][l];
      sum[l] += share * r;
      w[l] += share;
    }
  });
  const line = (l: Line) =>
    (w[l] ? sum[l] / w[l] : YOUTH_OVR) + LINE_PRESENCE_K * (w[l] - LINE_BASE[l]);
  const b = synergy?.lines;
  return {
    atk: line('atk') + (b?.atk ?? 0),
    mid: line('mid') + (b?.mid ?? 0),
    def: line('def') + (b?.def ?? 0),
    gk: gk + (b?.gk ?? 0),
  };
}

/** 팀 OVR = 11자리 실력의 평균(반올림). 빈 자리는 유스 선수(YOUTH_OVR)로 센다. */
export function teamOvr(ratings: readonly (number | null)[]): number {
  let sum = 0;
  for (let i = 0; i < LINEUP_SIZE; i++) sum += ratings[i] ?? YOUTH_OVR;
  return Math.round(sum / LINEUP_SIZE);
}

// T-11-028 시즌 업적 점수·등급. 업적은 선수·팀·구단주·감독(감독 시뮬레이션이 열리면 공개) 넷으로 나뉘고, 달성한 업적의
// 점수 합이 그 시즌 구단주 등급이 된다. 시즌마다 처음부터 다시 쌓으므로 등급도 시즌마다 새로 오른다.
export const ACH_CATEGORIES = ['player', 'team', 'owner', 'manager'] as const;
export type AchCategory = (typeof ACH_CATEGORIES)[number];
export const ACH_CATEGORY_NAME: Record<AchCategory, string> = {
  player: '선수 업적',
  team: '팀 업적',
  owner: '구단주 업적',
  manager: '감독 업적',
};

/**
 * 시즌 등급(오름차순 min = 그 등급에 필요한 점수). 프리시즌 구단주 297명의 점수(2026-10-01)로 잡았다 — 중앙값 실버,
 * 상위 25% 골드, 상위 5% 플래티넘, 상위 1% 다이아. 레전드는 팀·구단주 업적까지 시즌 내내 채워야 닿는다.
 */
export const ACH_GRADES = [
  { id: 'rookie', name: '루키', min: 0 },
  { id: 'bronze', name: '브론즈', min: 200 },
  { id: 'silver', name: '실버', min: 500 },
  { id: 'gold', name: '골드', min: 1000 },
  { id: 'platinum', name: '플래티넘', min: 1600 },
  { id: 'diamond', name: '다이아', min: 2400 },
  { id: 'legend', name: '레전드', min: 3500 },
] as const;
export type AchGrade = (typeof ACH_GRADES)[number];

/** 점수의 등급과 다음 등급(맨 위면 null). */
export function achGradeOf(score: number): { grade: AchGrade; next: AchGrade | null } {
  let i = 0;
  while (i + 1 < ACH_GRADES.length && score >= ACH_GRADES[i + 1]!.min) i++;
  return { grade: ACH_GRADES[i]!, next: ACH_GRADES[i + 1] ?? null };
}

/** 업적 랭킹 한 페이지의 구단주 수. */
export const ACH_RANK_PER_PAGE = 20;
