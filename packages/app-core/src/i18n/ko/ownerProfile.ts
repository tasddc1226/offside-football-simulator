// T-11-150 구단주 프로필(웹 ui/owner/OwnerProfile.svelte · 앱 screens/hof/owner/OwnerProfile.tsx)과 명예관(대표 칭호
// 고르기 — 웹 ui/owner/OwnerHall.svelte · 앱 screens/owner/OwnerHall.tsx), 닉네임 옆 칭호(ownerTitle.ts).
import { ns } from '../core';

const ko = {
  titleDeveloper: '육성가',
  titleAcademy: '육성의 명가',
  titleStarMaker: '스타 메이커',
  titleBallonMaker: '발롱 메이커',
  titleLegendHome: '전설의 산실',
  titlePioneer: '기록 개척자',

  conditionDeveloper: '직접 키운 선수를 30세 이상까지 육성해 10명 은퇴',
  conditionAcademy: '직접 키운 선수를 30세 이상까지 육성해 50명 은퇴',
  conditionStarMaker: '직접 키운 최고 능력치 90 이상 선수 3명이 30세 이상에 은퇴',
  conditionBallonMaker: '직접 키운 발롱도르 수상 선수 1명이 30세 이상에 은퇴',
  conditionLegendHome: '직접 키운 선수 1명이 영구결번 획득',
  conditionPioneer: '시즌 결산에서 최초 기록 휘장 획득',

  permanentLead: '프리시즌부터 쌓인 기록으로 받아요. 한 번 받은 칭호는 시즌이 바뀌어도 남아요.',
  permanentTitle: '영구 칭호',
  equip: '대표로 선택',
  selected: '선택됨',
  earned: '획득',
  locked: '미획득',
  newTitle: '새 칭호',
  progress: (p: { value: number; target: number }) => `${p.value}/${p.target}`,
  // 칭호 — 컵 성적. n은 대회 회차.
  titleChampion: (p: { n: number }) => `제${p.n}회 챔피언`,
  titleRunnerup: (p: { n: number }) => `제${p.n}회 준우승`,
  titleSf: (p: { n: number }) => `제${p.n}회 4강`,
  titleAria: (p: { title: string }) => `대표 칭호 ${p.title}`,
  // 프로필
  open: '구단주 프로필',
  loadFail: '구단주 프로필을 불러오지 못했어요.',
  noNickname: '이름 없는 구단주',
  mine: '내 프로필',
  teamLine: (p: { season: string; manager: string }) => `${p.season} · 감독 ${p.manager}`,
  openTeam: '팀 보기',
  statRn: '영구결번',
  statRetired: '은퇴 선수',
  statBestRank: '최고 팀 순위',
  rank: (p: { n: number }) => `#${p.n}`,
  none: '—',
  trophiesEmpty: '아직 받은 트로피가 없어요. 오프사이드 컵에서 4강에 오르면 여기에 진열돼요.',
  seasons: '시즌 기록',
  seasonsEmpty: '아직 시즌 기록이 없어요.',
  colSeason: '시즌',
  colAch: '업적 점수',
  colTeam: '팀',
  colRank: '순위',
  ongoing: '진행 중',
  manage: '명예관에서 대표 칭호 고르기',
  // 명예관
  hallLoadFail: '명예관을 불러오지 못했어요.',
  retry: '다시 시도',
  hallTitle: '명예관',
  hallLead:
    '받은 칭호 가운데 하나를 대표 칭호로 달아요. 랭킹 · 팀 프로필 · 댓글 · 채팅에서 닉네임 옆에 보여요.',
  hallEmpty: '아직 받은 칭호가 없어요. 아래 조건을 채우면 칭호를 받아요.',
  current: '지금 대표 칭호',
  currentNone: '달지 않음',
  pickAuto: '자동',
  pickAutoNote: '컵 칭호 중 가장 좋은 칭호를 달아요',
  pickNone: '달지 않기',
  saved: '대표 칭호를 바꿨어요.',
  viewProfile: '내 구단주 프로필 보기',
};

export type OwnerProfileMsgs = typeof ko;
export const ownerProfileText = ns('ownerProfile', ko);
