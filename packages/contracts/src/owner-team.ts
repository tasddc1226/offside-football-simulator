/**
 * T-10-092 구단주 팀(팀 슬롯). zod가 없는 서브패스(`@offside/contracts/owner-team`)라 웹이 값으로 가져와도
 * 번들에 zod가 들어가지 않는다 — 서버의 팀 OVR·경기 시뮬레이션과 웹의 편성 미리보기가 같은 규칙을 쓴다.
 *
 * 팀은 구글 로그인한 구단주만 시즌마다 한 팀씩 만든다(원작처럼 시즌마다 새 팀). 선수는 그 구단주의 은퇴한 커리어 중
 * 그 시즌에 처음 올라온 선수만 넣고, 빈 자리는 유스 선수(고정 OVR)가 채운다 — 은퇴 선수가 11명이 안 되는 구단주도
 * 한 명만 넣으면 경기할 수 있다.
 */

import {
  BASE_DETAIL,
  expandDetailRoles,
  DETAIL_GROUP,
  type DetailPos,
  type PeakProfile,
  type PosGroup,
} from './positions.js';
import type { TeamSynergy } from './team-synergy.js';

export * from './team-synergy.js';
export * from './match-report.js';

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
/** T-11-269 시즌 통계에 세는 최근 랭크 경기 상한(건 경기 · 받은 경기 각각). */
export const TEAM_STATS_MATCHES_MAX = 2000;

// T-11-171 친구 초대 이벤트. 아직 은퇴 선수가 없는 구단주가 친구 코드(초대 링크)로 친구 신청을 하면 초대로 기록하고, 그
// 구단주가 선수 커리어를 은퇴까지 마치면 두 사람 모두 리롤권과 프리미엄 스카우트권을 받는다(초대한 쪽은 INVITE_REWARD_MAX명까지).
/** 초대가 성공하면 두 사람이 각각 받는 리롤권 장수(T-11-244 2 → 3). */
export const INVITE_REROLLS = 3;
/** T-11-244 초대가 성공하면 두 사람이 각각 받는 프리미엄 스카우트권 장수. */
export const INVITE_SCOUTS = 1;
/** 초대한 사람이 리롤권을 받는 성공 초대 수 상한(그 뒤 성공은 초대받은 사람만 받는다). */
export const INVITE_REWARD_MAX = 10;
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
        y: { GK: 91, FB: 75, CB: 75, DM: 62, CM: 49, AM: 37, W: 25, ST: 16 }[BASE_DETAIL[slot]],
        slot,
      };
    }),
  );
}

/** 옮긴 필드 위치를 경기 포지션으로 해석한다. 골키퍼는 첫 자리 하나로 유지한다. */
export function legacyPositionRole(x: number, y: number, index: number): DetailPos {
  if (index === 0) return 'GK';
  const wide = x < 28 || x > 72;
  if (y < 28) return wide ? 'W' : 'ST';
  if (y < 43) return 'AM';
  if (y < 56) return 'CM';
  if (y < 67) return 'DM';
  return wide ? 'FB' : 'CB';
}

/** Coordinate roles for new edits. Existing saved layouts retain their recorded slots until saved. */
export function positionRole(x: number, y: number, index: number): DetailPos {
  if (index === 0) return 'GK';
  // Keep the preset midfield at x=25/75 central; side lanes sit at x=18/82.
  const wide = y < 28 || y >= 67 ? x < 28 || x > 72 : x < 24 || x > 76;
  if (wide) {
    if (y < 43) return x < 50 ? 'LW' : 'RW';
    if (y < 56) return x < 50 ? 'LM' : 'RM';
    if (y < 67) return x < 50 ? 'LWB' : 'RWB';
    return x < 50 ? 'LB' : 'RB';
  }
  if (y < 20) return 'ST';
  if (y < 28) return 'CF';
  if (y < 34) return 'SS';
  if (y < 43) return 'AM';
  if (y < 56) return 'CM';
  if (y < 67) return 'DM';
  return y >= 79 ? 'SW' : 'CB';
}
export const positionedLayout = (layout: TeamLayout): TeamPosition[] =>
  layout.map((p, i) => ({ ...p, slot: positionRole(p.x, p.y, i) }));

/**
 * T-11-216 시즌 1 배치 프리셋. 저장 · 응답의 formation은 옛 앱도 아는 세 값(base)으로 두고, 모양은 자유 배치(layout)로
 * 저장한다 — 자리마다의 포지션은 positionRole로 정해져 손으로 끌어 놓은 배치와 같다(경기 규칙은 그대로). 배치가 프리셋과
 * 꼭 같으면 shapeOf가 그 이름을 돌려준다.
 */
/** T-11-217 팀 프리셋 수 · 이름 길이 상한. */
export const TEAM_PRESET_MAX = 5;
export const TEAM_PRESET_NAME_MAX = 12;

