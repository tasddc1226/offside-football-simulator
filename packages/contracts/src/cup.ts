// T-11-145 오프사이드 컵. 기간 안에 신청한 구단끼리 조별 예선 → 토너먼트를 하루 한 경기씩 서버가 치른다.
// 대회 일정은 D1 cups 테이블(관리자 API로 연다), 모양은 planCup이 만든다. 시각은 모두 UTC ISO. zod 없는 서브패스(`@offside/contracts/cup`) — API 모양은 cup-api.ts.

// T-11-246 128팀 대회는 64강(r64)부터 토너먼트를 한다. 64팀 이하 대회(제1회)는 r64 없이 8라운드다(cupRoundsOf).
export const CUP_ROUNDS = ['g1', 'g2', 'g3', 'r64', 'r32', 'r16', 'qf', 'sf', 'f'] as const;
export type CupRound = (typeof CUP_ROUNDS)[number];
export const CUP_GROUP_ROUNDS: readonly CupRound[] = ['g1', 'g2', 'g3'];
export const CUP_KO_ROUNDS: readonly CupRound[] = ['r64', 'r32', 'r16', 'qf', 'sf', 'f'];
const ROUNDS_64: readonly CupRound[] = CUP_ROUNDS.filter((r) => r !== 'r64');

/** 정원에 맞는 라운드(일정 rounds 배열 순서). 64팀 이하는 32강부터, 그보다 많으면 64강부터. */
export const cupRoundsFor = (capacity: number): readonly CupRound[] =>
  capacity > 64 ? CUP_ROUNDS : ROUNDS_64;
/** 그 대회의 라운드(rounds 배열 길이로 안다 — 저장된 제1회 일정은 8개). */
export const cupRoundsOf = (cup: { rounds: readonly unknown[] }): readonly CupRound[] =>
  cup.rounds.length === CUP_ROUNDS.length ? CUP_ROUNDS : ROUNDS_64;

/** 탈락(또는 우승)한 단계. group = 조별 탈락. */
export const CUP_STAGES = [
  'champion',
  'runnerup',
  'sf',
  'qf',
  'r16',
  'r32',
  'r64',
  'group',
] as const;
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

/** 표준 일정의 기본값: 접수 4일, 추첨은 접수 마감일 12:00, 경기는 그날부터 매일 21:00(KST). T-11-246 정원 128. */
export const CUP_PLAN_DEFAULTS = {
  entryDays: 4,
  drawHour: 12,
  matchHour: 21,
  capacity: 128,
  minFilled: 8,
} as const;
/** 정원 상한(32개 조 × 4팀). */
export const CUP_CAPACITY_MAX = 128;

export interface CupPlanInput {
  id: string;
  season: number;
  edition: number;
  /** 접수 시작일(KST, YYYY-MM-DD). 그날 00:00에 연다. */
  opensOn: string;
  /** T-11-246 접수 시작 시각(KST HH:MM). 앞 대회 결승 직후에 열 때 쓴다. 마감·추첨·경기 날짜는 opensOn 기준 그대로. */
  opensTime?: string | undefined;
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
  const [oh, om] = (input.opensTime ?? '00:00').split(':').map(Number) as [number, number];
  const at = (n: number, hour: number) =>
    new Date(
      Date.parse(`${input.opensOn}T00:00:00+09:00`) + (n * 24 + hour) * 3600_000,
    ).toISOString();
  return {
    id: input.id,
    season: input.season,
    edition: input.edition,
    opensAt: at(0, oh + om / 60),
    closesAt: at(days, 0),
    drawAt: at(days, v('drawHour')),
    rounds: cupRoundsFor(v('capacity')).map((_, i) => at(days + i, v('matchHour'))),
    capacity: v('capacity'),
    minFilled: v('minFilled'),
  };
}

/**
 * 대회가 끝난 뒤에도 '지난 대회'로 보여 주는 기간(결승 뒤 24시간). T-11-246 다음 대회 접수는 결승 시각 뒤면 열 수 있고,
 * 다음 대회가 열리면 그쪽을 먼저 보여 준다(currentCup).
 */
