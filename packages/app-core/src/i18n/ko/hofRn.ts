// 기록실 '영구결번' 탭(웹 RetiredWall.svelte · 앱 screens/hof/RetiredWall.tsx · app-core retiredWall.ts).
// 구단·리그·포지션·시즌 이름은 게임 데이터라 옮기지 않는다. 결번 날짜는 날짜 서식이라 그대로 둔다.
import { ns } from '../core';

const ko = {
  season: '시즌',
  seasonAria: '영구결번 시즌',
  notOpen: ' (개막 예정)',
  lead: '한 구단에서 오래 활약한 선수의 등번호는 다시 쓰지 않아요. 구단마다 한 번호에 한 명뿐이에요.',
  opens: (p: { name: string; when: string }) => `${p.name}은 ${p.when}(한국 시각)에 개막해요.`,
  loadFailed: '영구결번을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  loading: '불러오는 중…',
  empty: (p: { season: string }) => `아직 ${p.season} 영구결번이 없어요.`,
  sumRetired: '결번',
  sumClubs: '구단',
  sumRecent: '최근 결번',
  summaryLine: (p: { total: number; clubs: number; day: string }) =>
    `${p.total}개 결번 · ${p.clubs}개 구단 · 최근 ${p.day}`,
  recentTitle: '최근 결번',
  seeAll: '전체 보기 ›',
  seeAllLabel: '최근 결번 전체 보기',
  clubsTitle: '구단',
  clubOrderLabel: '구단 정렬',
  orderCount: '결번 많은 순',
  orderLeague: '리그별',
  otherLeague: '기타',
  backWeb: '‹ 구단 목록',
  backApp: '← 구단 목록',
  backLabel: '구단 목록으로 돌아가기',
  positionLabel: '포지션',
  all: '전체',
  recentAll: '최신순 전체',
  noMatchWeb: '선택한 조건에 맞는 영구결번이 없어요.',
  noMatchApp: '선택한 조건의 영구결번이 없어요.',
  more: '더 보기',
  moreLabel: '결번 더 보기',
  moreFailed: '불러오지 못했어요. 다시 시도',
  tileSeq: (p: { seq: number; day: string }) => `${p.seq}번째 · ${p.day}`,
  tileLabel: (p: { name: string; number: number; sub: string }) =>
    `${p.name} ${p.number}번 · ${p.sub}`,
  clubLabel: (p: { name: string; league: string; count: number }) =>
    `${p.name}${p.league ? ` ${p.league}` : ''} 영구결번 ${p.count}개`,
  mine: '내 선수',
  // T-11-121 명예의 벽
  wallTitle: '명예의 벽',
  wallLead:
    '결번 자격을 채웠지만 후보 구단의 번호가 모두 먼저 결번돼, 칭호로 이름을 남긴 선수예요.',
  wallClubTitle: '이 구단 명예의 벽',
  wallLabel: (p: { name: string; club: string; number: number; day: string }) =>
    `명예의 벽 ${p.name}, ${p.club} ${p.number}번, ${p.day}`,
};

export type HofRnMsgs = typeof ko;
export const hofRnText = ns('hofRn', ko);
