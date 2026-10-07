import { YOUTH_NAME } from '@offside/contracts/owner-team';
import { POS_LABEL, anonName, type PosGroup } from '@offside/contracts/positions';
import type { Lang } from '../lang.js';

// T-11-106 경기 기록에 저장된 익명 표기("익명의 공격수 No.9" · "유스 선수")를 요청 언어(영어·일본어)로 읽어 준다. 저장값은 한국어 그대로다.
const POS_OF_LABEL = new Map(
  (Object.entries(POS_LABEL) as [PosGroup, string][]).map(([pos, label]) => [label, pos]),
);
const ANON = /^익명의 (공격수|미드필더|수비수|골키퍼)(?: No\.(\d+))?$/;

export function anonText(anon: string, lang: Lang): string {
  if (lang === 'ko') return anon;
  if (anon === YOUTH_NAME) return lang === 'ja' ? 'ユース選手' : 'Youth player';
  const m = ANON.exec(anon);
  const pos = m && POS_OF_LABEL.get(m[1]!);
  return pos ? anonName(pos, m[2] ? Number(m[2]) : null, lang) : anon;
}
