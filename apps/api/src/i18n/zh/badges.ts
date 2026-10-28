// T-11-553 팀 히스토리 배지의 번체 중국어(id별). 구조는 team/badges.ts의 영어 표와 같다.
export const BADGES_ZH: Record<string, { label: string; desc: string }> = {
  debut: { label: '初登場', desc: '踢了第一場比賽' },
  'first-win': { label: '首勝', desc: '拿下第一場勝利' },
  full: { label: '完整陣容', desc: '不用青訓球員就湊滿 11 人' },
  'streak-3': { label: '3 連勝', desc: '連續贏下 3 場比賽' },
  rout: { label: '大勝', desc: '以 4 球以上的差距獲勝' },
  'wins-10': { label: '10 勝', desc: '贏了 10 場' },
  'streak-5': { label: '5 連勝', desc: '連續贏下 5 場比賽' },
  'goals-100': { label: '100 球', desc: '在球隊賽中攻進 100 球' },
  'likes-10': { label: '人氣球隊', desc: '收到 10 個「讚」' },
  'wins-30': { label: '30 勝', desc: '贏了 30 場' },
  'streak-10': { label: '10 連勝', desc: '連續贏下 10 場比賽' },
  'wins-100': { label: '100 勝', desc: '贏了 100 場' },
  'final-1': { label: '賽季冠軍', desc: '' },
  'final-3': { label: '賽季前 3 名', desc: '' },
  'final-10': { label: '賽季前 10 名', desc: '' },
};

export const finalRankZh = (seasonName: string, rank: number) => `${seasonName} 最終第 ${rank} 名`;
