// ───────── 저장된 게임 이름의 화면 번역(T-11-106) ─────────
// 구단·리그·대회·단계·트로피·수상·마일스톤·엔딩처럼 세이브와 서버에 남는 이름은 한국어를 그대로 식별자로 쓴다
// (영구결번·업적·칭호·최초 기록이 이 문자열로 판정한다). 그래서 저장값은 바꾸지 않고, 화면에 그릴 때만 tn()으로 옮긴다.
// 영어 대응표는 i18n/en/_names.ts — 정확히 같은 이름을 먼저 찾고, 없으면 패턴(`X 우승` 등)을 순서대로 맞춰 본다.
// 대응표에 없는 이름(유저가 지은 구단명 등)은 그대로 보인다.
import { localeData } from '@offside/contracts/i18n';

export type NamePattern = readonly [RegExp, (m: RegExpExecArray, tn: (ko: string) => string) => string];
export interface NameTable {
  exact: Readonly<Record<string, string>>;
  /** 위에서부터 처음 맞는 패턴 하나를 쓴다. 정규식은 ^…$로 전체를 맞춘다. */
  patterns: readonly NamePattern[];
}

let memoFor: NameTable | undefined;
const memo = new Map<string, string>();

/** 저장된 한국어 이름을 지금 언어로. 한국어거나 대응이 없으면 그대로 돌려준다. */
export function tn(ko: string): string {
  const t = localeData<NameTable>('__names');
  if (!t || !ko) return ko;
  if (memoFor !== t) {
    memoFor = t;
    memo.clear();
  }
  let out = memo.get(ko);
  if (out !== undefined) return out;
  out = t.exact[ko];
  if (out === undefined)
    for (const [re, f] of t.patterns) {
      const m = re.exec(ko);
      if (m) {
        out = f(m, tn);
        break;
      }
    }
  out ??= ko;
  memo.set(ko, out);
  return out;
}
