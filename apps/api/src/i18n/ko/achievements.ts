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
  // T-11-310 감독 업적(그 시즌에 끝낸 감독 커리어)
  'mgr-first': '감독 커리어 마치기',
  'mgr-count': '키운 감독',
  'mgr-title': '리그 우승 감독',
  'mgr-promote': '승격시킨 감독',
  'mgr-mastery': '포메이션 숙련 S 감독',
  'mgr-grade': 'S등급 감독',
  'mgr-coach': '감독 칸 채우기',
  // T-11-541 시즌 2부터: 한 시즌의 위업
  's-assists-30': '한 시즌 30도움',
  's-teen-20': '10대에 한 시즌 20골',
  's-veteran-20': '35세가 넘어 한 시즌 20골',
  's-double': '같은 시즌 리그 우승과 득점왕',
  's-young-ballon': '21세 이하 발롱도르',
  's-quadruple': '한 시즌 클럽 우승 4개',
  's-ballon-treble': '트레블 시즌에 발롱도르까지',
  // 커리어의 모양
  'c-journeyman': '한 선수가 다섯 리그에서 뛰기',
  'c-df-50': '통산 50골 수비수',
  'c-peak': '최고 OVR',
  'c-ballon-players': '발롱도르를 받은 선수',
  'c-legends': '레전드 점수 1,000점 선수',
  'secret-farewell': '우승하고 떠난 마지막 시즌',
  'secret-homecoming': '첫 구단으로 돌아와 은퇴',
  // 경기 장면
  'team-cup-qf': '오프사이드 컵 8강',
  'team-clean': '무실점 승리',
  'team-thrash': '4골 차 이상 승리',
  'team-six': '한 경기 6골',
  'team-winrate': '승률 70%',
  'team-wall': '경기당 실점 1골 미만',
  // 감독
  'mgr-titles': '감독 리그 우승 합계',
  'mgr-double': '우승과 승격을 모두 해낸 감독',
};

/** T-11-541 단계 업적 단위(업적 id → 단위). */
export const achievementUnits: Record<string, string> = {
  'c-peak': '',
  'c-ballon-players': '명',
  'c-legends': '명',
  'team-clean': '승',
  'team-thrash': '승',
  'mgr-titles': '회',
};

/** T-11-541 숨은 업적: 달성하기 전 이름과 업적마다 힌트. */
export const hiddenAchievement = {
  label: '숨은 업적',
  descs: {
    'secret-farewell': '한 선수의 마지막 시즌에 일어나는 일이에요.',
    'secret-homecoming': '여러 구단을 거친 선수의 마지막 선택이에요.',
  } as Record<string, string>,
};

/** T-11-310 감독 업적 단위. */
export const managerUnits: Record<string, string> = { 'mgr-count': '명' };

/** T-11-237 새 업적 묶음(그룹 id → 단계 표시·제목). */
export const achievementGroups: Record<string, { stage: string; title: string }> = {
  beyond: { stage: '6단계', title: '전설 너머' },
  // T-11-541 시즌 2부터
  season: { stage: '시즌', title: '한 시즌의 위업' },
  career: { stage: '커리어', title: '커리어의 모양' },
  match: { stage: 'MATCH', title: '경기 장면' },
};

/** T-11-237 이름만으로 헷갈리는 업적의 판정 기준(업적 id → 한 줄). */
export const achievementDescs: Record<string, string> = {
  'team-mates':
    '커리어 중 한 시즌이라도 같은 프로 구단에서 뛰었으면 돼요. 고교·대학·병역 시즌은 세지 않아요.',
  'team-club': '은퇴할 때 마지막으로 뛴 구단이 11명 모두 같아야 해요.',
  // T-11-541
  's-teen-20': '19세 이하 시즌에 20골을 넣으면 돼요.',
  's-veteran-20': '35세 이상 시즌에 20골을 넣으면 돼요.',
  's-quadruple':
    '리그 · 컵 · 대륙 대회 같은 클럽 우승을 한 시즌에 4개 들면 돼요. 슈퍼컵 · 클럽 월드컵 · 대표팀 우승은 세지 않아요.',
  'c-journeyman': '병역 시즌을 빼고 프로 리그 다섯 곳 이상에서 뛰면 돼요.',
  'team-clean': '내가 건 경기에서 실점 없이 이긴 경기를 세요.',
  'team-thrash': '내가 건 경기에서 4골 차 이상으로 이긴 경기를 세요.',
  'team-six': '내가 건 경기에서 한 번에 6골 이상 넣으면 돼요.',
  'team-winrate': '50경기 이상 치르고 승률이 70% 이상이면 돼요.',
  'team-wall': '30경기 이상 치르고 실점이 경기 수보다 적으면 돼요.',
};
