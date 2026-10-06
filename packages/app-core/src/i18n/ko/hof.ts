// 기록실 탭·명예의 전당(웹 Hof.svelte · HallOfFame.svelte · HofPodium.svelte · HofRow.svelte, 앱 screens/hof/Hof.tsx ·
// components/HallOfFame · HofPodium · HofRow · Laurel · screens/hof/RecordsControls). 포지션·시즌·국가 이름은 게임 데이터라 옮기지 않는다.
import { iGa } from '../../format.js';
import { ns } from '../core';

const ko = {
  // 기록실 탭
  tabsLabel: '기록실',
  tabLegends: '명예의 전당',
  tabRn: '영구결번',
  tabTeams: '팀 랭킹',
  tabAch: '구단주 랭킹',
  title: '명예의 전당',
  // 순위 유형
  sortScore: '레전드 점수',
  sortValue: '은퇴 가치',
  sortGoals: '득점',
  sortAssists: '도움',
  sortGa: '공격포인트',
  sortApps: '출전',
  sortTrophies: '트로피',
  sortAwards: '개인상',
  sortBallon: '발롱도르',
  sortCaps: 'A매치',
  sortPeak: '최고 OVR',
  unitGoals: '골',
  unitAssists: '도움',
  unitPoints: 'P',
  unitGames: '경기',
  unitCount: '개',
  unitTimes: '회',
  // 필터
  season: '시즌',
  seasonAria: '기록 시즌',
  allSeasons: '전체 시즌',
  notOpen: ' (개막 예정)',
  filter: '필터',
  filterLabel: (p: { pos: string; sort: string }) => `필터, ${p.pos}, ${p.sort}`,
  filterA11y: (p: { label: string }) => `필터, ${p.label}`,
  allPositions: '전체 포지션',
  searchLabel: '선수 이름 검색',
  positionGroup: '포지션',
  all: '전체',
  rankBasis: '순위 기준',
  sortGroup: '순위 유형',
  // 목록
  opens: (p: { name: string; when: string }) => `${p.name}은 ${p.when}(한국 시각)에 개막해요.`,
  opensNote:
    "개막 뒤 새로 만든 선수가 은퇴하면 여기에 올라요. 지금(프리시즌) 만든 선수는 '프리시즌'과 '전체' 명예의 전당에 남아요.",
  loading: '불러오는 중…',
  loadFailed: '명예의 전당을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  source: (p: { scope: string; q: string; sort: string; isScore: boolean; total: number }) =>
    `${p.scope && `${p.scope}· `}${p.q ? `'${p.q}' 검색 ` : ''}${p.isScore ? '은퇴 선수' : `${p.sort} 기록이 있는 선수`} ${p.total}명 · ${p.sort} 순`,
  homeSource: (p: { season: string }) => `${p.season} · 레전드 점수 순`,
  listHead: '선수',
  emptyQuery: (p: { q: string; scope: string }) =>
    `'${p.q}'${iGa(p.q)} 들어간 이름의 ${p.scope}선수가 없어요.`,
  emptyScore: (p: { scope: string }) => `아직 ${p.scope}은퇴 선수가 없어요.`,
  emptySort: (p: { scope: string; sort: string }) =>
    `아직 ${p.sort} 기록이 있는 ${p.scope}은퇴 선수가 없어요.`,
  pagerLabel: '명예의 전당 페이지',
  prev: '← 이전',
  next: '다음 →',
  // 행·포디엄
  mine: '내 선수',
  rankN: (p: { rank: number }) => `${p.rank}위`,
  podiumLabel: (p: { label: string }) => `${p.label} 상위 3명`,
  podiumPlayer: (p: {
    rank: number;
    name: string;
    country: string;
    label: string;
    value: string;
    unit: string;
  }) => `${p.rank}위 ${p.name}, ${p.country}, ${p.label} ${p.value}${p.unit}, 상세 기록 보기`,
  podiumPlayerApp: (p: {
    rank: number;
    name: string;
    country: string;
    pos: string;
    value: string;
    unit: string;
    mine: boolean;
  }) =>
    `${p.rank}위 ${p.name}, ${p.country}${p.pos ? `, ${p.pos}` : ''}, ${p.value}${p.unit}${p.mine ? ', 내 선수' : ''}`,
  rnChipTitle: (p: { number: number }) => `영구결번 ${p.number}번`,
  rnChip: (p: { number: number }) => `👑 영결 ${p.number}`,
  rowStats: (p: {
    apps: number;
    goals: number;
    assists: number;
    trophies: number;
    peak: number;
    ballon: number;
    score: number | null;
  }) =>
    `${p.apps}경기 ${p.goals}골 ${p.assists}도움 · 트로피 ${p.trophies} · 최고 OVR ${p.peak}${p.ballon ? ` · 발롱도르 ${p.ballon}회` : ''}${p.score != null ? ` · 레전드 ${p.score}` : ''}`,
  appsN: (p: { n: string }) => `${p.n}경기`,
  goalsN: (p: { n: string }) => `${p.n}골`,
  assistsN: (p: { n: string }) => `${p.n}도움`,
};

export type HofMsgs = typeof ko;
export const hofText = ns('hof', ko);
