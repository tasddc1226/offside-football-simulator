import type { Translation } from '@offside/contracts/i18n';
import type { GTurnMsgs } from '../ko/gTurn';

export const gTurn: Translation<GTurnMsgs> = {
  blockLine: (p) =>
    `${p.phase} ${p.n}場 ${p.w}勝${p.d}和${p.l}負 · 出場${p.apps} · ${p.goals}球 ${p.assists}助攻`,
  roundRange: (p) => `第${p.a}–${p.b}輪`,
  hlHat: (p) => `第${p.rd}輪 帽子戲法！狂轟${p.g}球（評分${p.rating}）`,
  hlMulti: (p) => `第${p.rd}輪 梅開二度以上（評分${p.rating}）`,
  hlMom: (p) => `第${p.rd}輪 獲選全場最佳球員（評分${p.rating}）`,
  hlSave: (p) => `第${p.rd}輪 神撲連發，零失球（評分${p.rating}）`,
  hlInjury: (p) => `第${p.rd}輪 因${p.big ? '重傷' : '傷'}被換下…預計缺陣${p.n}場`,
  gameStart: (p) =>
    `${p.nation ? `從${p.nation}來足球留學的` : ''}${p.club}三年級${p.pos}${p.name}，背號${p.number}號，足球生涯就此展開。`,
  balancePatch: (p) =>
    `平衡性更新v${p.v}自本賽季起套用。所有球員數值相同，變更內容可在機率圖鑑查看。`,
  clubStrengthPatch: (p) => `本賽季起套用新的俱樂部戰力表（v${p.v}，以 ${p.asOf} 現實排名為準）。`,
  storyEnd: (p) => `[故事完結] ${p.name} · ${p.ending}`,
  placeholderTeam: (p) => `${p.league} ${p.n}`,
};
