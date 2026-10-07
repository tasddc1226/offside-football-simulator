// T-11-145 오프사이드 컵. 기간 안에 신청한 구단끼리 조별 예선 → 토너먼트를 하루 한 경기씩 서버가 치른다.
// 대회 일정은 코드 상수다(운영 도구는 2회차부터). 시각은 모두 UTC ISO. zod 없는 서브패스(`@offside/contracts/cup`) — API 모양은 cup-api.ts.

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

// 시각은 KST 표기로 적고 UTC로 둔다. 접수 10/9 00:00 ~ 10/12 23:59, 추첨 10/13 12:00, 경기는 매일 21:00.
const kst = (d: string) => new Date(`${d}+09:00`).toISOString();
export const CUPS: readonly CupDef[] = [
  {
    id: 's1-1',
    season: 1,
    edition: 1,
    opensAt: kst('2026-10-09T00:00:00'),
    closesAt: kst('2026-10-13T00:00:00'),
    drawAt: kst('2026-10-13T12:00:00'),
    rounds: [13, 14, 15, 16, 17, 18, 19, 20].map((d) => kst(`2026-10-${d}T21:00:00`)),
    capacity: 64,
    minFilled: 8,
  },
];

export const cupById = (id: string, cups: readonly CupDef[] = CUPS) =>
  cups.find((c) => c.id === id);

/** 지금 보여 줄 대회: 진행 중이거나 다가오는 것, 없으면 가장 최근에 끝난 것. */
export function currentCup(now: string, cups: readonly CupDef[] = CUPS): CupDef | undefined {
  const t = Date.parse(now);
  const live = cups.filter((c) => Date.parse(c.rounds.at(-1)!) + 86400_000 > t);
  return live.sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt))[0] ?? cups.at(-1);
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
