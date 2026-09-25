// ───────── 팬 반응 피드 선택 로직 (T-10-002) ─────────
// 결정적 해시로만 줄을 고른다 — game/rng.ts의 시드 RNG를 전혀 호출하지 않는다(메인 시뮬레이션
// RNG 소비 순서에 영향 없음). 같은 커리어의 같은 시즌은 항상 같은 팬 반응을 보여준다.
import { FAN_LINES, type FanBucket } from './fanfeed-data.js';
import type { CareerRecord, GameState } from './types.js';
import { hashStr } from './rng.js';

function pickLine(seed: string, bucket: FanBucket): string {
  const lines = FAN_LINES[bucket];
  const idx = hashStr(seed + '/' + bucket) % lines.length;
  return lines[idx]!;
}

export interface FanFeedContext {
  gotTrophy: boolean;
  injuredThisSeason: boolean;
  transferredThisSeason: boolean;
  hasMilestone: boolean;
}

function applicableBuckets(s: GameState, rec: CareerRecord, ctx: FanFeedContext): FanBucket[] {
  const out: FanBucket[] = [];
  if (rec.rating >= 7.4) out.push('rating_high');
  else if (rec.rating > 0 && rec.rating < 6.5) out.push('rating_low');
  if (s.pos === 'GK' || s.pos === 'DF') {
    if (rec.cs >= 8) out.push('cs_high');
    if (rec.assists >= 5) out.push('assists_high');
  } else {
    if (rec.goals >= 10) out.push('goals_high');
    if (rec.assists >= 8) out.push('assists_high');
  }
  const rank = typeof rec.rank === 'number' ? rec.rank : null;
  if (rank === 1) out.push('rank_champion');
  else if (rank != null && rank <= 6) out.push('rank_mid');
  else if (rank != null) out.push('rank_low');
  if (rec.apps >= 30) out.push('role_main');
  else if (rec.pro && rec.apps > 0 && rec.apps < 12) out.push('role_bench');
  if (ctx.gotTrophy) out.push('trophy');
  if (ctx.injuredThisSeason) out.push('injury');
  if (ctx.transferredThisSeason) out.push('transfer');
  if (ctx.hasMilestone) out.push('milestone');
  return out;
}

/** 이번 시즌 성적에 맞는 팬 반응 3~5줄을 고른다. 항상 같은 입력에 같은 결과(결정적). */
const ALL_BUCKETS = Object.keys(FAN_LINES) as FanBucket[];

export function pickFanLines(s: GameState, rec: CareerRecord, ctx: FanFeedContext, min = 3, max = 5): string[] {
  const buckets = new Set(applicableBuckets(s, rec, ctx));
  const seed = `${s.cid}:${rec.year}`;
  // 성적에 맞는 버킷이 min개보다 적으면(예: 평범한 시즌), 나머지는 결정적 해시 순서로 일반
  // 버킷(role_main/rank_mid 등)을 채워 항상 3~5줄이 나오게 한다.
  if (buckets.size < min) {
    const filler = ALL_BUCKETS
      .filter((b) => !buckets.has(b))
      .map((b) => ({ b, k: hashStr(seed + '/fill/' + b) }))
      .sort((x, y) => x.k - y.k);
    for (const { b } of filler) {
      if (buckets.size >= min) break;
      buckets.add(b);
    }
  }
  // 버킷이 max보다 많으면 해시로 안정적인 부분집합을 고른다(같은 입력엔 항상 같은 결과).
  const ordered = [...buckets]
    .map((b) => ({ b, k: hashStr(seed + '/order/' + b) }))
    .sort((x, y) => x.k - y.k)
    .map((x) => x.b);
  const chosen = ordered.slice(0, Math.max(min, Math.min(max, ordered.length)));
  return chosen.map((b) => pickLine(seed, b));
}
