export const tenureLabels = {
  'one-club': '원클럽맨',
  'long-service': '장기근속',
} as const;

/** T-11-237 새 업적 이름(업적 id → 이름). */
export const achievementLabels: Record<string, string> = {
  'team-mates': '11명 모두 같은 구단에서 뛴 적 있음',
  // 6단계 전설 너머
  'ballon-15': '발롱도르 15회 선수',
  'goals-1000': '통산 1,000골 선수',
  'legend-4000': '레전드 점수 4,000점 선수',
  'ballon-100': '발롱도르 합계 100회',
  'world-cup-5': '월드 챔피언십 우승 5번',
  'big5-one': '한 선수가 빅5 리그 모두 우승',
  // 팀 드림팀
  'team-ballon': '11명 모두 발롱도르 수상자',
  'team-nation': '11명 모두 같은 국적',
  'team-ovr95': '11명 모두 최고 OVR 95 이상',
  'team-cup-sf': '오프사이드 컵 4강',
  'team-cup-win': '오프사이드 컵 우승',
};

/** T-11-237 새 업적 묶음(그룹 id → 단계 표시·제목). */
export const achievementGroups: Record<string, { stage: string; title: string }> = {
  beyond: { stage: '6단계', title: '전설 너머' },
};

/** T-11-237 이름만으로 헷갈리는 업적의 판정 기준(업적 id → 한 줄). */
export const achievementDescs: Record<string, string> = {
  'team-mates':
    '커리어 중 한 시즌이라도 같은 프로 구단에서 뛰었으면 돼요. 고교·대학·병역 시즌은 세지 않아요.',
  'team-club': '은퇴할 때 마지막으로 뛴 구단이 11명 모두 같아야 해요.',
};
