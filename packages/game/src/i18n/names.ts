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

// ───────── 유저가 바꾼 이름 (T-11-647) ─────────
// 대회·수상·리그 이름을 이 기기에서만 바꿔 부른다(설정 → 대회·수상 이름 바꾸기). 키는 저장된 한국어 이름, 값은 유저가 쓴 이름.
// 저장값·판정·서버 기록은 그대로고 화면에 그릴 때만 바뀐다. 키가 앞에 붙은 이름(`K리그1 득점왕`, `코리아컵 우승`)도
// 그 부분만 바뀐다. 공유 이미지처럼 남에게 나가는 그림은 withDefaultNames로 원래 이름을 쓴다.
let custom: Readonly<Record<string, string>> = {};
/** 긴 키부터 — `AFC 챔피언스리그 엘리트`가 `AFC 챔피언스리그`보다 먼저 맞는다. */
let customKeys: readonly string[] = [];
let customOff = 0;
const YEAR_HEAD = /^\d{4} /;

/** 유저 이름표를 바꾼다(부팅 때 · 설정에서 바꿀 때). 빈 값은 빠진다. */
export function setCustomNames(map: Readonly<Record<string, string>>): void {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) if (k && v) clean[k] = v;
  custom = clean;
  customKeys = Object.keys(clean).sort((a, b) => b.length - a.length);
}
/** fn 안에서는 유저 이름표 없이 원래 이름으로 그린다(남에게 보이는 공유 이미지). fn은 동기로 끝나야 한다. */
export function withDefaultNames<T>(fn: () => T): T {
  customOff++;
  try {
    return fn();
  } finally {
    customOff--;
  }
}

/** 저장된 한국어 이름을 지금 언어로. 한국어거나 대응이 없으면 그대로 돌려준다. 유저가 바꾼 이름이 있으면 그 이름. */
export function tn(ko: string): string {
  const out = defaultName(ko);
  if (customOff || !customKeys.length || !ko) return out;
  const exact = custom[ko];
  if (exact !== undefined) return exact;
  // 대표팀 대회 기록은 연도가 앞에 붙는다(`2030 FIFA 월드컵 (개최지)`) — 연도 뒤부터 맞춘다.
  const body = YEAR_HEAD.test(ko) ? ko.slice(5) : ko;
  for (const k of customKeys) {
    if (!body.startsWith(k) || (body.length > k.length && body.charAt(k.length) !== ' ')) continue;
    // 원래 이름 안의 그 부분을 유저 이름으로 바꾼다(언어마다 어순이 달라도 원래 번역 안에서 찾는다).
    const part = defaultName(k);
    if (out.includes(part)) return out.replace(part, () => custom[k]!);
  }
  return out;
}

function defaultName(ko: string): string {
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
        out = f(m, defaultName);
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
