// 경기 중계·이벤트·이적시장·시즌 결과 시트(웹 ui/sheets/{Block,TickerLine,EventChoice,EventResult,Judge,Market,SeasonResult}.svelte ·
// 앱 sheets/*.tsx). 웹·앱 문구가 다른 줄은 Web/App 접미사로 나눈다.
import { ns } from '../core';

const ko = {
  // 이벤트
  storyTag: (p: { name: string }) => `스토리 · ${p.name}`,
  eventResult: (p: { label: string }) => `결과 · ${p.label}`,
  dexNew: '📖 도감 새 항목',
  dexNote: '홈의 확률 도감에서 볼 수 있어요',
  storyEnd: (p: { name: string }) => `스토리 완결 · ${p.name}`,
  storyStarted: '새 스토리 시작:',
  storyNext: '이야기는 다음 구간에 이어져요.',
  // 이적시장
  marketTitle: '다음 시즌, 어디서 뛸까요?',
  salary: '연봉',
  offerA11y: (p: {
    name: string;
    lg: string;
    salary: string | null;
    sub: string | null | undefined;
    reason: string | null | undefined;
  }) =>
    `${p.name}, ${p.lg}${p.salary !== null ? `, 연봉 ${p.salary}` : ''}${p.sub ? `, ${p.sub}` : ''}${p.reason ? `, ${p.reason}` : ''}`,
  // 시즌 결과
  noHonors: '이번 시즌 수상은 없었어요.',
  promoTitle: 'K리그1 승격 확정',
  promoBodyWeb: (p: { club: string }) =>
    `이번 시즌 1위로 ${p.club}의 승격이 확정됐어요. 다음 시즌에는 K리그1에서 새로운 도전을 시작해요.`,
  promoBodyApp: (p: { club: string }) =>
    `이번 시즌 1위로 ${p.club}의 승격이 확정됐어요. 다음 시즌은 K리그1에서 뛰어요.`,
  promoDownWeb: (p: { club: string }) => `자리를 내준 ${p.club} · K리그2 강등`,
  promoDownApp: (p: { club: string }) => `${p.club} · K리그2 강등`,
  comps: '대회별 성적',
  tours: '국가대표 · 국제대회',
  gala: "Ballon d'Or 시상식",
  miles: '커리어 이정표',
  scoutHint: '스카우트 한마디',
  fans: '팬 반응',
  ageWeb: (p: { age: number }) => `${p.age}세가 됐어요. 이제 다음 시즌을 준비해요.`,
  ageApp: (p: { age: number }) => `${p.age}세가 됐어요. 다음 시즌을 준비해요.`,
};

export type SheetPlayMsgs = typeof ko;
export const sheetPlayText = ns('sheetPlay', ko);
