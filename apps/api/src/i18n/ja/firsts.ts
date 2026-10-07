import { CONFEDS, CONF_ORDER } from '@offside/contracts/nations';

// T-11-140 서버 최초 기록·서버 기록 문구의 일본어. 구조는 firstsText.ts의 영어 표와 같다.
const n = (v: number) => v.toLocaleString('ja-JP');

/** 단계 기록(id = key + 값)의 문장. */
export const LADDER_JA: Record<string, (v: number) => string> = {
  goals: (v) => `通算${n(v)}ゴール、史上初達成！`,
  assists: (v) => `通算${n(v)}アシスト、史上初達成！`,
  apps: (v) => `通算${n(v)}試合出場、史上初達成！`,
  cs: (v) => `通算無失点${n(v)}試合、史上初達成！`,
  caps: (v) => `代表${v}試合出場、史上初達成！`,
  trophies: (v) => `優勝トロフィー${v}個、史上初達成！`,
  awards: (v) => `個人賞${v}個、史上初達成！`,
  sgoals: (v) => `1シーズン${v}ゴール、史上初達成！`,
  sassists: (v) => `1シーズン${v}アシスト、史上初達成！`,
  scs: (v) => `1シーズン無失点${v}試合、史上初達成！`,
  ovr: (v) => `OVR ${v}、史上初到達！`,
  age: (v) => `${v}歳で現役出場、史上初達成！`,
  oneclub: (v) => `1クラブで${v}シーズン、史上初達成！`,
  leagues: (v) => `${v}リーグでプレー、史上初達成！`,
  ballon: (v) => (v === 1 ? 'バロンドール史上初受賞！' : `バロンドール${v}回、史上初受賞！`),
  leaguewins: (v) => `リーグ優勝${v}回、史上初達成！`,
  legend: (v) => `レジェンドスコア${n(v)}点で引退、史上初達成！`,
};

const AWARD = (what: string) => `${what}、史上初受賞！`;
const WON = (what: string) => `${what}、史上初優勝！`;
/** 한 번 달성하는 기록의 문장(id별). */
export const FIXED_JA: Record<string, string> = {
  srating80: 'シーズン平均評価点8.0、史上初達成！',
  srating85: 'シーズン平均評価点8.5、史上初達成！',
  teen20: '20歳以下で1シーズン20ゴール、史上初達成！',
  goldenshoe: AWARD('ヨーロッパ・ゴールデンシュー'),
  yashin: AWARD('ヤシン・トロフィー'),
  thebest: AWARD('FIFAザ・ベスト男子選手賞'),
  kopa: AWARD('コパ・トロフィー'),
  muller: AWARD('ゲルト・ミュラー・トロフィー'),
  fifpro: AWARD('FIFPRO ワールド11'),
  ucl: WON('UEFAチャンピオンズリーグ'),
  uel: WON('UEFAヨーロッパリーグ'),
  acle: WON('AFCチャンピオンズリーグエリート'),
  cwc: WON('FIFAクラブワールドカップ'),
  wc: WON('FIFAワールドカップ'),
  olympic: 'オリンピック金メダル、史上初獲得！',
  asiangames: 'アジア大会金メダル、史上初獲得！',
  win_pl: WON('プレミアリーグ'),
  win_ll: WON('ラ・リーガ'),
  win_sa: WON('セリエA'),
  win_bl: WON('ブンデスリーガ'),
  win_l1: WON('リーグ・アン'),
  win_k1: WON('Kリーグ1'),
  treble: '三冠、史上初達成！',
};
const CUP_JA: Record<string, string> = {
  asiancup: 'AFCアジアカップ',
  euro: 'UEFA EURO',
  copa: 'コパ・アメリカ',
  afcon: 'アフリカネイションズカップ',
  goldcup: 'CONCACAFゴールドカップ',
  ofcup: 'OFCネイションズカップ',
};
for (const c of CONF_ORDER) FIXED_JA[CONFEDS[c].title.id] = WON(CUP_JA[CONFEDS[c].title.id] ?? '');

/** 서버 기록(id = 단계 key)의 이름과 단위. 단위는 숫자 바로 뒤에 붙는다. */
export const RECORD_JA: Record<string, { label: string; unit: string }> = {
  goals: { label: '通算最多ゴール', unit: 'ゴール' },
  assists: { label: '通算最多アシスト', unit: 'アシスト' },
  apps: { label: '通算最多出場', unit: '試合' },
  cs: { label: '通算最多無失点', unit: '試合' },
  caps: { label: '代表最多出場', unit: '試合' },
  trophies: { label: '最多優勝トロフィー', unit: '個' },
  awards: { label: '最多個人賞', unit: '個' },
  sgoals: { label: '1シーズン最多ゴール', unit: 'ゴール' },
  sassists: { label: '1シーズン最多アシスト', unit: 'アシスト' },
  scs: { label: '1シーズン最多無失点', unit: '試合' },
  ballon: { label: 'バロンドール最多受賞', unit: '回' },
  legend: { label: '最高レジェンドスコア', unit: '点' },
};

/** 은퇴 나이 해금 기록의 문장. */
export const retireCapJa = (cap?: number, next?: number) =>
  cap === undefined
    ? '引退年齢までプレーして引退、史上初達成！'
    : next !== undefined && next > cap
      ? `${cap}歳で引退、史上初達成！次のシーズンの引退年齢が${next}歳に解禁`
      : `${cap}歳で引退、史上初達成！`;
