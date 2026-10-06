// T-11-031 하단 메뉴 바뀜 안내(웹 Game.svelte·team/Team.svelte · 앱 screens/game/Game.tsx·screens/owner/Team.tsx 공용).
// 하단 메뉴가 세 벌(메인 · 게임 · 내 팀)이고 모양이 같아, 게임·내 팀 화면에 들어와도 아래가 바뀐 걸 놓치기 쉽다.
// 그 메뉴를 처음 볼 때 한 번만 가운데 나가기 버튼 위에 말풍선을 띄운다(기기마다, 메뉴마다 한 번).
import { loadKey, saveKey } from '@offside/game/season';
import { shellMoreText } from './i18n/ko/shellMore.js';

export type SubNav = 'game' | 'team';

const KEY = 'ft_nav_intro';
/** 말풍선 문구 — 가운데 버튼이 이 메뉴에서 나가는 자리라는 걸 알린다. */
export const NAV_INTRO: Record<SubNav, string> = {
  get game() {
    return shellMoreText.navIntroGame;
  },
  get team() {
    return shellMoreText.navIntroTeam;
  },
};
/** 말풍선이 떠 있는 시간(ms). 그 전에 화면을 만지면 바로 닫는다. */
export const NAV_INTRO_MS = 5000;

/** 이 메뉴를 처음 보면 안내 문구를 돌려주고 본 것으로 적는다. 본 적 있거나 적을 수 없으면(저장소 막힘 — 매번 뜨지 않게) null. */
export function takeNavIntro(k: SubNav): string | null {
  const seen = loadKey<SubNav[]>(KEY) ?? [];
  if (seen.includes(k) || !saveKey(KEY, [...seen, k])) return null;
  return NAV_INTRO[k];
}
