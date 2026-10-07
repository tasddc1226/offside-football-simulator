import type { Translation } from '@offside/contracts/i18n';
import type { GCompsMsgs } from '../ko/gComps';
import { tn } from '../names';

// 저장된 단계 이름(한국어) → 일본어.
const ROUND: Record<string, string> = {
  '32강': 'ラウンド32',
  '16강': 'ラウンド16',
  '8강': '準々決勝',
  '4강': '準決勝',
  결승: '決勝',
  '녹아웃 PO': 'ノックアウトPO',
  '리그 페이즈': 'リーグフェーズ',
  '1라운드': '1回戦',
};
const round = (k: string) => ROUND[k] ?? tn(k);

export const gComps: Translation<GCompsMsgs> = {
  compLine: (p) => {
    const st = p.stage;
    if (st === '우승') return `${p.name} 優勝！`;
    if (st === '준우승') return `${p.name} 準優勝`;
    let m = /^(.+) 탈락$/.exec(st);
    if (m) return `${p.name} ${round(m[1]!)}敗退`;
    m = /^(.+) 통과$/.exec(st);
    if (m) return `${p.name} ${round(m[1]!)}突破`;
    m = /^(.+) 진출$/.exec(st);
    if (m) return `${p.name} ${round(m[1]!)}進出`;
    return `${p.name} ${tn(p.stage)}`;
  },
  contKoPass: (p) => `${p.name} 1回戦突破、ラウンド16進出`,
  leagueDirect: (p) => `${p.name} リーグフェーズ突破、ラウンド16にストレートイン（勝点${p.pts}）`,
  leaguePlayoff: (p) => `${p.name} ノックアウトPO進出（勝点${p.pts}）`,
  leagueOut: (p) => `${p.name} リーグフェーズ敗退（勝点${p.pts}）`,
  galaWin: 'バロンドール受賞！',
  galaRank: (p) => `バロンドール${p.rank}位（候補30人）`,
};
