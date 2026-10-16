// ───────── 저장된 게임 이름의 화면 번역(T-11-106) ─────────
// 구단·리그·대회·단계·트로피·수상·마일스톤·엔딩처럼 세이브와 서버에 남는 이름은 한국어를 그대로 식별자로 쓴다
// (영구결번·업적·칭호·최초 기록이 이 문자열로 판정한다). 그래서 저장값은 바꾸지 않고, 화면에 그릴 때만 tn()으로 옮긴다.
// 영어 대응표는 i18n/en/_names.ts — 정확히 같은 이름을 먼저 찾고, 없으면 패턴(`X 우승` 등)을 순서대로 맞춰 본다.
// 대응표에 없는 이름(유저가 지은 구단명 등)은 그대로 보인다.
import { localeData } from '@offside/contracts/i18n';

export type NamePattern = readonly [
  RegExp,
  (m: RegExpExecArray, tn: (ko: string) => string) => string,
];
export interface NameTable {
  exact: Readonly<Record<string, string>>;
  /** 위에서부터 처음 맞는 패턴 하나를 쓴다. 정규식은 ^…$로 전체를 맞춘다. */
  patterns: readonly NamePattern[];
}

let memoFor: NameTable | undefined;
const memo = new Map<string, string>();
const HANGUL = /[가-힣]/;

// T-11-292 FIFA 상표 사용 중단 요청(2026-10-16)으로 FIFA 대회·상 이름을 화면에서 뺀다. 저장값('FIFA 월드컵 우승' 등)은
// 영구결번·업적·칭호 판정 식별자라 그대로 두고, 한국어 화면에 그릴 때만 바꾼다(영어·일본어는 대응표가 바꾼다).
const KO_RENAME: Record<string, string> = {
  '더 베스트 남자 선수': '올해의 세계 최우수 선수',
  푸스카스상: '올해의 골',
};

/** 한국어 화면에 그릴 저장된 이름 — FIFA 대회·상 이름만 바꾼다. */
export const koName = (ko: string): string =>
  ko.replace(
    /(?:FIFA )?(클럽 )?(월드컵|더 베스트 남자 선수|푸스카스상)/g,
    (_, club = '', k: string) => club + (KO_RENAME[k] ?? '월드 챔피언십'),
  );

/** 저장된 한국어 이름을 지금 언어로. 한국어거나 대응이 없으면 그대로 돌려준다. */
export function tn(ko: string): string {
  const t = localeData<NameTable>('__names');
  if (!ko) return ko;
  if (!t) return koName(ko);
  if (memoFor !== t) {
    memoFor = t;
    memo.clear();
  }
  let out = memo.get(ko);
  if (out !== undefined) return out;
  // 한글이 없으면(이미 옮긴 이름·유저가 영어로 지은 이름) 대응표를 볼 것도, 메모에 남길 것도 없다.
  if (!HANGUL.test(ko)) return ko;
  out = t.exact[ko];
  if (out === undefined)
    for (const [re, f] of t.patterns) {
      const m = re.exec(ko);
      if (m) {
        out = f(m, tn);
        break;
      }
    }
  out ??= koName(ko);
  memo.set(ko, out);
  return out;
}

export interface RomanTable {
  surnames: Readonly<Record<string, string>>;
  given: Readonly<Record<string, string>>;
  /** 성과 이름 사이(영어 ' ', 일본어 가타카나 '・'). 없으면 공백. */
  sep?: string;
}

/**
 * 게임이 지은 한국 이름(성 한 글자 + 이름 두 글자, data.ts SURNAMES·GIVEN)을 지금 언어로 — 영어면 로마자
 * ("Kim Min-jae"), 일본어면 가타카나("キム・ミンジェ"). 표에 없는 이름(유저가 지은 이름)은 그대로다.
 */
export function personName(ko: string): string {
  const t = localeData<RomanTable>('__roman');
  const sur = t?.surnames[ko.slice(0, 1)];
  const given = t?.given[ko.slice(1)];
  return sur && given ? `${sur}${t?.sep ?? ' '}${given}` : ko;
}
