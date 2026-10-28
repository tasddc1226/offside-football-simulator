import { CONFEDS, CONF_ORDER } from '@offside/contracts/nations';

// T-11-553 서버 최초 기록·서버 기록 문구의 번체 중국어. 구조는 firstsText.ts의 영어 표와 같다.
const n = (v: number) => v.toLocaleString('zh-TW');

/** 단계 기록(id = key + 값)의 문장. */
export const LADDER_ZH: Record<string, (v: number) => string> = {
  goals: (v) => `生涯 ${n(v)} 球，史上首位達成！`,
  assists: (v) => `生涯 ${n(v)} 次助攻，史上首位達成！`,
  apps: (v) => `生涯出賽 ${n(v)} 場，史上首位達成！`,
  cs: (v) => `生涯零失球 ${n(v)} 場，史上首位達成！`,
  caps: (v) => `國家隊出賽 ${v} 場，史上首位達成！`,
  trophies: (v) => `冠軍獎盃 ${v} 座，史上首位達成！`,
  awards: (v) => `個人獎項 ${v} 座，史上首位達成！`,
  sgoals: (v) => `單季 ${v} 球，史上首位達成！`,
  sassists: (v) => `單季 ${v} 次助攻，史上首位達成！`,
  scs: (v) => `單季零失球 ${v} 場，史上首位達成！`,
  ovr: (v) => `OVR ${v}，史上首位達到！`,
  age: (v) => `${v} 歲仍在場上出賽，史上首位達成！`,
  oneclub: (v) => `效力同一家俱樂部 ${v} 個賽季，史上首位達成！`,
  leagues: (v) => `踢過 ${v} 個聯賽，史上首位達成！`,
  ballon: (v) => (v === 1 ? '史上首座金球獎！' : `金球獎 ${v} 座，史上首位達成！`),
  leaguewins: (v) => `聯賽冠軍 ${v} 次，史上首位達成！`,
  legend: (v) => `以傳奇分數 ${n(v)} 分退役，史上首位達成！`,
};

const AWARD = (what: string) => `${what}，史上首位得主！`;
const WON = (what: string) => `${what}，史上首次奪冠！`;
/** 한 번 달성하는 기록의 문장(id별). */
export const FIXED_ZH: Record<string, string> = {
  srating80: '賽季平均評分 8.0，史上首位達成！',
  srating85: '賽季平均評分 8.5，史上首位達成！',
  teen20: '20 歲以下單季 20 球，史上首位達成！',
  goldenshoe: AWARD('歐洲金靴獎'),
  yashin: AWARD('雅辛獎'),
  thebest: AWARD('年度世界最佳球員獎'),
  kopa: AWARD('科帕獎'),
  muller: AWARD('蓋德·穆勒獎'),
  fifpro: AWARD('FIFPRO 世界最佳陣容'),
  ucl: WON('歐洲冠軍聯賽'),
  uel: WON('歐洲聯賽'),
  acle: WON('亞足聯菁英冠軍聯賽'),
  cwc: WON('世界俱樂部錦標賽'),
  wc: WON('世界錦標賽'),
  olympic: '奧運金牌，史上首位獲得！',
  asiangames: '亞運金牌，史上首位獲得！',
  win_pl: WON('英超'),
  win_ll: WON('西甲'),
  win_sa: WON('義甲'),
  win_bl: WON('德甲'),
  win_l1: WON('法甲'),
  win_k1: WON('K 聯賽 1'),
  treble: '三冠王，史上首位達成！',
};
const CUP_ZH: Record<string, string> = {
  asiancup: '亞洲盃',
  euro: '歐洲國家盃',
  copa: '美洲盃',
  afcon: '非洲國家盃',
  goldcup: '中北美洲金盃賽',
  ofcup: '大洋洲國家盃',
};
for (const c of CONF_ORDER) FIXED_ZH[CONFEDS[c].title.id] = WON(CUP_ZH[CONFEDS[c].title.id] ?? '');

/** 서버 기록(id = 단계 key)의 이름과 단위. 단위는 숫자 바로 뒤에 붙는다. */
export const RECORD_ZH: Record<string, { label: string; unit: string }> = {
  goals: { label: '生涯最多進球', unit: '球' },
  assists: { label: '生涯最多助攻', unit: '次' },
  apps: { label: '生涯最多出賽', unit: '場' },
  cs: { label: '生涯最多零失球', unit: '場' },
  caps: { label: '國家隊最多出賽', unit: '場' },
  trophies: { label: '最多冠軍獎盃', unit: '座' },
  awards: { label: '最多個人獎項', unit: '座' },
  sgoals: { label: '單季最多進球', unit: '球' },
  sassists: { label: '單季最多助攻', unit: '次' },
  scs: { label: '單季最多零失球', unit: '場' },
  ballon: { label: '最多金球獎', unit: '座' },
  legend: { label: '最高傳奇分數', unit: '分' },
};

/** 은퇴 나이 해금 기록의 문장. */
export const retireCapZh = (cap?: number, next?: number) =>
  cap === undefined
    ? '踢到退役年齡才退役，史上首位達成！'
    : next !== undefined && next > cap
      ? `${cap} 歲退役，史上首位達成！下個賽季的退役年齡解鎖至 ${next} 歲`
      : `${cap} 歲退役，史上首位達成！`;
