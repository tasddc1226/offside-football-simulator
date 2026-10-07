import type { Translation } from '@offside/contracts/i18n';
import type { GNationalMsgs } from '../ko/gNational';

// 저장된 라이벌전 이름(한국어) → 일본어.
const RIVAL: Record<string, string> = {
  한일전: '日韓戦',
  '남미 최고의 라이벌전': '南米最大のライバル対決',
  '잉글랜드-독일전': 'イングランド対ドイツ',
  '독일-네덜란드전': 'ドイツ対オランダ',
  '네덜란드-독일전': 'オランダ対ドイツ',
  '이베리아 더비': 'イベリアダービー',
  '프랑스-이탈리아전': 'フランス対イタリア',
  '이탈리아-프랑스전': 'イタリア対フランス',
  '북중미 라이벌전': '北中米ライバル対決',
};
const REGION: Record<string, string> = {
  AFC: 'アジア',
  UEFA: '欧州',
  CONMEBOL: '南米',
  CAF: 'アフリカ',
  CONCACAF: '北中米カリブ海',
  OFC: 'オセアニア',
};

export const gNational: Translation<GNationalMsgs> = {
  rivalLabel: (p) => RIVAL[p.ko] ?? 'ライバル対決',
  rivalWin: (p) => `${p.label}で勝利！${p.g ? `${p.g}ゴールを決め、` : ''}国民的英雄になりました。`,
  debut: (p) => `キャリア初のA代表選出！（${p.name}）`,
  windowName: (p) => `${p.m}月の国際Aマッチ`,
  friendly: '国際親善試合',
  wcQual: (p) => `${p.year} ワールドカップ ${REGION[p.conf] ?? p.region}予選`,
  score: (p) => `${p.team} ${p.kg}-${p.og} ${p.opp}${p.pso ? `（PK戦 ${p.pso}）` : ''}`,
  matchLog: (p) =>
    `[${p.comp}] ${p.score}${p.mins ? ` · ${p.mins}分${p.g ? ` ${p.g}ゴール` : ''}${p.a ? ` ${p.a}アシスト` : ''}` : ' · ベンチ'}`,
  captain: '代表チームのキャプテンに任命されました。',
  whyInjury: 'ケガで最終メンバー外',
  whyCut: '最終メンバーから落選',
  whyRefused: '所属クラブが招集を拒否',
  whyWildcard: 'オーバーエイジ枠で選出',
};
