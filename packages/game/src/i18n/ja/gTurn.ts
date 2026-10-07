import type { Translation } from '@offside/contracts/i18n';
import type { GTurnMsgs } from '../ko/gTurn';

export const gTurn: Translation<GTurnMsgs> = {
  blockLine: (p) =>
    `${p.phase} ${p.n}試合 ${p.w}勝${p.d}分${p.l}敗 · 出場${p.apps} · ${p.goals}ゴール ${p.assists}アシスト`,
  roundRange: (p) => `第${p.a}–${p.b}節`,
  hlHat: (p) => `第${p.rd}節 ハットトリック！${p.g}ゴールの大爆発（評価点${p.rating}）`,
  hlMulti: (p) => `第${p.rd}節 複数ゴール（評価点${p.rating}）`,
  hlMom: (p) => `第${p.rd}節 マン・オブ・ザ・マッチに選出（評価点${p.rating}）`,
  hlSave: (p) => `第${p.rd}節 スーパーセーブ連発で無失点（評価点${p.rating}）`,
  hlInjury: (p) => `第${p.rd}節 ${p.big ? '重傷' : 'ケガ'}で途中交代…${p.n}試合欠場の見込み`,
  gameStart: (p) =>
    `${p.nation ? `${p.nation}からサッカー留学に来た、` : ''}${p.club}の3年生${p.pos}、${p.name}。背番号${p.number}でサッカーキャリアをスタートします。`,
  balancePatch: (p) => `バランスパッチv${p.v}が今シーズンから適用されます。`,
  storyEnd: (p) => `[ストーリー完結] ${p.name} · ${p.ending}`,
  placeholderTeam: (p) => `${p.league} ${p.n}`,
};
