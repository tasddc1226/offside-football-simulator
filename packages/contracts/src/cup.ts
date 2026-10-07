// T-11-145 오프사이드 컵. 기간 안에 신청한 구단끼리 조별 예선 → 토너먼트를 하루 한 경기씩 서버가 치른다.
// 대회 일정은 D1 cups 테이블(관리자 API로 연다), 모양은 planCup이 만든다. 시각은 모두 UTC ISO. zod 없는 서브패스(`@offside/contracts/cup`) — API 모양은 cup-api.ts.

export const CUP_ROUNDS = ['g1', 'g2', 'g3', 'r32', 'r16', 'qf', 'sf', 'f'] as const;
export type CupRound = (typeof CUP_ROUNDS)[number];
export const CUP_GROUP_ROUNDS: readonly CupRound[] = ['g1', 'g2', 'g3'];
export const CUP_KO_ROUNDS: readonly CupRound[] = ['r32', 'r16', 'qf', 'sf', 'f'];

/** 탈락(또는 우승)한 단계. group = 조별 탈락. */
export const CUP_STAGES = ['champion', 'runnerup', 'sf', 'qf', 'r16', 'r32', 'group'] as const;
export type CupStage = (typeof CUP_STAGES)[number];

export interface CupDef {
  id: string;
  /** 서비스 시즌(이 시즌 팀만 참가). */
  season: number;
  /** 회차(제 n회). */
  edition: number;
  opensAt: string;
  closesAt: string;
  drawAt: string;
  /** 라운드별 경기 시각(CUP_ROUNDS 순서). 명단은 CUP_LOCK_MIN분 전에 잠긴다. */
  rounds: readonly string[];
  capacity: number;
  /** 참가 자격: 선발에 든 실제 선수 수. */
  minFilled: number;
}

export const CUP_LOCK_MIN = 60;

/** 표준 일정의 기본값: 접수 4일, 추첨은 접수 마감일 12:00, 경기는 그날부터 매일 21:00(KST). */
export const CUP_PLAN_DEFAULTS = {
  entryDays: 4,
  drawHour: 12,
  matchHour: 21,
  capacity: 64,
  minFilled: 8,
} as const;

export interface CupPlanInput {
  id: string;
  season: number;
  edition: number;
  /** 접수 시작일(KST, YYYY-MM-DD). 그날 00:00에 연다. */
  opensOn: string;
  entryDays?: number | undefined;
  drawHour?: number | undefined;
  matchHour?: number | undefined;
  capacity?: number | undefined;
  minFilled?: number | undefined;
}

/**
 * 시작일 하나로 대회 일정을 만든다. 접수 opensOn 00:00 ~ entryDays일 뒤 00:00, 추첨 그날 drawHour시, 라운드 8개는
 * 그날부터 하루 한 경기 matchHour시. 제1회(s1-1) = 10/9 시작 → 접수 10/9~10/12, 추첨 10/13 12:00, 경기 10/13~10/20 21:00.
 */
export function planCup(input: CupPlanInput): CupDef {
  const v = (k: keyof typeof CUP_PLAN_DEFAULTS) => input[k] ?? CUP_PLAN_DEFAULTS[k];
  const days = v('entryDays');
  const at = (n: number, hour: number) =>
    new Date(
      Date.parse(`${input.opensOn}T00:00:00+09:00`) + (n * 24 + hour) * 3600_000,
    ).toISOString();
  return {
    id: input.id,
    season: input.season,
    edition: input.edition,
    opensAt: at(0, 0),
    closesAt: at(days, 0),
    drawAt: at(days, v('drawHour')),
    rounds: CUP_ROUNDS.map((_, i) => at(days + i, v('matchHour'))),
    capacity: v('capacity'),
    minFilled: v('minFilled'),
  };
}

/** 대회가 끝난 뒤에도 '지난 대회'로 보여 주는 기간(결승 뒤 24시간). 다음 대회 접수는 이 뒤에 연다. */
export const CUP_AFTERGLOW_MS = 86400_000;
export const cupEndsAt = (cup: CupDef) =>
  new Date(Date.parse(cup.rounds.at(-1)!) + CUP_AFTERGLOW_MS).toISOString();

export const cupById = (id: string, cups: readonly CupDef[]) => cups.find((c) => c.id === id);

/** 지금 보여 줄 대회: 진행 중이거나 다가오는 것, 없으면 가장 최근에 끝난 것. */
export function currentCup(now: string, cups: readonly CupDef[]): CupDef | undefined {
  const byOpen = [...cups].sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  return byOpen.find((c) => cupEndsAt(c) > now) ?? byOpen.at(-1);
}

export const roundAt = (cup: CupDef, round: CupRound) => cup.rounds[CUP_ROUNDS.indexOf(round)]!;
export const lockAt = (iso: string) =>
  new Date(Date.parse(iso) - CUP_LOCK_MIN * 60_000).toISOString();

/**
 * 모인 팀 수로 조 수를 정한다. 조마다 2팀이 토너먼트로 가고, 토너먼트는 조 수 × 2강에서 시작한다(32강·16강·8강·4강).
 * 조는 2~4팀. 4팀 미만이면 열지 않는다(0).
 */
export function cupGroupCount(teams: number): number {
  for (const g of [16, 8, 4, 2]) if (teams >= g * 2) return g;
  return 0;
}

/** 토너먼트 첫 라운드(조 수 g → 2g강). */
export const firstKoRound = (groups: number): CupRound =>
  (({ 16: 'r32', 8: 'r16', 4: 'qf', 2: 'sf' }) as Record<number, CupRound>)[groups] ?? 'f';

/** 성적별 보상: 영구 트로피·칭호(우승·준우승·4강)와 선수 후보 리롤권 수. */
export const CUP_REWARDS: Record<CupStage, { rerolls: number; trophy: boolean }> = {
  champion: { rerolls: 10, trophy: true },
  runnerup: { rerolls: 7, trophy: true },
  sf: { rerolls: 5, trophy: true },
  qf: { rerolls: 3, trophy: false },
  r16: { rerolls: 2, trophy: false },
  r32: { rerolls: 1, trophy: false },
  group: { rerolls: 1, trophy: false },
};

/** 승점. */
export const CUP_POINTS = { win: 3, draw: 1, loss: 0 } as const;

/** 소모성 아이템. reroll = 선수 후보 리롤권(새 선수를 만들 때 후보 3명을 다시 뽑는다). */
export const OWNER_ITEMS = ['reroll'] as const;
export type OwnerItem = (typeof OWNER_ITEMS)[number];
