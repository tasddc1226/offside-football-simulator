// T-11-150 대표 칭호 표시 — 칭호 id('cup-3-champion')에서 회차와 단계를 읽어 문구와 트로피를 고른다.
import { parseTitle, type TitleStage } from '@offside/contracts/owner-title';
import { ownerProfileText as L } from './i18n/ko/ownerProfile.js';

export { parseTitle, TITLE_NONE } from '@offside/contracts/owner-title';

const LABEL: Record<TitleStage, (p: { n: number }) => string> = {
  champion: (p) => L.titleChampion(p),
  runnerup: (p) => L.titleRunnerup(p),
  sf: (p) => L.titleSf(p),
};

/** '제3회 챔피언'(지금 언어). 알 수 없는 id면 null. */
export function titleLabel(id: string | null | undefined): string | null {
  const t = parseTitle(id);
  return t ? LABEL[t.stage]({ n: t.edition }) : null;
}
