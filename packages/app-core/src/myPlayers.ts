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
