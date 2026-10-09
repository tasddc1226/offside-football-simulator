import { HOMEGROWN_MIN, NATIONAL_MIN } from '@offside/contracts/owner-team';
import type { Translation } from '../core';
import type { TeamSynergyMsgs } from '../ko/teamSynergy';

const NAMES: Record<string, readonly [string, string]> = {
  cross: ['クロスの方程式', 'ターゲットマンのストライカー + サイドのウイング・攻撃的サイドバック'],
  engine: ['中盤のエンジン', 'ボックス・トゥ・ボックス + プレーメーカーが一緒に中盤に'],
  wall: ['鉄壁', '守護神タイプのGK + ストッパーのセンターバック2人'],
  cb_pair: ['CBコンビ', 'ストッパー + ビルドアップ型が一緒にセンターバックに'],
  buildup: ['後方からのビルドアップ', 'スイーパーキーパー + ビルドアップ型センターバック'],
  counter: ['カウンター一撃', 'スピードスターのFW + 後ろからパスを通すプレーメーカー'],
  overlap: ['サイドのオーバーラップ', '同じサイドの攻撃的サイドバック + ウイング'],
  killpass: ['キラーパス', 'ゴールハンターのストライカー + 攻撃的・中央MFの位置のプレーメーカー'],
  guardian: ['守護神', 'スーパーセーバーのGK + ストッパーのセンターバック'],
  homegrown: ['生え抜きチーム', `自分で育てた選手${HOMEGROWN_MIN}人以上がスタメン`],
  national: ['代表ラインナップ', `同じ国籍の選手${NATIONAL_MIN}人以上がスタメン`],
  foot: ['利き足マッチ', 'サイドバックは同じ側の足、ウイングは逆足'],
};

export const teamSynergy: Translation<TeamSynergyMsgs> = {
  capped: '上限に達して効果なし',
  noEffect: '試合効果なし',
  applies: 'オンのシナジーはすべて試合に反映されます',
  notApplied: 'プレシーズンの試合には反映されませんでした',
  footChip: (p) => `${p.name} ${p.n}人`,
  fitEffect: (p) => `ポジション適性 ${p.v}`,
  fitEffectBoth: (p) => `ポジション適性 ${p.v}（両足 ${p.both}）`,
  badgeOnly: 'バッジのみ（試合効果なし）',
  title: 'チームシナジー',
  chipApplied: '適用中',
  chipViewing: '表示中',
  chipNoEffect: '効果なし',
  chipOff: '未適用',
  chipHint:
    'オンのシナジーをタップすると、ピッチでその選手たちを表示します。タップに関係なく、すべて適用されます。',
  pitchAll: (p) => `シナジー${p.n}個すべて適用中`,
  pitchFocus: (p) => `${p.name}の選手を表示 · ${p.n}個すべて適用中`,
  pitchMemberAria: 'シナジー適用選手',
  moreOff: (p) => `もっと見る · 未適用 ${p.n}件`,
  lessOff: '未適用を閉じる',
  empty: 'まだオンのシナジーはありません。タイプの合う選手を一緒に並べましょう。',
  capNote: (p) =>
    `デュオ効果はラインごとに+${p.line}、合計+${p.total}まで。ユース選手はシナジーに含まれません。`,
  synName: (p) => NAMES[p.id]?.[0] ?? p.ko,
  synDesc: (p) => NAMES[p.id]?.[1] ?? p.ko,
};
