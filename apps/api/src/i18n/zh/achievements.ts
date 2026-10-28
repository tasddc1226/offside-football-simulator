// T-11-553 업적 문구의 번체 중국어. 구조는 team/achievementsText.ts의 영어 표와 같다.
export const tenureLabels = {
  'one-club': '一人一隊',
  'long-service': '長期效力',
} as const;

export const GROUP_ZH: Record<string, { stage: string; title: string }> = {
  first: { stage: '階段 0', title: '足球人生的起點' },
  records: { stage: '階段 1', title: '累積紀錄' },
  collection: { stage: '階段 2', title: '收集紀錄碎片' },
  legend: { stage: '階段 3', title: '成為傳奇' },
  world: { stage: '階段 4', title: '稱霸世界舞台' },
  immortal: { stage: '階段 5', title: '不朽的球隊' },
  beyond: { stage: '階段 6', title: '超越傳奇' },
  team: { stage: 'TEAM', title: '親手打造的最強球隊' },
  race: { stage: 'RACE', title: '賽季競賽' },
  owner: { stage: 'OWNER', title: '球隊經營' },
  manager: { stage: 'MANAGER', title: '總教練生涯' },
};

export const LABEL_ZH: Record<string, string> = {
  // 0단계
  'retire-FW': '讓 1 名前鋒退役',
  'retire-MF': '讓 1 名中場退役',
  'retire-DF': '讓 1 名後衛退役',
  'retire-GK': '讓 1 名門將退役',
  'national-win': '首座國際大賽冠軍',
  europe: '首次進軍歐洲',
  'retired-number': '首個退休背號',
  poty: '首次獲得聯賽年度最佳球員',
  ballon: '首座金球獎',
  'team-win': '球隊賽首勝',
  'all-dpos': '培養出所有細分位置的球員',
  // 1단계
  goals: '進球',
  assists: '助攻',
  apps: '出賽',
  caps: '國家隊出賽',
  trophies: '冠軍',
  awards: '個人獎項',
  legend: '傳奇分數',
  // 2단계
  'all-league-win': '拿下所有聯賽冠軍',
  'all-top-scorer': '所有聯賽金靴',
  'all-poty': '所有聯賽年度最佳球員',
  young: '收集最佳新人獎',
  big5: '踢遍五大聯賽',
  'all-dpos-ballon': '所有細分位置都拿過金球獎',
  // 3단계
  ...tenureLabels,
  'caps-150': '國家隊出賽 150 場的球員',
  'goals-500': '生涯 500 球的球員',
  'season-50': '單季 50 球',
  'gk-cs-20': '門將單季 20 場零失球',
  treble: '單季三冠王',
  'ballon-3': '3 座金球獎的球員',
  // 4단계
  'world-cup': '世界錦標賽冠軍',
  'conf-cup': '洲際盃賽冠軍',
  olympic: '奧運金牌',
  ucl: '歐洲冠軍聯賽冠軍',
  'club-wc': '世界俱樂部錦標賽冠軍',
  'golden-shoe': '歐洲金靴獎',
  'all-continental': '稱霸所有洲際俱樂部賽事',
  nations: '5 名不同國籍的球員',
  // 5단계
  'rn-11': '11 個退休背號',
  'ballon-30': '金球獎合計 30 座',
  'ballon-pos': '4 個位置都拿過金球獎',
  'world-cup-3': '世界錦標賽冠軍 3 次',
  'ballon-10': '10 座金球獎的球員',
  'goals-800': '生涯 800 球的球員',
  'legend-3000': '傳奇分數 3,000 分的球員',
  'ballon-15': '15 座金球獎的球員',
  'goals-1000': '生涯 1,000 球的球員',
  'legend-4000': '傳奇分數 4,000 分的球員',
  'ballon-100': '金球獎合計 100 座',
  'world-cup-5': '世界錦標賽冠軍 5 次',
  'big5-one': '同一名球員拿下五大聯賽所有冠軍',
  // 팀
  'team-one': '在球隊登錄 1 名球員',
  'team-full': '不用青訓球員湊滿 11 人',
  'team-fit': '11 人都踢本職位置',
  'team-caps': '11 人都有國家隊經歷',
  'team-mates': '11 人都曾在同一家俱樂部效力',
  'team-club': '11 人都出自同一家俱樂部',
  'team-rn': '11 人都是退休背號',
  'team-ballon': '11 人都是金球獎得主',
  'team-nation': '11 人國籍相同',
  'team-ovr95': '11 人最高 OVR 都在 95 以上',
  'team-cup-sf': 'OFFSIDE 盃 四強',
  'team-cup-win': 'OFFSIDE 盃 冠軍',
  'team-wins': '球隊賽勝場',
  'team-streak': '最多連勝',
  'team-margin': '贏 5 球以上',
  'team-goals': '球隊進球',
  'team-rating': '球隊評分',
  'team-rp': '球隊 RP',
  'team-likes': '收到的「讚」',
  // 구단주
  'owner-nickname': '設定公開暱稱',
  'owner-players': '退役的球員',
  'owner-retire-days': '讓球員退役的天數',
  'owner-match-days': '進行球隊賽的天數',
  'owner-likes': '為其他球隊加油（讚）',
  'mgr-first': '完成一段總教練生涯',
  'mgr-count': '培養的總教練',
  'mgr-title': '聯賽冠軍總教練',
  'mgr-promote': '帶隊升級的總教練',
  'mgr-mastery': '陣型熟練度 S 的總教練',
  'mgr-grade': 'S 級總教練',
  'mgr-coach': '補滿總教練席位',
};

/** 단계 업적의 단위(숫자 바로 뒤에 붙는다). */
export const UNIT_ZH: Record<string, string> = {
  goals: '球',
  assists: '次助攻',
  apps: '場',
  caps: '場',
  trophies: '次',
  awards: '次',
  legend: '分',
  'team-wins': '勝',
  'team-streak': '連勝',
  'team-goals': '球',
  'team-rating': '分',
  'team-rp': 'RP',
  'team-likes': '個',
  'owner-players': '人',
  'owner-retire-days': '天',
  'owner-match-days': '天',
  'owner-likes': '次',
  'mgr-count': '人',
};

/** '○○세까지 현역'(시즌마다 나이가 다르다). */
export const ageLabelZh = (age: string) => `${age} 歲仍是現役`;

export const DESC_ZH: Record<string, string> = {
  'team-mates':
    '只要生涯中曾有一個賽季在同一家職業俱樂部效力就算達成。高中、大學、服兵役的賽季不列入計算。',
  'team-club': '11 人退役時最後所屬的俱樂部必須相同。',
};