export const CUP_AFTERGLOW_MS = 86400_000;
/** 끝난 대회를 홈(배너·우승 팝업)에 우승 소식으로 남기는 기간(결승 뒤 일주일). */
export const CUP_HOME_AFTER_MS = 7 * 86400_000;
export const cupFinalAt = (cup: CupDef) => cup.rounds.at(-1)!;
export const cupEndsAt = (cup: CupDef) =>
  new Date(Date.parse(cupFinalAt(cup)) + CUP_AFTERGLOW_MS).toISOString();

/**
 * T-11-251 결승이 끝나면 서버가 다음 대회를 스스로 연다. 접수는 결승 CUP_NEXT_GAP_MS 뒤, 접수 기간·정원·최소 인원은
 * 앞 대회와 같은 규칙(제2회: KST 21:10 접수, 사흘째 자정 마감, 128팀). 시즌이 맞지 않으면 api가 다음 시즌 개막으로 미룬다.
 */
export const CUP_NEXT_GAP_MS = 10 * 60_000;
export const CUP_NEXT_ENTRY_DAYS = 3;

const kstParts = (iso: string) => {
  const d = new Date(Date.parse(iso) + 9 * 3600_000).toISOString();
  return { day: d.slice(0, 10), time: d.slice(11, 16) };
};

/** 앞 대회 다음 회차 일정(id·season은 api가 채운다). opensAt을 주면 그 시각(KST 분 단위)에 접수를 연다. */
export function planNextCup(prev: CupDef, opensAt = cupFinalAt(prev)): CupDef {
  const at =
    opensAt === cupFinalAt(prev)
      ? new Date(Date.parse(opensAt) + CUP_NEXT_GAP_MS).toISOString()
      : opensAt;
  const { day, time } = kstParts(at);
  return planCup({
    id: '',
    season: 0,
    edition: prev.edition + 1,
    opensOn: day,
    opensTime: time,
    entryDays: CUP_NEXT_ENTRY_DAYS,
    capacity: prev.capacity,
    minFilled: prev.minFilled,
  });
}

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

/**
 * 지금 보여 줄 대회: 진행 중이거나 다가오는 것, 없으면 가장 최근에 끝난 것. 지난 대회를 보여 주는 동안 다음 대회
 * 접수가 열렸으면 다음 대회를 보여 준다.
 */
export function currentCup(now: string, cups: readonly CupDef[]): CupDef | undefined {
  const byOpen = [...cups].sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  const live = byOpen.filter((c) => cupEndsAt(c) > now);
  return live.findLast((c) => c.opensAt <= now) ?? live[0] ?? byOpen.at(-1);
}

/** 그 라운드 경기 시각. 대회에 없는 라운드(64팀 대회의 r64)면 undefined. */
export const roundAt = (cup: CupDef, round: CupRound) =>
  cup.rounds[cupRoundsOf(cup).indexOf(round)]!;
export const lockAt = (iso: string) =>
  new Date(Date.parse(iso) - CUP_LOCK_MIN * 60_000).toISOString();

/**
 * 모인 팀 수로 조 수를 정한다. 조마다 2팀이 토너먼트로 가고, 토너먼트는 조 수 × 2강에서 시작한다(64강·32강·16강·8강·4강).
 * 조는 2~4팀. 4팀 미만이면 열지 않는다(0). 64강은 64강 일정이 있는 대회(정원 128)만 연다.
 */
export function cupGroupCount(teams: number, capacity = CUP_CAPACITY_MAX): number {
  for (const g of [32, 16, 8, 4, 2]) if (teams >= g * 2 && g * 4 <= Math.max(capacity, 8)) return g;
  return 0;
}

/** 토너먼트 첫 라운드(조 수 g → 2g강). */
export const firstKoRound = (groups: number): CupRound =>
  (({ 32: 'r64', 16: 'r32', 8: 'r16', 4: 'qf', 2: 'sf' }) as Record<number, CupRound>)[groups] ??
  'f';

/** 성적별 보상: 영구 트로피·칭호(우승·준우승·4강)와 선수 후보 리롤권 수. */
export const CUP_REWARDS: Record<CupStage, { rerolls: number; trophy: boolean }> = {
  champion: { rerolls: 10, trophy: true },
  runnerup: { rerolls: 7, trophy: true },
  sf: { rerolls: 5, trophy: true },
  qf: { rerolls: 3, trophy: false },
  r16: { rerolls: 2, trophy: false },
  r32: { rerolls: 1, trophy: false },
  r64: { rerolls: 1, trophy: false },
  group: { rerolls: 1, trophy: false },
};

