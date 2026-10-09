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

/** 정원이 일찍 차서 일정을 당길 때 추첨까지 남기는 최소 시간(신청한 구단주가 알림을 보고 명단을 챙길 시간). */
export const CUP_EARLY_NOTICE_MS = 12 * 3600_000;

/**
 * 접수 중 정원이 찬 시각(full)에 맞춰 일정을 당긴다. 접수는 그때 닫고, 추첨은 full + 12시간 뒤 처음 오는 원래 추첨
 * 시각(KST 같은 시:분)으로, 경기는 추첨이 당겨진 날수만큼 모두 당긴다(매일 같은 시각은 그대로). 당길 날이 없으면 null.
 */
export function pullCupForward(cup: CupDef, full: string): CupDef | null {
  if (full >= cup.closesAt) return null;
  const DAY = 86400_000;
  const draw = Date.parse(cup.drawAt);
  const earliest = Date.parse(full) + CUP_EARLY_NOTICE_MS;
  const days = Math.floor((draw - earliest) / DAY);
  if (days <= 0) return null;
  const shift = (iso: string) => new Date(Date.parse(iso) - days * DAY).toISOString();
  return { ...cup, closesAt: full, drawAt: shift(cup.drawAt), rounds: cup.rounds.map(shift) };
}

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

/**
 * 소모성 아이템. reroll = 선수 후보 리롤권(새 선수를 만들 때 후보 3명을 다시 뽑는다), boost = 잠재력 강화권(T-11-174,
 * 자금이 모자란 시즌의 강화 한 번을 광고·구단 자금 대신 받는다).
 */
export const OWNER_ITEMS = ['reroll', 'boost'] as const;
export type OwnerItem = (typeof OWNER_ITEMS)[number];

/** T-11-174 소모성 인앱 상품(App Store Connect·Play Console에 같은 ID로 만든다) — 사면 구단주 아이템이 qty만큼 는다. */
export const IAP_PRODUCTS = {
  'com.offsidelab.app.reroll_5': { item: 'reroll', qty: 5 },
  'com.offsidelab.app.reroll_15': { item: 'reroll', qty: 15 },
  'com.offsidelab.app.reroll_40': { item: 'reroll', qty: 40 },
  'com.offsidelab.app.boost_3': { item: 'boost', qty: 3 },
  'com.offsidelab.app.boost_10': { item: 'boost', qty: 10 },
} as const satisfies Record<string, { item: OwnerItem; qty: number }>;
export type IapProductId = keyof typeof IAP_PRODUCTS;
export const IAP_PRODUCT_IDS = Object.keys(IAP_PRODUCTS) as [IapProductId, ...IapProductId[]];

/**
 * T-11-153 광고 대신 구단 자금으로 받는 보상. candidates = 새 선수 후보 3명 잠재력 보기, peek = 이번 시즌 스카우트 평가
 * 보기, boost = 선수 자금이 모자란 시즌의 잠재력 강화 한 번. 서버는 자금만 받고, 보상은 기기의 게임이 준다.
 */
export const REWARD_KINDS = ['candidates', 'peek', 'boost'] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];
/** 구단 자금으로 산 것(owner_item_purchases.item) — 리롤권(T-11-152)과 광고 대신 받은 보상(T-11-153). */
export const FUNDS_ITEMS = ['reroll', ...REWARD_KINDS.map((k) => `reward:${k}` as const)] as const;
export type FundsItem = 'reroll' | `reward:${RewardKind}`;

/**
 * T-11-152 구단 자금으로 사는 리롤권 가격(만 원). bought = 오늘(0시 한국 시각부터) 이미 산 장수.
 * 한 장 더 살 때마다 growth를 곱하고 천만 원 단위로 반올림한다. 하루 상한을 다 썼으면 null.
 * T-11-153 광고 대신 구단 자금으로 받는 보상(REWARD_KINDS)도 같은 규칙으로 값을 매긴다.
 */
export function shopPriceAt(
  rules: { price: number; growth: number; cap: number },
  bought: number,
): number | null {
  if (bought >= rules.cap) return null;
  return Math.round((rules.price * rules.growth ** bought) / 1000) * 1000;
}
