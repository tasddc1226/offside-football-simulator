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

type MatchSide = { teamId: string };

/**
 * 친선전 결과 칩의 시즌. 경기에는 시즌이 없어서, 보고 있는 팀이 치른 경기(기록에서 연 지난 시즌 친선전 포함)면 그 팀 시즌을,
 * 아니면 지금 시즌(now, 친구 탭 안내 줄과 같은 기준)을 쓴다. 지난 시즌 팀을 보다가 친구 탭에서 이번 시즌 팀으로 치른 경기가
 * 지난 시즌 이름으로 보이지 않게 한다.
 */
export function friendlySeason(
  m: { mine: 'home' | 'away'; home: MatchSide; away: MatchSide },
  team: { id: string; season: number } | null | undefined,
  now: number,
): number {
  return team && m[m.mine].teamId === team.id ? team.season : now;
}
