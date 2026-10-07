// 한 구간 진행의 경기 요약·하이라이트(match.ts·turn.ts), 새 커리어 시작 로그(engine.ts), 스토리 완결 로그(story.ts),
// 순위표의 자리 채움 팀 이름(table.ts).
import { ns } from '@offside/contracts/i18n';

const ko = {
  blockLine: (p: {
    phase: string;
    n: number;
    w: number;
    d: number;
    l: number;
    apps: number;
    goals: number;
    assists: number;
  }) =>
    `${p.phase} ${p.n}경기 ${p.w}승 ${p.d}무 ${p.l}패 · 출전 ${p.apps} · ${p.goals}골 ${p.assists}도움`,
  roundRange: (p: { a: number; b: number }) => `${p.a}–${p.b}R`,
  hlHat: (p: { rd: number; g: number; rating: number }) =>
    `${p.rd}R 해트트릭! ${p.g}골 폭발 (평점 ${p.rating})`,
  hlMulti: (p: { rd: number; rating: number }) => `${p.rd}R 멀티골 (평점 ${p.rating})`,
  hlMom: (p: { rd: number; rating: number }) => `${p.rd}R 경기 최우수 선수 선정 (평점 ${p.rating})`,
  hlSave: (p: { rd: number; rating: number }) =>
    `${p.rd}R 슈퍼 세이브 쇼, 무실점 (평점 ${p.rating})`,
  hlInjury: (p: { rd: number; big: boolean; n: number }) =>
    `${p.rd}R ${p.big ? '심각한 부상' : '부상'}으로 교체 아웃… ${p.n}경기 결장 예상`,
  // nation은 외국 국적일 때만 이름, 아니면 빈 문자열
  gameStart: (p: { nation: string; club: string; pos: string; name: string; number: number }) =>
    `${p.nation ? `${p.nation}에서 축구 유학을 온 ` : ''}${p.club} 3학년 ${p.pos} ${p.name}, 등번호 ${p.number}번으로 축구 커리어를 시작합니다.`,
  balancePatch: (p: { v: number }) =>
    `밸런스 패치 v${p.v}가 이번 시즌부터 적용됩니다. 모든 선수에게 같은 값이며, 바뀐 내용은 확률 도감에서 볼 수 있습니다.`,
  storyEnd: (p: { name: string; ending: string }) => `[스토리 완결] ${p.name} · ${p.ending}`,
  placeholderTeam: (p: { league: string; n: number }) => `${p.league} ${p.n}`,
};
export type GTurnMsgs = typeof ko;
export const gTurnText = ns('gTurn', ko);
