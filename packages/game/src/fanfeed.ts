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

/**
 * T-11-236 인기(fame)가 오를수록 팬 반응이 늘어난다(최대 5줄). 고3 첫 시즌(인기 3에서 시작, 18세 중앙값 9)은 1줄,
 * 시뮬레이터 1,500커리어 기준 20세 중앙값 20 · 23세 39 · 27세 54 · 31세 66 · 34세 87이라 전성기에 4~5줄이 된다.
 */
export const FAN_LINE_STEPS = [10, 20, 40, 70] as const;
export const fanLineCount = (fame: number): number =>
  1 + FAN_LINE_STEPS.filter((step) => fame >= step).length;

/** 인기 구간의 목소리 — 동네·학교(20 미만), 늘어나는 팬(20~45), 해외 팬·스타(70 이상). 그 사이는 성적 반응만. */
function fameBucket(fame: number): FanBucket | null {
  if (fame < 20) return 'fans_local';
  if (fame < 45) return 'fans_growing';
  if (fame >= 70) return 'fans_star';
  return null;
}

/** 이번 시즌 성적과 인기에 맞는 팬 반응을 인기만큼(1~5줄) 고른다. 항상 같은 입력에 같은 결과(결정적). */
export function pickFanLines(
  s: GameState,
  rec: CareerRecord,
  ctx: FanFeedContext,
  count = fanLineCount(s.fame),
): string[] {
  const seed = `${s.cid}:${rec.year}`;
  const voice = fameBucket(s.fame);
  // 인기 구간의 목소리를 맨 앞에, 그다음 성적 버킷을 해시로 안정적인 순서로(같은 입력엔 항상 같은 결과).
  const ordered = [...new Set(applicableBuckets(s, rec, ctx))]
    .map((b) => ({ b, k: hashStr(seed + '/order/' + b) }))
    .sort((x, y) => x.k - y.k)
    .map((x) => x.b);
  const lines = [...(voice ? [voice] : []), ...ordered]
    .slice(0, count)
    .map((b) => pickLine(seed, b));
  // 성적에 맞는 버킷이 모자라면(예: 평범한 시즌) 성적과 무관한 응원(general)으로 채운다.
  // T-10-034: 예전엔 아무 버킷에서나 채워 평범한 시즌에도 "우승이라니…", "부상 소식…"이 섞였다.
  if (lines.length < count) {
    const general = FAN_LINES.general
      .map((line, i) => ({ line, k: hashStr(`${seed}/general/${i}`) }))
      .sort((x, y) => x.k - y.k);
    for (const { line } of general.slice(0, count - lines.length)) lines.push(line);
  }
  return lines;
}
