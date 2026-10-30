// T-11-475 시대의 라이벌 문구(결산 시트 · 트로피 탭, 웹 · 앱 공통). 라이벌 이름 · 구단 · 수상 이름은 게임 저장값이라 여기 두지 않는다.
import { ns } from '../core';

const ko = {
  titleNew: '시대의 라이벌이 나타났어요',
  titleNext: '새 라이벌이 나타났어요',
  titleSeason: '라이벌과 견준 이번 시즌',
  titleRetired: '라이벌이 은퇴해요',
  introNew: '같은 시대에 떠오른 또래예요. 이제 시즌마다 기록을 나란히 견줘요.',
  introNext: (p: { prev: string; age: number }) =>
    `${p.prev} 선수와의 경쟁은 끝났어요. 이번엔 ${p.age}세 신예가 내 선수 자리를 노려요.`,
  introRetired: (p: { name: string }) => `이번 시즌을 끝으로 ${p.name} 선수가 은퇴해요.`,
  who: (p: { age: number; pos: string; club: string }) => `${p.age}세 · ${p.pos} · ${p.club}`,
  me: '나',
  rival: '라이벌',
  rowOvr: 'OVR',
  rowApps: '출전',
  rowGoals: '골',
  rowAssists: '도움',
  rowCs: '무실점',
  rowRating: '평점',
  rowAwards: '수상',
  rowBallon: '발롱도르',
  rowSeasons: '시즌',
  rowBallonWins: '발롱도르 수상',
  rowPeak: '최고 OVR',
  ballonRank: (p: { n: number }) => `${p.n}위`,
  ballonNone: '-',
  ballonRivalWon: (p: { name: string }) => `발롱도르는 라이벌 ${p.name} 선수가 들어 올렸어요.`,
  ballonMeWon: (p: { n: number }) => `발롱도르는 내 선수가 가져갔어요. 라이벌은 ${p.n}위예요.`,
  ballonBoth: (p: { me: number; rival: number }) =>
    `발롱도르 순위는 내 선수 ${p.me}위, 라이벌 ${p.rival}위예요.`,
  verdictMe: '이번 시즌은 내 선수가 앞섰어요.',
  verdictRival: '이번 시즌은 라이벌이 한 발 앞섰어요.',
  verdictEven: '이번 시즌은 팽팽했어요.',
  rivalHonors: '라이벌 수상',
  tabTitle: '시대의 라이벌',
  tabSince: (p: { year: number }) => `${p.year}년부터 견줬어요.`,
  tabRetired: (p: { year: number }) => `${p.year}년 은퇴`,
  careerMe: '통산으로는 내 선수가 앞서 있어요.',
  careerRival: '통산으로는 라이벌이 앞서 있어요.',
  careerEven: '통산으로는 팽팽해요.',
  seasonsHead: '라이벌 시즌 기록',
  seasonLine: (p: { ovr: number; apps: number; g: number; a: number }) =>
    `OVR ${p.ovr} · ${p.apps}경기 ${p.g}골 ${p.a}도움`,
  seasonLineBack: (p: { ovr: number; apps: number; cs: number }) =>
    `OVR ${p.ovr} · ${p.apps}경기 무실점 ${p.cs}`,
  past: '지나간 라이벌',
  pastLine: (p: { name: string; from: number; to: number }) => `${p.name} (${p.from}~${p.to})`,
};

export type EraMsgs = typeof ko;
export const eraText = ns('era', ko);