type ShapePoint = readonly [x: number, y: number];
// 카드가 덜 겹치게 줄 사이를 넓히고, 위아래로 가까운 자리는 옆으로 비켜 둔다. 첫 점은 골키퍼.
const GK: ShapePoint = [50, 91];
const BACK4: readonly ShapePoint[] = [
  [15, 74],
  [37, 77],
  [63, 77],
  [85, 74],
];
const SHAPES = {
  '4-2-3-1': {
    base: '4-3-3',
    points: [GK, ...BACK4, [36, 57], [64, 57], [16, 38], [50, 40], [84, 38], [50, 17]],
  },
  '4-1-4-1': {
    base: '4-3-3',
    points: [GK, ...BACK4, [50, 59], [15, 46], [35, 44], [65, 44], [85, 46], [50, 18]],
  },
  '4-3-3 F9': {
    base: '4-3-3',
    points: [GK, ...BACK4, [30, 47], [50, 59], [70, 47], [16, 26], [50, 24], [84, 26]],
  },
  '4-4-1-1': {
    base: '4-4-2',
    points: [GK, ...BACK4, [15, 50], [37, 52], [63, 52], [85, 50], [50, 32], [50, 13]],
  },
  '3-4-3': {
    base: '3-5-2',
    points: [
      GK,
      [30, 75],
      [50, 77],
      [70, 75],
      [13, 60],
      [38, 52],
      [62, 52],
      [87, 60],
      [16, 26],
      [50, 16],
      [84, 26],
    ],
  },
  '5-3-2': {
    base: '3-5-2',
    points: [
      [50, 93],
      [12, 62],
      [30, 73],
      [50, 80],
      [70, 73],
      [88, 62],
      [28, 46],
      [50, 52],
      [72, 46],
      [38, 18],
      [62, 18],
    ],
  },
} as const satisfies Record<string, { base: FormationId; points: readonly ShapePoint[] }>;
export type ShapeId = keyof typeof SHAPES;
export const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[];
/** 프리셋이 저장할 formation(옛 앱이 아는 값). */
export const shapeBase = (id: ShapeId): FormationId => SHAPES[id].base;
/** 프리셋 배치(골키퍼 + 필드 10명). */
export const shapeLayout = (id: ShapeId): TeamPosition[] =>
  SHAPES[id].points.map(([x, y], i) => ({
    x,
    y,
    slot: positionRole(x, y, i),
  }));
/** 배치가 프리셋과 꼭 같으면 그 이름, 아니면 저장된 formation(옮긴 배치 · 기본 포메이션). */
/** 배치가 정확히 맞는 프리셋. 손으로 옮겼으면 null. */
export function matchShape(layout: TeamLayout | null | undefined): ShapeId | null {
  if (!layout) return null;
  return (
    SHAPE_IDS.find((k) =>
      shapeLayout(k).every((p, i) => p.x === layout[i]?.x && p.y === layout[i]?.y),
    ) ?? null
  );
}

export function shapeOf(formation: FormationId, layout: TeamLayout | null | undefined): string {
  return matchShape(layout) ?? formation;
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
    return BASE_DETAIL[dpos] === BASE_DETAIL[slot] ? 1 : 0.9;
  }
  return group === 'GK' || pos === 'GK' ? 0.3 : 0.75;
}

/** 자리 실력을 정하는 선수 정보. roles가 있으면(최고 시점 능력치) 그 자리 역할의 실력을 그대로 쓴다. */
export type SlotPlayer = {
  peak: number;
  pos: PosGroup;
  dpos?: DetailPos | null;
  roles?: PeakProfile['roles'] | null;
  /** 유형 id(T-11-237 타겟맨 스트라이커 자리 보정). 구버전 응답에는 없다. */
  type?: string | null | undefined;
};

/**
 * T-11-197 자리 실력이 최고 OVR(주 포지션 실력)을 넘을 수 있는 폭. 주 포지션보다 다른 자리가 더 맞는 선수(예: 수미가
 * 더 높은 박스 투 박스)가 손해를 보지 않게 하되, 풀백이 센터백 자리에서 센터백보다 크게 앞서지 않게 묶는다. 서버도
 * 은퇴 기록의 자리별 실력을 이 폭까지만 받는다(apps/api plausibility boundProfile).
 */
export const SLOT_OVER_PEAK = 2;

/**
 * 그 자리에서의 실력. 최고 시점 능력치가 있으면 그 자리 역할의 실력(최고 OVR + SLOT_OVER_PEAK까지) — 발 빠른 센터백은
 * 풀백 자리에서도 잘 뛰고, 슈팅형 스트라이커는 윙어 자리에서 떨어진다. 없으면 최고 OVR × 적합도(반올림).
 */
