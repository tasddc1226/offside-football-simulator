// T-11-140 업적 문구의 일본어. 구조는 team/achievementsText.ts의 영어 표와 같다.
export const tenureLabels = {
  'one-club': 'ワンクラブマン',
  'long-service': '長期在籍',
} as const;

export const GROUP_JA: Record<string, { stage: string; title: string }> = {
  first: { stage: 'ステージ0', title: 'サッカー人生のスタート' },
  records: { stage: 'ステージ1', title: '記録を積み上げる' },
  collection: { stage: 'ステージ2', title: '記録のかけらを集める' },
  legend: { stage: 'ステージ3', title: '伝説の1人' },
  world: { stage: 'ステージ4', title: '世界の舞台を制す' },
  immortal: { stage: 'ステージ5', title: '不滅のクラブ' },
  team: { stage: 'TEAM', title: '自分だけの最強チーム' },
  race: { stage: 'RACE', title: 'シーズンレース' },
  owner: { stage: 'OWNER', title: 'クラブ運営' },
  manager: { stage: 'MANAGER', title: '監督キャリア' },
};

export const LABEL_JA: Record<string, string> = {
  // 0단계
  'retire-FW': 'FWを1人引退させる',
  'retire-MF': 'MFを1人引退させる',
  'retire-DF': 'DFを1人引退させる',
  'retire-GK': 'GKを1人引退させる',
  'national-win': '初の国際大会優勝',
  europe: '初のヨーロッパ進出',
  'retired-number': '初の永久欠番',
  poty: '初のリーグ年間最優秀選手',
  ballon: '初のバロンドール',
  'team-win': 'チーム戦初勝利',
  'all-dpos': '全詳細ポジションの選手を輩出',
  // 1단계
  goals: 'ゴール',
  assists: 'アシスト',
  apps: '出場',
  caps: '代表出場',
  trophies: '優勝',
  awards: '個人賞',
  legend: 'レジェンドスコア',
  // 2단계
  'all-league-win': '全リーグ優勝',
  'all-top-scorer': '全リーグ得点王',
  'all-poty': '全リーグ年間最優秀選手',
  young: '最優秀若手選手賞を集める',
  big5: '5大リーグすべてでプレー',
  'all-dpos-ballon': '全詳細ポジションでバロンドール',
  // 3단계
  ...tenureLabels,
  'caps-150': '代表150試合の選手',
  'goals-500': '通算500ゴールの選手',
  'season-50': '1シーズン50ゴール',
  'gk-cs-20': 'GKで1シーズン無失点20試合',
  treble: '1シーズンで三冠',
  'ballon-3': 'バロンドール3回の選手',
  // 4단계
  'world-cup': 'FIFAワールドカップ優勝',
  'conf-cup': '大陸カップ優勝',
  olympic: 'オリンピック金メダル',
  ucl: 'UEFAチャンピオンズリーグ優勝',
  'club-wc': 'FIFAクラブワールドカップ優勝',
  'golden-shoe': 'ヨーロッパ・ゴールデンシュー',
  'all-continental': '大陸クラブ大会をすべて制覇',
  nations: '国籍の違う選手5人',
  // 5단계
  'rn-11': '永久欠番11人',
  'ballon-30': 'バロンドール合計30回',
  'ballon-pos': '4ポジションすべてでバロンドール',
  'world-cup-3': 'ワールドカップ優勝3回',
  'ballon-10': 'バロンドール10回の選手',
  'goals-800': '通算800ゴールの選手',
  'legend-3000': 'レジェンドスコア3,000点の選手',
  // 팀
  'team-one': 'チームに選手を1人登録',
  'team-full': 'ユースなしで11人をそろえる',
  'team-fit': '11人全員が本職のポジション',
  'team-caps': '11人全員が代表経験者',
  'team-club': '11人全員が同じクラブ出身',
  'team-rn': '11人全員が永久欠番',
  'team-wins': 'チーム戦勝利',
  'team-streak': '最多連勝',
  'team-margin': '5点差以上で勝利',
  'team-goals': 'チーム得点',
  'team-rating': 'チームレーティング',
  'team-likes': 'もらった「いいね」',
  // 구단주
  'owner-nickname': '公開ニックネームを決める',
  'owner-players': '引退させた選手',
  'owner-retire-days': '選手を引退させた日数',
  'owner-match-days': 'チーム戦をした日数',
  'owner-likes': '他チームへの応援（いいね）',
};

/** 단계 업적의 단위(숫자 바로 뒤에 붙는다). */
export const UNIT_JA: Record<string, string> = {
  goals: 'ゴール',
  assists: 'アシスト',
  apps: '試合',
  caps: '試合',
  trophies: '回',
  awards: '回',
  legend: '点',
  'team-wins': '勝',
  'team-streak': '連勝',
  'team-goals': 'ゴール',
  'team-rating': '点',
  'team-likes': '個',
  'owner-players': '人',
  'owner-retire-days': '日',
  'owner-match-days': '日',
  'owner-likes': '回',
};

/** '○○세까지 현역'(시즌마다 나이가 다르다). */
export const ageLabelJa = (age: string) => `${age}歳まで現役`;
