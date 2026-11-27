// T-11-834 크리스마스 이벤트 카드 · 트리 시트 그리기 값(웹 HomeXmas.svelte · 앱 HomeXmas.tsx가 같이 쓴다).
import type { XmasEvent, XmasSock } from '@offside/contracts';
import { XMAS_EVENT, XMAS_TREE_STEPS } from '@offside/contracts/xmas';
import { rewardText } from './attendance-view.js';
import { xmasText as L } from './i18n/ko/xmas.js';

export type XmasSockState = 'claimed' | 'ready' | 'login' | 'todo';

/** 양말 칸 상태: 받음 · 받기(조건을 채운 구단주) · 로그인(조건을 채웠지만 로그인 전) · 아직. */
export const sockState = (ev: Pick<XmasEvent, 'owner'>, s: XmasSock): XmasSockState =>
  s.claimed ? 'claimed' : !s.done ? 'todo' : ev.owner ? 'ready' : 'login';

export const sockLabel = (key: XmasSock['key']) =>
  ({ start: L.sockStart, retire: L.sockRetire, team: L.sockTeam })[key];
export const sockHint = (key: XmasSock['key']) =>
  ({ start: L.sockStartHint, retire: L.sockRetireHint, team: L.sockTeamHint })[key];
export const sockStateLabel = (st: XmasSockState) =>
  ({ claimed: L.stateClaimed, ready: L.stateReady, login: L.stateLogin, todo: L.stateTodo })[st];

/** 남은 날(KST 자정 기준). 마지막 날이면 0. */
export function xmasDaysLeft(nowMs = Date.now()): number {
  const DAY = 86_400_000;
  return Math.max(0, Math.ceil((Date.parse(XMAS_EVENT.endAt) - nowMs) / DAY) - 1);
}

/** 보상 한 줄(zod 응답의 선택 칸은 undefined일 수 있어 비운 뒤 넘긴다). */
export const xmasRewardText = (
  r: Partial<Record<'reroll' | 'boost' | 'scout' | 'rename', number | undefined>>,
) =>
  rewardText(
    Object.fromEntries(Object.entries(r).filter(([, v]) => v)) as Parameters<typeof rewardText>[0],
  );

/** 트리 진행도(%, 0~100). */
export const treePct = (ev: Pick<XmasEvent, 'tree'>) =>
  Math.min(100, Math.floor((ev.tree.count / ev.tree.goal) * 100));

export const treeCountText = (ev: Pick<XmasEvent, 'tree'>) =>
  L.treeCount({
    count: ev.tree.count.toLocaleString('en-US'),
    goal: ev.tree.goal.toLocaleString('en-US'),
  });

/** 받은 뒤 토스트 문구. */
export function xmasClaimToast(
  target: string,
  granted: Parameters<typeof rewardText>[0],
  title: boolean,
) {
  const reward = rewardText(granted);
  const m = /^tree:(\d)$/.exec(target);
  const step = m ? XMAS_TREE_STEPS[Number(m[1]) - 1]?.pct : undefined;
  const line = step !== undefined ? L.gotTree({ pct: step, reward }) : L.got({ reward });
  // 보상 줄은 마침표 없이 끝나서 칭호 문장을 앞에 둔다.
  return title ? `${L.gotTitle} ${line}` : line;
}