/**
 * T-11-249 제2회(128팀)부터의 성적별 보상. 7연승(조별 3 + 64강~결승 6)이 필요해 상위 보상을 키우고, 8강까지 프리미엄
 * 스카우트권(T-11-244는 4강 이상), 4강 이상은 잠재력 강화권도 준다. 제1회는 CUP_REWARDS(리롤권만) 그대로다.
 */
export const CUP_REWARDS_V2: Record<CupStage, { rerolls: number; scouts: number; boosts: number }> =
  {
    champion: { rerolls: 15, scouts: 3, boosts: 3 },
    runnerup: { rerolls: 10, scouts: 2, boosts: 2 },
    sf: { rerolls: 7, scouts: 1, boosts: 1 },
    qf: { rerolls: 5, scouts: 1, boosts: 0 },
    r16: { rerolls: 3, scouts: 0, boosts: 0 },
    r32: { rerolls: 2, scouts: 0, boosts: 0 },
    r64: { rerolls: 1, scouts: 0, boosts: 0 },
    group: { rerolls: 1, scouts: 0, boosts: 0 },
  };
export const CUP_REWARDS_V2_FROM = 2;

export interface CupReward {
  rerolls: number;
  scouts: number;
  boosts: number;
  trophy: boolean;
}
/** 그 회차·단계의 보상(리롤권·프리미엄 스카우트권·잠재력 강화권·트로피). */
export function cupReward(edition: number, stage: CupStage): CupReward {
  const { trophy, rerolls } = CUP_REWARDS[stage];
  return edition >= CUP_REWARDS_V2_FROM
    ? { ...CUP_REWARDS_V2[stage], trophy }
    : { rerolls, scouts: 0, boosts: 0, trophy };
}
export const cupScouts = (edition: number, stage: CupStage) => cupReward(edition, stage).scouts;

/** T-11-249 승부예측 보상(맞힌 경기마다 리롤권 1장)의 한 대회 상한. 제2회부터(제1회는 상한 없음 = null). */
export const CUP_PREDICTION_CAP = 10;
export const cupPredictionCap = (edition: number): number | null =>
  edition >= CUP_REWARDS_V2_FROM ? CUP_PREDICTION_CAP : null;

/** 승점. */
export const CUP_POINTS = { win: 3, draw: 1, loss: 0 } as const;

/**
 * 소모성 아이템. reroll = 선수 후보 리롤권(새 선수를 만들 때 후보 3명을 다시 뽑는다), boost = 잠재력 강화권(T-11-174,
 * 자금이 모자란 시즌의 강화 한 번을 광고·구단 자금 대신 받는다).
 */
export const OWNER_ITEMS = ['reroll', 'boost', 'scout'] as const;
export type OwnerItem = (typeof OWNER_ITEMS)[number];

/**
 * T-11-244 프리미엄 스카우트 천장. S 후보 없이 SCOUT_PITY_SURE - 1장을 쓰면 SCOUT_PITY_SURE장째는 S 확정(sure),
 * 누적 SCOUT_PITY_ELITE장째마다 잠재력 최고치(96) S 확정(elite). 서버가 장수를 세고 이번 장의 모드를 정한다.
 * used = 누적 사용, streak = 마지막 S 뒤 S 없이 쓴 장수, elites = 지금까지 받은 특급 S 수.
 */
export const SCOUT_PITY_SURE = 30;
export const SCOUT_PITY_ELITE = 100;
export const SCOUT_MODES = ['normal', 'sure', 'elite'] as const;
export type ScoutMode = (typeof SCOUT_MODES)[number];
export type ScoutPity = { used: number; streak: number; elites: number };

/** 다음 한 장의 모드와 남은 장수(이번 장 포함 — 1이면 다음 장이 확정). 서버 SQL(spendScout)과 같은 규칙이다. */
export function scoutPityView(p: ScoutPity) {
  const eliteDue = Math.floor((p.used + 1) / SCOUT_PITY_ELITE) > p.elites;
  const sureDue = p.streak >= SCOUT_PITY_SURE - 1;
  return {
    next: (eliteDue ? 'elite' : sureDue ? 'sure' : 'normal') as ScoutMode,
    sureIn: Math.max(1, SCOUT_PITY_SURE - p.streak),
    eliteIn: Math.max(1, (p.elites + 1) * SCOUT_PITY_ELITE - p.used),
  };
}