export const slotRating = (slot: DetailPos, p: SlotPlayer): number => {
  if (!p.roles) return Math.round(p.peak * fit(slot, p.pos, p.dpos));
  const role = p.roles[slot] ?? p.roles[BASE_DETAIL[slot]];
  // T-11-237 타겟맨 유형은 최고 OVR을 스트라이커·타겟맨 역할 중 높은 쪽으로 잰다(T-11-229). 자리별 실력의 ST는 스트라이커
  // 역할로만 저장돼 헤딩·몸싸움으로 키운 타겟맨이 스트라이커 자리에서도 최고 OVR보다 낮게 뛰었다 — 스트라이커 자리는 최고 OVR 아래로 내리지 않는다.
  const own =
    p.type === 'target' && BASE_DETAIL[slot] === 'ST'
      ? Math.max(role, p.peak)
      : // T-11-383 윙어 유형은 좌·우 미드필더 자리에서 중앙 미드필더 · 윙어 역할 중 높은 쪽으로 뛴다. 선수 커리어 OVR(T-11-236
        // wingerRole)과 같은 규칙인데 팀 자리만 중앙 미드필더 역할로 재서 측면 미드필더 윙어가 제자리에서 크게 떨어졌다.
        p.type === 'winger' && (slot === 'LM' || slot === 'RM')
        ? Math.max(role, p.roles.W)
        : role;
  return Math.min(own, p.peak + SLOT_OVER_PEAK);
};

/** 그 자리 적합도(보여 주기) — 자리별 실력이 있으면 최고 OVR 대비 비율(소수 둘째 자리, 주 포지션보다 맞으면 1을 넘는다), 없으면 적합도 규칙. */
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
export const SLOT_LINES: Record<Exclude<DetailPos, 'GK'>, Record<Line, number>> = expandDetailRoles(
  {
    GK: { atk: 0, mid: 0, def: 0 },
    ST: { atk: 0.9, mid: 0.1, def: 0 },
    W: { atk: 0.65, mid: 0.3, def: 0.05 },
    AM: { atk: 0.4, mid: 0.55, def: 0.05 },
    CM: { atk: 0.15, mid: 0.65, def: 0.2 },
    DM: { atk: 0.05, mid: 0.5, def: 0.45 },
    FB: { atk: 0.2, mid: 0.3, def: 0.5 },
    CB: { atk: 0, mid: 0.05, def: 0.95 },
  },
);
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

/**
 * T-11-357 업적 달성 보상(아이템만 · 확률·가격은 그대로). 업적(단계 업적은 단계마다)의 점수로 난이도를 나눈다 —
 * 80점 미만은 없음, 80~249점은 잠재력 강화권 1장, 250점 이상은 프리미엄 스카우트권 1장. 시즌마다 업적이 처음부터 다시
 * 쌓이므로 보상도 시즌마다 업적·단계당 한 번이다(서버 gift_claims 'ach:<시즌>:<업적>[:<단계>]'). 시즌 1 운영 표본
 * (구단주 600명)에서 강화권 중앙값 3장 · 상위 10% 10장, 스카우트권은 2%만 받도록 맞췄다.
 */
export const ACH_REWARD_BOOST_MIN = 80;
export const ACH_REWARD_SCOUT_MIN = 250;
/** 한 시즌에 업적으로 받는 보상의 상한. 넘는 달성은 점수만 오른다. */
export const ACH_REWARD_SEASON_CAP = { boost: 10, scout: 3 } as const;
export type AchReward = { boost: number; scout: number };
/** 한 업적(단계)의 점수로 정하는 보상. 없으면 null. */
export function achRewardOf(points: number): AchReward | null {
  if (points >= ACH_REWARD_SCOUT_MIN) return { boost: 0, scout: 1 };
  if (points >= ACH_REWARD_BOOST_MIN) return { boost: 1, scout: 0 };
  return null;
}
/**
 * 업적 보상을 처음 주는 시즌. 시즌 중에는 경제를 바꾸지 않으므로 그 앞 시즌(시즌 1)에는 주지도 표시하지도 않는다 — 개막
 * 전에 배포해도 시즌 1 달성에는 주지 않고, 시즌 2는 첫 달성부터(개막 뒤 배포면 그 사이 달성도 다음에 셀 때) 준다.
 */
export const ACH_REWARD_FIRST_SEASON = 2;
/**
 * T-11-386 시즌 1 업적 보상 — 시즌 1에 달성한 업적을 시즌 2 보상 표(achRewardOf · 시즌 상한)로 세어 시즌 2 동안 홈 선물
 * 카드의 받기 버튼으로 한 번 준다. 시즌 1 기록은 마감 뒤 바뀌지 않아 처음 셀 때 장수를 적어 두고 그 값으로 준다.
 */
export const ACH_SEASON_GIFT = {
  id: 'ach-season-1',
  season: ACH_REWARD_FIRST_SEASON - 1,
  openSeason: ACH_REWARD_FIRST_SEASON,
} as const;

/** 업적 랭킹 한 페이지의 구단주 수. */
export const ACH_RANK_PER_PAGE = 20;
