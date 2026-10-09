// 시즌 업적 · 구단주 랭킹 · 팀 랭킹 · 팀 프로필(웹 team/TeamAchievements · AchievementRanking · TeamRanking · TeamProfile,
// 앱 screens/owner/TeamAchievements · screens/hof/team/*). 웹·앱 문구가 다른 줄은 Web/App 접미사로 나눈다.
import { ns } from '../core';

const ko = {
  // 시즌 업적
  achTitle: '시즌 업적',
  seasonLabel: '시즌',
  achLoadFail: '업적을 불러오지 못했어요.',
  pts: '점',
  rankTitle: '구단주 랭킹',
  nextGradeBar: '다음 등급까지',
  toNextGrade: (p: { grade: string; pts: string }) => `${p.grade}까지 ${p.pts}점`,
  topGrade: '최고 등급이에요',
  achProgress: (p: { head: string; done: number; total: number }) =>
    `${p.head} · 업적 ${p.done}/${p.total} 달성`,
  achAbout: (p: { season: string; n: number }) =>
    `${p.season}에 처음 뛰어 은퇴한 내 선수 ${p.n}명과 이 시즌 팀·구단 활동으로 채워요. 시즌마다 처음부터 다시 쌓아요.`,
  // 업적을 쌓으면 — 실제로 업적 점수가 쓰이는 곳만 적는다(경기 실력에는 들어가지 않는다).
  perksTitle: '업적을 쌓으면',
  perkGrade: '점수에 따라 구단주 등급이 루키부터 레전드까지 오르고, 구단주 랭킹 순위가 매겨져요.',
  perkTier: '시즌이 끝날 때의 등급이 다음 시즌 내내 프로필·댓글·채팅 닉네임 옆에 티어로 붙어요.',
  perkHonor: '구단주 랭킹 1위·상위 10위·상위 100위 안에 들면 시즌 결산에 휘장이 영구히 남아요.',
  perkNote: '업적 점수는 경기 결과에는 영향을 주지 않아요.',
  nextGoal: '다음 목표',
  worthPlus: (p: { n: string }) => `+${p.n}점`,
  catsAria: '업적 분류',
  managerSoonTitle: '감독 커리어',
  managerSoonNote:
    '감독 시뮬레이션이 열리면 감독으로 거둔 성적도 업적이 돼요. 선수·팀·구단주 업적처럼 시즌마다 새로 쌓여요.',
  managerSoonAria:
    '감독 커리어 업적, 곧 열려요. 감독 시뮬레이션이 열리면 감독으로 거둔 성적도 업적이 돼요.',
  groupAria: (p: { stage: string; title: string; done: number; total: number }) =>
    `${p.stage} ${p.title} ${p.done}/${p.total} 달성`,
  scoreAria: (p: { n: string }) => `시즌 업적 점수 ${p.n}점`,
  rankAria: (p: { text: string }) => `구단주 랭킹 ${p.text}`,
  catLocked: '잠김',
  catScore: (p: { n: string }) => `${p.n}점`,
  catAria: (p: { name: string; state: string }) => `${p.name} ${p.state}`,
  // 구단주 랭킹
  rankSeasonAria: '구단주 랭킹 시즌',
  ownersBefore: '참여 구단주 ',
  ownersAfter: '명',
  ownersApp: (p: { n: string }) => `구단주 ${p.n}명`,
  rankFail: '랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  loading: '불러오는 중…',
  hdrOwner: '구단주',
  hdrGrade: '등급',
  hdrDone: '업적',
  hdrDoneTitle: '달성 업적',
  hdrScore: '점수',
  hdrRankApp: '순위',
  ownerListAria: '업적 점수 순 구단주 랭킹',
  anonOwner: '익명 구단주',
  noTeam: '팀 없음',
  rowAria: (p: { rank: number; name: string; grade: string; done: string; score: string }) =>
    `${p.rank}위 ${p.name}, ${p.grade}, 업적 ${p.done}개 달성, ${p.score}점`,
  rowAriaTeam: (p: { label: string }) => `${p.label}, 팀 상세 보기`,
  doneTitle: (p: { n: string }) => `업적 ${p.n}개 달성`,
  scoreTitle: (p: { n: string }) => `${p.n}점`,
  rowStatsApp: (p: { done: string; players: string }) => `업적 ${p.done}개 · 선수 ${p.players}명`,
  gradeAria: (p: { name: string }) => `등급 ${p.name}`,
  rowAriaApp: (p: {
    rank: number;
    name: string;
    grade: string;
    score: string;
    done: number;
    players: number;
    team: string;
  }) =>
    `${p.rank}위 ${p.name}, ${p.grade}, ${p.score}점, 업적 ${p.done}개, 선수 ${p.players}명, ${p.team} 팀 상세 보기`,
  pagerAria: '랭킹 페이지',
  prev: '← 이전',
  next: '다음 →',
  ownersEmpty:
    '아직 랭킹에 오른 구단주가 없어요. 은퇴한 선수로 시즌 업적을 달성하면 여기에 올라요.',
  gradesTitle: '등급 기준',
  gradesToggleApp: (p: { open: boolean }) => `${p.open ? '▾' : '▸'} 등급 기준`,
  gradeFrom: (p: { n: string }) => `${p.n}점부터`,
  noteReset: '시즌마다 처음부터 다시 쌓아요.',
  noteSum: '선수·팀·구단주 업적 점수의 합이고, 랭킹은 5분마다 갱신돼요.',
  noteApp:
    '시즌마다 처음부터 다시 쌓아요. 선수·팀·구단주 업적 점수의 합이고, 랭킹은 5분마다 갱신돼요.',
  // 팀 랭킹
  sortRating: '레이팅',
  sortOvr: '팀 OVR',
  sortValue: '구단 가치',
  colOvrApp: 'OVR',
  formWin: '승리',
  formDraw: '무승부',
  formLoss: '패배',
  formNone: '경기 기록 없음',
  teamSeasonAria: '팀 랭킹 시즌',
  teamsBefore: '참가 팀 ',
  teamsAfter: '개',
  teamsApp: (p: { n: string }) => `팀 ${p.n}개`,
  sortLabel: '정렬',
  sortGroupAria: '순위 유형',
  formGuide: '최근 5경기 · 왼쪽이 최신 경기예요.',
  colTeam: '팀',
  colPlayed: '경기',
  colWin: '승',
  colDraw: '무',
  colLoss: '패',
  teamListAria: (p: { metric: string }) => `${p.metric} 순 팀 랭킹`,
  teamRowAria: (p: {
    rank: number;
    name: string;
    played: string;
    w: string;
    d: string;
    l: string;
    metric: string;
    value: string;
    form: string;
  }) =>
    `${p.rank}위 ${p.name}, ${p.played}경기 ${p.w}승 ${p.d}무 ${p.l}패, ${p.metric} ${p.value}, 최근 경기부터 ${p.form}, 팀 상세 보기`,
  playedTitle: (p: { n: string }) => `${p.n}경기`,
  winTitle: (p: { n: string }) => `${p.n}승`,
  drawTitle: (p: { n: string }) => `${p.n}무`,
  lossTitle: (p: { n: string }) => `${p.n}패`,
  formDot: (p: { i: number; label: string }) => `${p.i}번째 최근 경기: ${p.label}`,
  teamsEmpty:
    '아직 랭킹에 오른 팀이 없어요. 구단주 화면에서 은퇴한 선수로 팀을 꾸리면 여기에 올라요.',
  teamsFoot: '레이팅은 팀 경기 결과로 오르내려요. 랭킹은 5분마다 갱신돼요.',
  valueFoot: '구단 가치는 선발 11명의 카드 기준가를 더한 값이에요. 랭킹은 5분마다 갱신돼요.',
  // T-11-129 홈의 구단 가치 TOP 3
  homeValueTitle: '구단 가치 TOP 3',
  homeValueSub: '선발 11명의 카드 기준가를 더했어요.',
  homeValueEmpty: '아직 랭킹에 오른 팀이 없어요.',
  homeValueRowAria: (p: { rank: number; name: string; manager: string; value: string }) =>
    `${p.rank}위 ${p.name}, 감독 ${p.manager}, 구단 가치 ${p.value}, 팀 상세 보기`,
  // 팀 프로필
  profLoadFail: '팀을 불러오지 못했어요.',
  profManager: '감독 ',
  profMine: ' · 내 팀',
  profOwner: '구단주 ',
  profRatingAria: (p: { n: number }) => `팀 레이팅 ${p.n}`,
  profStatOvr: '팀 OVR',
  profStatRecord: '전적',
  profStatGoals: '득실',
  profLikeAria: (p: { n: number }) => `좋아요 ${p.n}`,
  profViews: '조회수 ',
  profHistoryTitle: '팀 히스토리',
  profHistoryEmpty: '아직 기록이 없어요. 팀 경기와 시즌 순위 배지가 여기에 쌓여요.',
};

export type TeamAchMsgs = typeof ko;
export const teamAchText = ns('teamAch', ko);
