// T-11-128 구단주 티어(지난 시즌) — 그 시즌 결산(owner_season_records)의 순위로 정한다. 프로필 · 댓글 · 채팅에 붙는다.
// zod가 없는 서브패스(`@offside/contracts/owner-tier`)라 웹 · 앱 번들이 그대로 쓴다.
//
// 업적 · 팀 레이팅 · 명예의 전당 순위 가운데 가장 좋은 것으로(순위는 1위, 비율은 순위 ÷ 순위에 든 수):
//   challenger 1위 · grandmaster 10위 안 · master 50위 안 · diamond 상위 5% · emerald 상위 15%
//   platinum 상위 30% · gold 상위 50% · silver 그 밖에 순위가 있다 · bronze 은퇴 선수만 · iron 기록만
// 영구결번 · 명예의 벽 · 서버 최초 기록이 있으면 적어도 platinum.
export const OWNER_TIERS = [
  'challenger',
  'grandmaster',
  'master',
  'diamond',
  'emerald',
  'platinum',
  'gold',
  'silver',
  'bronze',
  'iron',
] as const;
export type OwnerTier = (typeof OWNER_TIERS)[number];

/** 티어를 정하는 시즌 기록(결산 값 그대로). 순위는 null이면 순위 밖, ranked는 그 순위에 든 수. */
export type TierInput = {
  ranks: readonly { rank: number | null; ranked: number }[];
  retired: number;
  /** 영구결번 + 명예의 벽 + 서버 최초 기록. */
  legacy: number;
};

const PERCENT_TIERS: readonly [number, OwnerTier][] = [
  [0.05, 'diamond'],
  [0.15, 'emerald'],
  [0.3, 'platinum'],
  [0.5, 'gold'],
];

const higher = (a: OwnerTier, b: OwnerTier): OwnerTier =>
  OWNER_TIERS.indexOf(a) <= OWNER_TIERS.indexOf(b) ? a : b;

/** 한 시즌 기록으로 티어를 정한다. */
export function ownerTierOf(input: TierInput): OwnerTier {
  let tier: OwnerTier = input.retired > 0 ? 'bronze' : 'iron';
  for (const { rank, ranked } of input.ranks) {
    if (rank === null || ranked <= 0) continue;
    const share = rank / ranked;
    const byRank: OwnerTier =
      rank === 1
        ? 'challenger'
        : rank <= 10
          ? 'grandmaster'
          : rank <= 50
            ? 'master'
            : (PERCENT_TIERS.find(([p]) => share <= p)?.[1] ?? 'silver');
    tier = higher(tier, byRank);
  }
  return input.legacy > 0 ? higher(tier, 'platinum') : tier;
}
