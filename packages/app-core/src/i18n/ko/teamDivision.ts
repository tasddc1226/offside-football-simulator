// T-11-375 구단 디비전(웹 team/TeamHead · TeamResult · TeamRanking · DivisionEmblem, 앱 screens/owner/Team · TeamResult · 랭킹,
// 시즌 결산 휘장). 디비전 이름은 저장값이 아니라 index로 저장하고 여기서 그린다.
import { ns } from '../core';

const ko = {
  d0: '아마추어',
  d1: '세미프로 II',
  d2: '세미프로 I',
  d3: '프로 II',
  d4: '프로 I',
  d5: '엘리트 II',
  d6: '엘리트 I',
  d7: '마스터',
  label: '디비전',
  /** 팀 화면 머리 막대 아래 한 줄. */
  toNext: (p: { n: string; name: string }) => `${p.name}까지 ${p.n}점`,
  top: '가장 높은 디비전이에요',
  guard: (p: { n: string }) => `강등 보호 중 · ${p.n}점 더 떨어지면 내려가요`,
  progressAria: (p: { name: string; pct: number }) => `${p.name} 디비전, 다음 디비전까지 ${p.pct}%`,
  /** 경기 결과 창. */
  promoted: (p: { name: string }) => `${p.name} 승격!`,
  relegated: (p: { name: string }) => `${p.name}로 내려갔어요`,
  promotedBody: '경기 결과로 디비전이 올랐어요.',
  relegatedBody: 'RP를 다시 올리면 돌아갈 수 있어요.',
  /** 받은 경기로 바뀐 디비전을 다음 접속 때 한 번 알린다. */
  changedAway: (p: { name: string }) => `받은 경기 결과로 ${p.name} 디비전이 됐어요`,
  /** 랭킹 디비전 탭. */
  tabAll: '전체',
  tabsAria: '디비전',
  countLine: (p: { n: number; s: string }) => `${p.s}팀`,
  myDivision: '내 디비전',
  emptyDivision: '이 디비전에는 아직 팀이 없어요.',
  /** 시즌 보상 안내(팀 화면 디비전 카드 펼침). */
  rewardNote: (p: { from: string; matches: number }) =>
    `${p.from} 마감부터 시즌 마감 디비전이 프로 II 이상이면 배지와 리롤권을 받아요. 그 시즌 랭크 경기 ${p.matches}판 이상, 선발 은퇴 선수 8명 이상이어야 해요.`,
  rewardTitle: '시즌 보상',
  previewNote: '이번 시즌은 디비전을 보여 주기만 하고 보상은 없어요.',
};
export type TeamDivisionMsgs = typeof ko;
export const teamDivisionText = ns('teamDivision', ko);
