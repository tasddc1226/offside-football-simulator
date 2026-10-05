import { cardValue, retireValue, type ValueRow } from '@offside/contracts/market-value';
import { NATION_BY_CODE } from '@offside/contracts/nations';

/** 내 선수 국적은 기록된 값만 쓴다. 옛 로컬 항목에 없으면 같은 커리어의 계정 응답으로 보완한다. */
export function myPlayerNation(
  local?: { nation?: string | null | undefined },
  account?: { nation?: string | null | undefined },
): string | undefined {
  const known = (code: string | null | undefined) =>
    code && NATION_BY_CODE.has(code) ? code : undefined;
  return known(local?.nation) ?? known(account?.nation);
}

/**
 * T-11-080a 이 기기 은퇴 기록의 은퇴 가치(만 원). 계정 응답에 값이 있으면 그 값을 먼저 쓰고, 이건 게스트·업로드 대기·
 * 소급 전 기록에만 쓰인다. 시즌 기록이 없으면 0.
 */
export function localPlayerValue(h: {
  score: number;
  detail?: { career: ValueRow[] } | undefined;
}): number {
  return h.detail ? retireValue(h.detail.career, h.score) : 0;
}

/**
 * T-11-109 이 기기 은퇴 기록의 카드 기준가(만 원) — 비로그인 구단 가치에 쓴다. 서버 카드처럼 시즌 기록이 없으면
 * CARD_VALUE_FLOOR.
 */
export function localCardValue(h: {
  peak: number;
  detail?: { career: ValueRow[] } | undefined;
}): number {
  return cardValue(h.detail?.career ?? [], h.peak);
}
