// T-11-800 팀 점수 이름 고르기(웹 · 앱 공용). 시즌 1 팀 점수는 엘로 레이팅이고 시즌 2부터는 RP 사다리(usesRankLadder)라,
// 같은 자리의 문구가 사전에 한 쌍씩 있다(`키` · `키Rp`, 예: seasonRecap rating · ratingRp). 지난 시즌 기록은 그 시즌의
// 이름으로 보인다(시즌 1 결산 · 배지는 '레이팅'). 저장값(휘장 kind · 칭호 id)은 그대로이고 그릴 때만 고른다.
import { usesRankLadder } from '@offside/contracts/owner-team';

/**
 * 그 시즌 팀 점수 문구. 시즌 2부터는 `${key}Rp`, 그 전 시즌(프리시즌 · 시즌 1)은 key 문구를 읽는다. 사전은 읽을 때 지금
 * 언어를 고르는 getter라 부를 때마다 읽는다. 짝 키가 없거나 문구 모양(글자 · 함수)이 다르면 타입 오류다(그래서 돌려주는
 * 두 타입은 같다).
 */
export function teamScoreLabel<
  K extends string,
  D extends Record<K, unknown> & Record<`${K}Rp`, D[K]>,
>(season: number, dict: D, key: K): D[K] | D[`${K}Rp`] {
  return usesRankLadder(season) ? dict[`${key}Rp`] : dict[key];
}
