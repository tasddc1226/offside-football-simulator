import type { Translation } from '@offside/contracts/i18n';
import type { GCompsMsgs } from '../ko/gComps';
import { tn } from '../names';

// 저장된 단계 이름(한국어) → 번체 중국어.
const ROUND: Record<string, string> = {
  '32강': '32強',
  '16강': '16強',
  '8강': '8強',
  '4강': '4強',
  결승: '決賽',
  '녹아웃 PO': '淘汰附加賽',
  '리그 페이즈': '聯賽階段',
  '1라운드': '第1輪',
};
const round = (k: string) => ROUND[k] ?? tn(k);

export const gComps: Translation<GCompsMsgs> = {
  compLine: (p) => {
    const st = p.stage;
    if (st === '우승') return `${p.name} 奪冠！`;
    if (st === '준우승') return `${p.name} 亞軍`;
    let m = /^(.+) 탈락$/.exec(st);
    if (m) return `${p.name} ${round(m[1]!)}出局`;
    m = /^(.+) 통과$/.exec(st);
    if (m) return `${p.name} 通過${round(m[1]!)}`;
    m = /^(.+) 진출$/.exec(st);
    if (m) return `${p.name} 晉級${round(m[1]!)}`;
    return `${p.name} ${tn(p.stage)}`;
  },
  contKoPass: (p) => `${p.name} 通過第1輪，晉級16強`,
  leagueDirect: (p) => `${p.name} 通過聯賽階段，直接晉級16強（積分${p.pts}）`,
  leaguePlayoff: (p) => `${p.name} 晉級淘汰附加賽（積分${p.pts}）`,
  leagueOut: (p) => `${p.name} 聯賽階段出局（積分${p.pts}）`,
  galaWin: '榮獲金球獎！',
  galaRank: (p) => `金球獎第${p.rank}名（30人候選）`,
};
