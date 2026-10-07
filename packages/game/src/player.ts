// ───────── 선수·리그 조회와 파생 값 (T-10-046: engine.ts에서 분리) ─────────
import {
  LEAGUES,
  CLUBS,
  focusOfType,
  attrLabels,
  type AttrKey,
  type League,
  type Club,
} from './data.js';
import { ovr } from './attributes.js';
import { fmtValue as fmtValueKo } from '@offside/contracts/market-value';
import { getLocale, intlLocale } from '@offside/contracts/i18n';
import type { GameState } from './types.js';

export const leagueOf = (id: string): League => LEAGUES.find((l) => l.id === id)!;
/** 구단의 지금 리그 — 커리어 안의 승강(T-10-110)이 있으면 그쪽, 없으면 정적 소속. */
export const clubLeagueId = (c: Club, s?: Pick<GameState, 'leagueMoves'>): string =>
  s?.leagueMoves?.[c.id] ?? c.leagueId;
export const clubLeague = (c: Club, s?: Pick<GameState, 'leagueMoves'>): League =>
  leagueOf(clubLeagueId(c, s));
/** 리그의 구단 목록. s를 주면 그 커리어의 승강을 반영한다(순위표·이적 시장·대회). 승강표는 한 번만 복사해
 * 읽는다 — 게임 상태는 $state 프록시라 구단마다 읽으면 순위표 $derived가 구단 수만큼 의존성을 단다. */
export function clubsIn(id: string, s?: Pick<GameState, 'leagueMoves'>): Club[] {
  const m = s?.leagueMoves && { ...s.leagueMoves };
  return CLUBS.filter((c) => (m?.[c.id] ?? c.leagueId) === id);
}
/** 주력 능력치 — 옛 저장본(focus 없음)은 유형에서 거꾸로 구한다. */
export const focusOf = (s: GameState): AttrKey[] => s.focus ?? focusOfType(s.pos, s.type);
export const labelOf = (s: GameState, k: AttrKey): string => attrLabels(s.pos)[k];
export function roleOf(s: GameState): '주전' | '로테이션' | '벤치' {
  if (leagueOf(s.leagueId).amateur)
    return ovr(s) >= s.club.str - 2 ? '주전' : ovr(s) >= s.club.str - 8 ? '로테이션' : '벤치';
  const d = ovr(s) - s.club.str + s.trust;
  return d >= 1 ? '주전' : d >= -5 ? '로테이션' : '벤치';
}
// 연봉·몸값 식은 서버와 같이 쓴다(T-10-100 명예의 전당 가치 순).
export { salaryFor, valueFor } from '@offside/contracts/market-value';
const NUM_FMT: Intl.NumberFormat[] = [];
/** 소수 자릿수(0~2)별 숫자 서식 — 목록마다 금액을 여러 번 그리므로 Intl 객체를 다시 만들지 않는다(영어에서만 쓴다). */
const numFmt = (digits: number): Intl.NumberFormat =>
  (NUM_FMT[digits] ??= new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: digits }));
/** 영어 금액 표기(원화 그대로): ₩500K · ₩12.3M · ₩1.85B. 한국어 단위(만·억)를 쓰지 않는다. man은 만 원. */
function krwCompact(man: number): string {
  const won = Math.round(man) * 10_000;
  const a = Math.abs(won);
  const sign = won < 0 ? '-' : '';
  const num = (v: number, digits: number) => numFmt(digits).format(v);
  if (a >= 999_500_000) return `${sign}₩${num(a / 1e9, 2)}B`;
  if (a >= 1_000_000) return `${sign}₩${num(a / 1e6, a >= 100_000_000 ? 0 : 1)}M`;
  return `${sign}₩${num(a / 1e3, 0)}K`;
}
/** 일본어 금액 표기(T-11-140): 원화 기호 + 일본어 단위 — ₩5,000万 · ₩3億5,000万 · ₩1兆2,346億. v는 만 원(0 이상). */
function krwJa(v: number): string {
  const n = (x: number) => x.toLocaleString('ja-JP');
  const part = (hi: number, hn: string, lo: number, ln: string) =>
    `₩${n(hi)}${hn}${lo ? `${n(lo)}${ln}` : ''}`;
  if (v >= 100_000_000) return part(Math.floor(v / 1e8), '兆', Math.round((v % 1e8) / 1e4), '億');
  if (v >= 10_000) return part(Math.floor(v / 1e4), '億', v % 1e4, '万');
  return `₩${n(v)}万`;
}
export function fmtMoney(man: number): string {
  const lang = getLocale();
  if (lang === 'en') return krwCompact(man);
  if (lang === 'ja') {
    // 한국어와 같게 천만 단위로 먼저 반올림한다(9,770万 → 1億).
    const m = Math.round(man),
      a = Math.abs(m);
    return `${m < 0 ? '-' : ''}${krwJa(a >= 10_000 ? Math.round(a / 1000) * 1000 : a)}`;
  }
  const m = Math.round(man);
  if (Math.abs(m) >= 10000) {
    // 천만 단위로 먼저 반올림해야 9,770만 → '1억'으로 올라간다('18억 10,000만' 방지). 음수는 부호만 앞에 붙인다.
    const t = Math.round(Math.abs(m) / 1000) * 1000;
    const e = Math.floor(t / 10000),
      r = t % 10000;
    return `${m < 0 ? '-' : ''}${e}억${r ? ` ${r.toLocaleString(intlLocale())}만` : ''}`;
  }
  return `${m.toLocaleString(intlLocale())}만`;
}
/** 몸값·이적료 표기. 한국어는 서버와 같은 표기(contracts), 영어는 fmtMoney와 같은 원화 약식, 일본어는 큰 두 단위. 0 이하는 '-'. */
export function fmtValue(man: number): string {
  const lang = getLocale();
  if (lang === 'ko') return fmtValueKo(man);
  if (lang === 'ja') {
    if (man <= 0) return '-';
    // 한국어 표기(contracts fmtValue)와 같은 자리에서 반올림한다.
    const r = (u: number) => Math.round(man / u) * u;
    const v = r(10_000) >= 100_000_000 ? r(10_000) : r(1000) >= 10_000 ? r(1000) : r(100);
    return v ? krwJa(v) : '₩100万未満';
  }
  if (man <= 0) return '-';
  return Math.round(man / 100) * 100 ? krwCompact(Math.round(man / 100) * 100) : 'Under ₩1M';
}
