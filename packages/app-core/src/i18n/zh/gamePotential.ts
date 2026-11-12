import type { Translation } from '../core';
import type { GamePotentialMsgs } from '../ko/gamePotential';

export const gamePotential: Translation<GamePotentialMsgs> = {
  peekLocked: '完成第一個賽季後就能查看球探評價。',
  peekAvailable: '真正的潛力會在退役時公開。只查看評價不會改變潛力。',
  peekNote:
    '球探評價是有誤差的估計，21 歲 · 24 歲重新評價時範圍會縮小。隱藏潛力在 25 歲前會起伏，因此可能與退役時公開的真正潛力不同。',
  peekShown: (p) => `${p.grade}級 · ${p.year}賽季球探評價`,
  peekBtnFree: '查看本賽季評價',
  peekBtnAd: '觀看廣告查看本賽季評價',
  peekBtnPay: (p) => `支付${p.cost}查看本賽季評價`,
  peekShort: (p) => `資金不足。查看本賽季評價需要${p.cost}。`,
  flowTitle: '潛力的變化過程',
  flowStart: (p) => `最初的真實潛力 ${p.grade} (${p.value})`,
  flowDrift: (p) => `25歲前成長期的變動（隨機） ${p.d}`,
  flowBoost: (p) => `潛力強化 +${p.n}`,
  flowEvent: (p) => `訓練師 · 劇情事件 +${p.n}`,
  flowBoostAll: (p) => `潛力強化 · 事件 +${p.n}`,
  flowEnd: (p) => `退役時的真實潛力 ${p.grade} (${p.value})`,
  seedLine: (p) => `生涯種子 ${p.seed} · 平衡版本 ${p.v}`,
  balLine: (p) => `平衡版本 ${p.v}`,
  seedNote:
    '這個生涯的比賽與事件判定都是從這個種子延續下來的。種子、平衡與選擇相同，結果也會相同。',
};
