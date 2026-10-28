import type { Translation } from '../core';
import type { RatingReportMsgs } from '../ko/ratingReport';

export const ratingReport: Translation<RatingReportMsgs> = {
  partsTitle: '評分組成 · 每場平均',
  partBase: '基本',
  partGoals: '進球',
  partAssists: '助攻',
  partOvrEdge: 'OVR 優勢',
  partCond: '狀態',
  partMorale: '士氣',
  partForm: '當天表現',
  partCs: '零失球',
  partDef: '防守貢獻',
  partResult: '球隊戰果',
  partLuck: '其他波動',
  partsAria: (p) => `評分組成：${p.list}`,
  dirTitle: '成長方向',
  dirGoal: (p) =>
    `進球最看重${p.attr}，比重 ${p.pct}%。目前比聯賽平均${p.up ? '高' : '低'} ${p.n}。`,
  dirAssist: (p) =>
    `助攻最看重${p.attr}，比重 ${p.pct}%。目前比聯賽平均${p.up ? '高' : '低'} ${p.n}。`,
  dirKnee: '攻擊能力值已明顯高於聯賽平均，再往上提升，進球和助攻也只會小幅增加。',
  dirDef: (p) => `防守能力值高於聯賽平均多少，評分就加多少。目前${p.up ? '高' : '低'} ${p.n}。`,
};
