// T-10-077 플레이 성향 카운터 키·상한. zod를 쓰지 않는다 — 웹 게임 코드(playStyle.ts)가 첫 화면 번들에서 쓴다.
// 서버 계약(PlayStyleSchema)도 이 목록으로 모양을 만든다.

/** 횟수 필드(PlayStyle의 from·best 말고 전부). */
export const STYLE_COUNTERS = [
  /** 확률이 걸린 선택(주사위)과 그중 성공. */
  'bets',
  'betWins',
  /** 성공 확률 40% 이하에 건 횟수와 그중 성공. */
  'longshots',
  'longshotWins',
  /** '안전' 선택(확정이지만 보상이 준다). */
  'safe',
  /** 확률 없는 확정 선택. */
  'sure',
  /** 프로 구단 사이 이적과 그중 윗 리그로 · 아랫 리그로 · 같은 급 이하인데 연봉을 크게 올린 이적. */
  'moves',
  'tierUp',
  'tierDown',
  'payFirst',
  /** 제의가 있었는데도 잔류·재계약한 횟수와 그중 윗 리그 제의를 거절한 횟수. */
  'loyal',
  'snubUp',
] as const;
export type StyleCounter = (typeof STYLE_COUNTERS)[number];
/** 카운터 하나의 상한(넘으면 여기서 멈춘다). */
export const STYLE_COUNT_MAX = 5000;
