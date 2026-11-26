import {
  XMAS_CLAIM_PREFIX,
  XMAS_EVENT,
  XMAS_SOCK_KEYS,
  XMAS_SOCKS,
  XMAS_TREE_STEPS,
  xmasSockClaimKey,
  xmasTreeClaimKey,
  xmasTreePct,
  type XmasPhase,
  type XmasReward,
  type XmasSockKey,
} from '@offside/contracts/xmas';
import type { XmasEvent } from '@offside/contracts';
import type { Db } from '../client.js';
import { claimSeasonGift } from './iap.js';

// T-11-834 크리스마스 이벤트 판정 · 지급. 큰 표(careers)는 그 구단주의 행만(profile_id로 시작하는 인덱스) 읽고, 트리는
// 은퇴할 때 늘리는 하루 은퇴 수(app_meta `retired:<KST 날짜>`) 7줄을 더한다. 받은 기록은 gift_claims('xmas26:...')가
// 한 번만 받게 막고, 아이템은 홈 선물과 같은 owner_items에 더한다(claimSeasonGift).

const claimsUpper = `${XMAS_CLAIM_PREFIX.slice(0, -1)};`; // ':' 바로 다음 글자 — 'xmas26:'로 시작하는 키의 범위 끝.

/** 트리에 모인 은퇴 수(기간 7일 합). 날짜 키는 PK라 7번의 점 조회다. */
export async function xmasTreeCount(db: Db): Promise<number> {
  const keys = XMAS_EVENT.treeDays.map((d) => `retired:${d}`);
  const row = await db.$client
    .prepare(
      `SELECT COALESCE(SUM(CAST(value AS INTEGER)), 0) AS n FROM app_meta WHERE key IN (${keys.map(() => '?').join(', ')})`,
    )
    .bind(...keys)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

type Mine = {
  claims: Set<string>;
  started: boolean;
  retired: boolean;
  treeMine: number;
  team: boolean;
};

const NOBODY: Mine = {
  claims: new Set(),
  started: false,
  retired: false,
  treeMine: 0,
  team: false,
};

/** 그 프로필의 양말 조건 · 받은 기록 · 트리에 보탠 수. 한 batch(4문장). */
export async function xmasMineOf(db: Db, profileId: string): Promise<Mine> {
  const d1 = db.$client;
  const { startAt, endAt, treeEndAt } = XMAS_EVENT;
  const [claims, started, retired, team] = await d1.batch<Record<string, unknown>>([
    d1
      .prepare(
        `SELECT gift_id AS id FROM gift_claims WHERE profile_id = ? AND gift_id >= ? AND gift_id < ?`,
      )
      .bind(profileId, XMAS_CLAIM_PREFIX, claimsUpper),
    // 커리어 행은 첫 시즌을 올릴 때 생긴다 — 기간 중 생겼으면 기간 중 커리어를 시작해 첫 시즌을 마친 것이다.
    d1
      .prepare(
        `SELECT 1 AS ok FROM careers INDEXED BY careers_owner_title_updated_idx WHERE profile_id = ? AND created_at >= ? AND created_at < ? LIMIT 1`,
      )
      .bind(profileId, startAt, endAt),
    d1
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(retired_at < ?), 0) AS tree FROM careers INDEXED BY careers_owner_title_updated_idx
         WHERE profile_id = ? AND status = 'retired' AND retired_at >= ? AND retired_at < ?`,
      )
      .bind(treeEndAt, profileId, startAt, endAt),
    d1.prepare(`SELECT 1 AS ok FROM owner_teams WHERE profile_id = ? LIMIT 1`).bind(profileId),
  ]);
  const r = retired?.results[0] as { n: number; tree: number } | undefined;
  return {
    claims: new Set((claims?.results ?? []).map((x) => String(x.id))),
    started: !!started?.results.length,
    retired: (r?.n ?? 0) > 0,
    treeMine: r?.tree ?? 0,
    team: !!team?.results.length,
  };
}

const sockDone = (m: Mine, key: XmasSockKey) =>
  key === 'start' ? m.started : key === 'retire' ? m.retired : m.team;

/** 화면에 주는 이벤트 상태. profileId가 없으면(세션 없음) 내 양말은 모두 빈 칸이다. */
export function xmasView(
  phase: XmasPhase,
  count: number,
  mine: Mine | null,
  owner: boolean,
  counting: boolean,
): XmasEvent {
  const m = mine ?? NOBODY;
  const pct = xmasTreePct(count);
  return {
    phase,
    startAt: XMAS_EVENT.startAt,
    treeEndAt: XMAS_EVENT.treeEndAt,
    endAt: XMAS_EVENT.endAt,
    owner,
    socks: XMAS_SOCK_KEYS.map((key) => ({
      key,
      reward: { ...XMAS_SOCKS[key] },
      done: sockDone(m, key),
      claimed: m.claims.has(xmasSockClaimKey(key)),
    })),
    tree: {
      count,
      goal: XMAS_EVENT.treeGoal,
      mine: m.treeMine,
      counting,
      steps: XMAS_TREE_STEPS.map((s, i) => ({
        pct: s.pct,
        reward: { ...s.reward },
        reached: pct >= s.pct,
        claimed: m.claims.has(xmasTreeClaimKey(i + 1)),
      })),
    },
    title: m.claims.has(xmasSockClaimKey('team')),
  };
}

export type XmasTarget = { kind: 'sock'; key: XmasSockKey } | { kind: 'tree'; step: number };

export function parseXmasTarget(raw: string): XmasTarget {
  if (raw.startsWith('sock:')) return { kind: 'sock', key: raw.slice(5) as XmasSockKey };
  return { kind: 'tree', step: Number(raw.slice(5)) };
}

export const xmasRewardOf = (t: XmasTarget): XmasReward =>
  t.kind === 'sock' ? XMAS_SOCKS[t.key] : XMAS_TREE_STEPS[t.step - 1]!.reward;

/** 받을 수 있는가(조건을 채웠는가). 받은 기록은 claim이 막는다. */
export const xmasEligible = (t: XmasTarget, m: Mine, count: number) =>
  t.kind === 'sock' ? sockDone(m, t.key) : xmasTreePct(count) >= XMAS_TREE_STEPS[t.step - 1]!.pct;

export const xmasClaimKeyOf = (t: XmasTarget) =>
  t.kind === 'sock' ? xmasSockClaimKey(t.key) : xmasTreeClaimKey(t.step);

/** 지급. 이미 받았으면 false(gift_claims PK가 막는다). */
export async function claimXmas(db: Db, profileId: string, t: XmasTarget, now: string) {
  const r = xmasRewardOf(t);
  const items = await claimSeasonGift(
    db,
    profileId,
    xmasClaimKeyOf(t),
    { boost: r.boost ?? 0, scout: r.scout ?? 0, reroll: r.reroll ?? 0 },
    now,
  );
  return items !== null;
}

/** 한정 칭호(큰 양말을 받았다)를 가졌는가 — 명예관 · 대표 칭호가 쓴다. PK 한 번. */
export async function hasXmasTitle(db: Db, profileId: string): Promise<boolean> {
  const row = await db.$client
    .prepare(`SELECT 1 AS ok FROM gift_claims WHERE profile_id = ? AND gift_id = ?`)
    .bind(profileId, xmasSockClaimKey('team'))
    .first();
  return !!row;
}
