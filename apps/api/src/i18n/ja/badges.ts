// T-11-140 팀 히스토리 배지의 일본어(id별). 구조는 team/badges.ts의 영어 표와 같다.
export const BADGES_JA: Record<string, { label: string; desc: string }> = {
  debut: { label: 'デビュー戦', desc: '初めての試合を戦った' },
  'first-win': { label: '初勝利', desc: '初めての勝利を挙げた' },
  full: { label: 'フルスカッド', desc: 'ユースなしで11人をそろえた' },
  'streak-3': { label: '3連勝', desc: '3試合続けて勝った' },
  rout: { label: '大勝', desc: '4点差以上で勝った' },
  'wins-10': { label: '10勝', desc: '10回勝った' },
  'streak-5': { label: '5連勝', desc: '5試合続けて勝った' },
  'goals-100': { label: '100ゴール', desc: 'チーム戦で100ゴールを決めた' },
  'likes-10': { label: '人気クラブ', desc: '「いいね」を10個もらった' },
  'wins-30': { label: '30勝', desc: '30回勝った' },
  'streak-10': { label: '10連勝', desc: '10試合続けて勝った' },
  'wins-100': { label: '100勝', desc: '100回勝った' },
  'final-1': { label: 'シーズン優勝', desc: '' },
  'final-3': { label: 'シーズンTOP 3', desc: '' },
  'final-10': { label: 'シーズンTOP 10', desc: '' },
};

export const finalRankJa = (seasonName: string, rank: number) => `${seasonName} 最終${rank}位`;
