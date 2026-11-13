// T-11-722 랭크 연패 안내(규칙은 app-core losingStreak). 연패 기록은 이 기기에만 남긴다.
import type { TeamMatch } from '@offside/app-core/api/team';
import { streakStep, type StreakHint } from '@offside/app-core/losingStreak';
import { kv } from './setup';

const KEY = 'offside_rank_streak';

/** 마감한 경기를 기록에 더하고, 이 결과 화면에 보일 안내를 돌려준다. */
export function rankStreakHint(m: TeamMatch): StreakHint | null {
  const r = streakStep(kv.getString(KEY), m);
  if (r.raw !== null) kv.set(KEY, r.raw);
  return r.hint;
}
