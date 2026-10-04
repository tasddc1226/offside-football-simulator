import { retireValue, type ValueRow } from '@offside/contracts/market-value';
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
 * T-11-080a 내 선수 은퇴 가치(만 원). 계정 응답 값이 있으면 그 값을, 없으면(게스트·업로드 대기·소급 전) 이 기기 은퇴
 * 기록의 시즌 기록으로 계산한다. 둘 다 없으면 0.
 */
export function myPlayerValue(
  local?: { score: number; detail?: { career: ValueRow[] } | undefined },
  account?: { value?: number | null | undefined },
): number {
  return account?.value ?? (local?.detail ? retireValue(local.detail.career, local.score) : 0);
}
