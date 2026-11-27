// T-11-834 크리스마스 이벤트 기간 판정만 따로 둔 작은 서브패스(`@offside/contracts/xmas-dates`). 웹 첫 화면(홈 · 친구 초대
// 문구)이 카드 청크를 받을지 고를 때 쓰므로 보상 표 같은 나머지 규칙(xmas-rules.ts)은 여기에 두지 않는다.

export const XMAS_DATES = {
  /** 12/19(토) 00:00 KST. */
  startAt: '2026-12-18T15:00:00.000Z',
  /** 트리는 12/25까지 센다(12/26 00:00 KST에 마감). 받기는 이벤트가 끝날 때까지 된다. */
  treeEndAt: '2026-12-25T15:00:00.000Z',
  /** 1/4(월)까지(1/5 00:00 KST에 끝). */
  endAt: '2027-01-04T15:00:00.000Z',
} as const;

export type XmasPhase = 'before' | 'open' | 'ended';

/** 지금 이벤트 단계. off(밸런스 xmasEvent 0)면 기간이어도 닫는다. */
export function xmasPhase(nowMs: number, off = false): XmasPhase {
  if (off || nowMs >= Date.parse(XMAS_DATES.endAt)) return 'ended';
  return nowMs >= Date.parse(XMAS_DATES.startAt) ? 'open' : 'before';
}

/** 기간 중 친구 초대 보상 배수. */
export const XMAS_INVITE_MULT = 2;

/** 그 시각의 친구 초대 보상 배수(이벤트 기간이면 2, 아니면 1). */
export const xmasInviteMult = (nowMs: number, off = false) =>
  xmasPhase(nowMs, off) === 'open' ? XMAS_INVITE_MULT : 1;
