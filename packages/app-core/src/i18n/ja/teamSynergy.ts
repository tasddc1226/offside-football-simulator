import { HOMEGROWN_MIN, NATIONAL_MIN } from '@offside/contracts/owner-team';
import type { Translation } from '../core';
import type { TeamSynergyMsgs } from '../ko/teamSynergy';

const NAMES: Record<string, readonly [string, string]> = {
  cross: [
    'クロスの方程式',
    'ターゲットマン型(ST・CF・SS) + ウインガー型または攻撃的サイドバック型(W・LW・RW・FB・LB・RB・LWB・RWB)',
  ],
  engine: [
    '中盤のエンジン',
    'ボックス・トゥ・ボックス型 + プレーメーカー型、両方をDM・CM・AM・LM・RMに配置',
  ],
  wall: ['鉄壁', '鉄壁型(GK) + ストッパー型2人(CB・SW)'],
  cb_pair: ['CBコンビ', 'ストッパー型 + ビルドアップCB型、両方をCB・SWに配置'],
  buildup: ['後方からのビルドアップ', 'スイーパーキーパー型(GK) + ビルドアップCB型(CB・SW)'],
  counter: [
    'カウンター一撃',
    'スピードスター型(ST・CF・SS・W・LW・RW) + プレーメーカー型(DM・CM・LM・RM)',
  ],
  overlap: [
    'サイドのオーバーラップ',
    '同じサイドの攻撃的サイドバック型(FB・LB・RB・LWB・RWB) + ウインガー型(W・LW・RW)',
  ],
  killpass: ['キラーパス', '点取り屋型(ST・CF・SS) + プレーメーカー型(AM・CM・LM・RM)'],
  guardian: ['守護神', 'スーパーセーバー型(GK) + ストッパー型(CB・SW)'],
  homegrown: ['生え抜きチーム', `自分で育てた選手${HOMEGROWN_MIN}人以上がスタメン`],
  national: ['代表ラインナップ', `同じ国籍の選手${NATIONAL_MIN}人以上がスタメン`],
  foot: [
    '利き足マッチ',
    'FB・LB・RB・LWB・RWBは同じ側の足、W・LW・RWは逆足。選手タイプは問いません。',
  ],
};

export const teamSynergy: Translation<TeamSynergyMsgs> = {
  noEffect: '試合効果なし',
  applies: '試合効果のあるシナジーはすべて反映されます',
  notApplied: 'プレシーズンの試合には反映されませんでした',
  footChip: (p) => `${p.name} ${p.n}人`,
  fitEffect: (p) => `ポジション適性 ${p.v}`,
  fitEffectBoth: (p) => `ポジション適性 ${p.v}（両足 ${p.both}）`,
  badgeOnly: 'バッジのみ（試合効果なし）',
  requirementsHint:
    '連携には選手タイプと配置位置の両方が必要です。括弧内は配置位置です。カードをタップしてタイプを確認できます。W・LW・RWのスピードスターはウインガー型の条件を満たしません。',
  title: 'チームシナジー',
  chipApplied: '適用中',
  chipViewing: '表示中',
  chipNoEffect: '効果なし',
  chipOff: '未適用',
  chipHint:
    'シナジーをタップすると対象選手を表示します。選択に関係なく試合効果は適用されます。代表ラインナップはバッジのみです。',
  pitchAll: (p) => `シナジー${p.n}個すべて適用中`,
  pitchFocus: (p) => `${p.name}の選手を表示 · ${p.n}個すべて適用中`,
  pitchMemberAria: 'シナジー適用選手',
  moreOff: (p) => `もっと見る · 未適用 ${p.n}件`,
  lessOff: '未適用を閉じる',
  empty: 'まだ有効なシナジーはありません。',
  youthNote:
    '同じ連携は複数組あっても1回分です。異なるシナジーの効果は加算されます。ユース選手は対象外です。',
  synName: (p) => NAMES[p.id]?.[0] ?? p.ko,
  synDesc: (p) => NAMES[p.id]?.[1] ?? p.ko,
};
