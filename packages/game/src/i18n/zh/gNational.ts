import type { Translation } from '@offside/contracts/i18n';
import type { GNationalMsgs } from '../ko/gNational';

// 저장된 라이벌전 이름(한국어) → 번체 중국어.
const RIVAL: Record<string, string> = {
  한일전: '韓日大戰',
  '남미 최고의 라이벌전': '南美最強宿敵對決',
  '잉글랜드-독일전': '英格蘭對德國',
  '독일-네덜란드전': '德國對荷蘭',
  '네덜란드-독일전': '荷蘭對德國',
  '이베리아 더비': '伊比利德比',
  '프랑스-이탈리아전': '法國對義大利',
  '이탈리아-프랑스전': '義大利對法國',
  '북중미 라이벌전': '中北美宿敵對決',
};
const REGION: Record<string, string> = {
  AFC: '亞洲',
  UEFA: '歐洲',
  CONMEBOL: '南美',
  CAF: '非洲',
  CONCACAF: '中北美洲及加勒比海',
  OFC: '大洋洲',
};

export const gNational: Translation<GNationalMsgs> = {
  rivalLabel: (p) => RIVAL[p.ko] ?? '宿敵對決',
  rivalWin: (p) => `${p.label}獲勝！${p.g ? `攻進${p.g}球，` : ''}成為國民英雄。`,
  debut: (p) => `生涯首度入選國家隊！（${p.name}）`,
  windowName: (p) => `${p.m}月國際A級賽`,
  friendly: '國際友誼賽',
  wcQual: (p) => `${p.year} 世界冠軍賽 ${REGION[p.conf] ?? p.region}區資格賽`,
  score: (p) => `${p.team} ${p.kg}-${p.og} ${p.opp}${p.pso ? `（PK大戰 ${p.pso}）` : ''}`,
  matchLog: (p) =>
    `[${p.comp}] ${p.score}${p.mins ? ` · ${p.mins}分鐘${p.g ? ` ${p.g}球` : ''}${p.a ? ` ${p.a}助攻` : ''}` : ' · 板凳'}`,
  captain: '被任命為國家隊隊長。',
  whyInjury: '因傷落選最終名單',
  whyRetired: '已退出國家隊',
  whyCut: '落選最終名單',
  whyRefused: '俱樂部拒絕放人',
  whyWildcard: '以超齡名額入選',
  whyQuit: '已宣布拒絕國家隊徵召',
};
