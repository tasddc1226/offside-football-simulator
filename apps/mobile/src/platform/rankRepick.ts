// T-11-701 랭크 다른 상대 찾기(규칙은 app-core rankQueue). 하루 횟수는 이 기기에만 남긴다.
import { repicksLeft, spendRepick } from '@offside/app-core/rankQueue';
import { kv } from './setup';

const KEY = 'offside_rank_repick';

/** 오늘 남은 횟수. */
export const rankRepicksLeft = () => repicksLeft(kv.getString(KEY));

/** 다른 상대를 찾았을 때 횟수를 하나 쓴다. 남은 횟수를 돌려준다. */
export function spendRankRepick(): number {
  kv.set(KEY, spendRepick(kv.getString(KEY)));
  return rankRepicksLeft();
}