/**
 * T-11-248 리롤권 마일리지. 서버가 차감한 리롤권(구매 · 구단 자금 · 보상으로 받은 것 모두)을 REROLL_MILEAGE장 쓸 때마다
 * 프리미엄 스카우트권 1장을 준다. 광고로 다시 뽑기는 기기에서만 세므로 들어가지 않는다. progress = 마지막 지급 뒤 쓴 장수.
 */
export const REROLL_MILEAGE = 30;
/** 스카우트권까지 남은 리롤권 장수(이번 장 포함 — 1이면 다음 장에서 받는다). 서버 SQL(spendItem)과 같은 규칙이다. */
export const rerollMileageLeft = (progress: number) => Math.max(1, REROLL_MILEAGE - progress);

/** T-11-244 영구결번을 처음 받은 커리어의 구단주가 받는 프리미엄 스카우트권. */
export const RETIRED_NUMBER_SCOUTS = 1;

/**
 * T-11-275 홈 선물 — 로그인한 구단주가 한 번만 받는 아이템 묶음. id를 바꾸면 새 선물이 된다(받은 기록은 id별로 남는다).
 * 받은 아이템은 다른 경로로 받은 것과 같은 owner_items에 들어가서 스카우트 천장 · 리롤권 마일리지도 똑같이 센다.
 */
export const HOME_GIFT = { id: 'gift-2026-10', boost: 20, scout: 5 } as const;

/** T-11-174 소모성 인앱 상품(App Store Connect·Play Console에 같은 ID로 만든다) — 사면 구단주 아이템이 qty만큼 는다. */
export const REMOVE_ADS_PRODUCT_ID = 'com.offsidelab.app.remove_ads';
export const IAP_PRODUCTS = {
  'com.offsidelab.app.reroll_5': { item: 'reroll', qty: 5 },
  'com.offsidelab.app.reroll_15': { item: 'reroll', qty: 15 },
  'com.offsidelab.app.reroll_40': { item: 'reroll', qty: 40 },
  'com.offsidelab.app.boost_3': { item: 'boost', qty: 3 },
  'com.offsidelab.app.boost_10': { item: 'boost', qty: 10 },
  // T-11-196 프리미엄 스카우트권(후보 3명 중 1명 A 이상 보장 · S 확률 2배 · 잠재력 공개).
  'com.offsidelab.app.scout_1': { item: 'scout', qty: 1 },
  'com.offsidelab.app.scout_5': { item: 'scout', qty: 5 },
} as const satisfies Record<string, { item: OwnerItem; qty: number }>;
export type IapProductId = keyof typeof IAP_PRODUCTS;
export const IAP_PRODUCT_IDS = Object.keys(IAP_PRODUCTS) as [IapProductId, ...IapProductId[]];

/**
 * T-11-153 광고 대신 구단 자금으로 받는 보상. candidates = 새 선수 후보 3명 잠재력 보기, peek = 이번 시즌 스카우트 평가
 * 보기, boost = 선수 자금이 모자란 시즌의 잠재력 강화 한 번. 서버는 자금만 받고, 보상은 기기의 게임이 준다.
 */
export const REWARD_KINDS = ['candidates', 'peek', 'boost'] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];
/**
 * T-11-173 잠재력 강화(boost)는 구단 자금으로도 하루 횟수를 두지 않는다(값은 그대로 오른다). 응답의 cap은 옛 앱 빌드(1.1.1 빌드
 * 14가 cap에서 오늘 산 횟수와 광고 횟수를 빼 버튼을 닫는다)가 막지 않게 넉넉한 값으로 보낸다.
 */
export const REWARD_UNCAPPED = 999;
/** 구단 자금으로 산 것(owner_item_purchases.item) — 리롤권(T-11-152)과 광고 대신 받은 보상(T-11-153). */
export const FUNDS_ITEMS = [
  'reroll',
  'scout',
  ...REWARD_KINDS.map((k) => `reward:${k}` as const),
] as const;
export type FundsItem = 'reroll' | 'scout' | `reward:${RewardKind}`;

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
