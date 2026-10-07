import type { Translation } from '../core';
import type { GameMsgs } from '../ko/game';

export const game: Translation<GameMsgs> = {
  menuLabel: 'ゲームメニュー',
  tabSeason: 'シーズン',
  tabPlayer: '選手',
  tabCareer: 'キャリア',
  tabTrophy: 'トロフィー',
  tabHome: 'ホーム',
  age: (p) => `${p.n}歳`,
  salary: (p) => `年俸 ${p.v}`,
  amateur: 'アマチュア',
  value: (p) => `市場価値 ${p.v}`,
  focus: (p) => `主力 ${p.names}`,
  injury: (p) => `負傷 ${p.n}試合`,
  titleOpen: (p) => `代表称号 ${p.name}、称号図鑑を開く`,
  prepOpen: (p) => `次のフェーズの準備を見る：${p.prep}`,
  storageFull: '保存容量が足りず、進行状況を保存できませんでした。設定でバックアップしてください。',
  actEvent: '⚡ イベントを確認',
  actSeasonEnd: 'シーズン総括を見る',
  actPreseason: 'プレシーズントレーニングを進める',
  actPlay: (p) => `トレーニング後に${p.n}試合を進める`,
  prep: (p) => `トレーニング ${p.train} · 投資 ${p.invest} · コンディション ${p.cond}`,
  investNone: 'なし',
};
