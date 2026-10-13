// T-11-231 명예의 전당 공개 페이지(웹 워커 public-legends.ts가 서버에서 그리는 /legends/ 아래 HTML). 검색에 노출되는 글이다.
import { ns } from '../core';

const ko = {
  eyebrow: 'HALL OF FAME',
  hubTitle: '오프사이드 명예의 전당',
  hubLead: (p: { total: string }) =>
    `오프사이드에서 커리어를 마친 선수 ${p.total}명의 기록입니다. 고교 3학년부터 은퇴까지 실제 이용자가 키운 선수들이고, 기록은 은퇴할 때 서버에 남은 값 그대로입니다.`,
  hubDescription:
    '오프사이드(풀타임) 이용자가 키워 은퇴시킨 축구 선수들의 레전드 점수·득점·트로피 순위와 시즌별 커리어 기록을 봅니다.',
  howTitle: '명예의 전당에 오르는 방법',
  how1: '만 30세 이상에 은퇴한 선수가 명예의 전당에 오릅니다. 그보다 일찍 은퇴한 짧은 커리어는 키운 사람의 내 선수 목록에만 남습니다.',
  how2: '레전드 점수는 출전·골·도움·클린시트 같은 통산 기록, 리그와 대회 트로피, 개인상, 발롱도르 순위, A매치 출전을 더해 매깁니다. 포지션마다 기록이 쌓이는 방식이 달라 포지션별 순위를 함께 둡니다.',
  how3: '선수 이름은 키운 사람이 이름 공개를 켜 둔 경우에만 보이고, 끄면 익명 선수로 표시됩니다.',
  topTitle: '레전드 점수 상위 50명',
  rankingsTitle: '기록별 순위',
  positionsTitle: '포지션별 순위',
  rankTitle: (p: { sort: string }) => `${p.sort} 순위`,
  rankLead: (p: { sort: string; n: number }) =>
    `명예의 전당 선수 가운데 통산 ${p.sort} 기록이 높은 ${p.n}명입니다.`,
  posTitle: (p: { pos: string }) => `${p.pos} 명예의 전당`,
  posLead: (p: { pos: string; n: number; peak: string; age: string }) =>
    `${p.pos}로 은퇴한 선수 가운데 레전드 점수 상위 ${p.n}명입니다. 이 ${p.n}명의 최고 OVR 평균은 ${p.peak}, 은퇴 나이 평균은 ${p.age}세입니다.`,
  noteScore: '레전드 점수는 통산 기록·트로피·개인상·대표팀 경력을 합친 값입니다.',
  noteGoals: '프로·대학·고교 리그와 컵·대륙 대회에서 넣은 골을 모두 셉니다.',
  noteAssists: '모든 대회의 도움을 셉니다.',
  noteGa: '골과 도움을 더한 공격포인트입니다.',
  noteApps: '모든 대회의 출전 경기 수입니다.',
  noteTrophies: '리그·컵·대륙 대회·대표팀에서 들어 올린 트로피 수입니다.',
  noteBallon: '발롱도르를 받은 횟수입니다.',
  noteValue: '은퇴 가치는 가장 높았던 세 시즌의 몸값 평균에 레전드 점수를 반영한 값입니다.',
  colRank: '순위',
  colPlayer: '선수',
  colPos: '포지션',
  colClub: '마지막 구단',
  colValue: '기록',
  anonymous: '익명 선수',
  // 선수 페이지
  playerTitle: (p: { name: string; pos: string }) => `${p.name} (${p.pos}) 커리어 기록`,
  playerDescription: (p: {
    name: string;
    age: number;
    club: string;
    apps: number;
    goals: number;
    assists: number;
    trophies: number;
    score: number;
  }) =>
    `${p.name}, ${p.age}세 ${p.club}에서 은퇴. 통산 ${p.apps}경기 ${p.goals}골 ${p.assists}도움, 트로피 ${p.trophies}개, 레전드 점수 ${p.score}.`,
  profile: '프로필',
  peak: '최고 OVR',
  potential: '잠재력',
  retireAge: '은퇴 나이',
  lastClub: '마지막 구단',
  nation: '국적',
  number: '등번호',
  legendScore: '레전드 점수',
  value: '은퇴 가치',
  retiredNumber: '영구결번',
  totals: '통산 기록',
  apps: '출전',
  goals: '골',
  assists: '도움',
  trophies: '트로피',
  awards: '개인상',
  caps: 'A매치',
  ballon: '발롱도르',
  seasons: '시즌별 기록',
  colYear: '연도',
  colAge: '나이',
  colLeague: '리그',
  colApps: '경기',
  colGoals: '골',
  colAssists: '도움',
  colRating: '평점',
  colLeagueRank: '순위',
  colOvr: 'OVR',
  trophyList: '트로피',
  awardList: '개인상',
  ballonList: '발롱도르 순위',
  ballonRank: (p: { year: number; rank: number }) => `${p.year} ${p.rank}위`,
  national: '국가대표',
  nationalLine: (p: { caps: number; goals: number; assists: number }) =>
    `A매치 ${p.caps}경기 ${p.goals}골 ${p.assists}도움`,
  stories: '커리어 스토리',
  storyLine: (p: { year: number; name: string; ending: string }) =>
    `${p.year} ${p.name}: ${p.ending}`,
  milestones: '주요 순간',
  noDetail: '이 선수는 시즌별 기록이 남아 있지 않은 예전 기록입니다.',
  playInGame: '게임에서 이 선수 보기',
  startCareer: '나도 선수 키우기',
  backToHub: '명예의 전당으로',
  notFound: '선수를 찾을 수 없어요.',
  failed: '명예의 전당을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  people: (p: { n: string }) => `${p.n}명`,
  posFW: '공격수',
  posMF: '미드필더',
  posDF: '수비수',
  posGK: '골키퍼',
};

export type PublicLegendsMsgs = typeof ko;
export const publicLegendsText = ns('publicLegends', ko);
