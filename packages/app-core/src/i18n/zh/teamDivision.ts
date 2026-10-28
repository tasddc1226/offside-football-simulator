import type { Translation } from '../core';
import type { TeamDivisionMsgs } from '../ko/teamDivision';

export const teamDivision: Translation<TeamDivisionMsgs> = {
  d0: '業餘',
  d1: '半職業 II',
  d2: '半職業 I',
  d3: '職業 II',
  d4: '職業 I',
  d5: '菁英 II',
  d6: '菁英 I',
  d7: '大師',
  label: '分級',
  toNext: (p) => `距離${p.name}還差 ${p.n} 分`,
  top: '已是最高分級',
  guard: (p) => `降級保護中 · 再掉 ${p.n} 分就會降級`,
  progressAria: (p) => `${p.name}分級，距離下一分級 ${p.pct}%`,
  promoted: (p) => `升上${p.name}！`,
  relegated: (p) => `降到${p.name}了`,
  promotedBody: '比賽結果讓分級提升了。',
  relegatedBody: '把 RP 再提升上去就能回來。',
  changedAway: (p) => `因應戰比賽的結果，分級變為${p.name}`,
  tabAll: '全部',
  tabsAria: '分級',
  countLine: (p) => `${p.s} 支球隊`,
  myDivision: '我的分級',
  emptyDivision: '這個分級還沒有球隊。',
  rewardNote: (p) =>
    `自 ${p.from} 結算起，賽季結算時分級在職業 II 以上即可獲得徽章與重抽券。需在該賽季進行 ${p.matches} 場以上排位賽，且先發退役球員 8 人以上。`,
  rewardTitle: '賽季獎勵',
  previewNote: '本賽季只顯示分級，沒有獎勵。',
};
