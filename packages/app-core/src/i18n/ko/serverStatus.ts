// 설정의 '서버 상태'(웹 ServerStatus.svelte · 앱 screens/settings/ServerStatus.tsx · app-core serverStatus.ts).
import { ns } from '../core';

const ko = {
  title: '서버 상태',
  intro: '게임 서버가 받은 요청을 5분마다 모아 보여 줘요.',
  loading: '불러오는 중이에요.',
  error: '서버 상태를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.',
  levelOk: '정상이에요',
  levelSlow: '평소보다 느려요',
  levelDown: '서버 오류가 늘었어요',
  levelUnknown: '최근 기록이 없어요',
  recentTitle: '최근 15분',
  perMinute: '분당 요청',
  avgResponse: '평균 응답',
  slowShare: '1초 넘게 걸린 요청',
  errorShare: '서버 오류',
  hoursTitle: '최근 24시간',
  hoursRequests: '시간당 요청',
  hoursAvg: '평균 응답 시간',
  daysTitle: '최근 30일',
  colDay: '날짜',
  colRequests: '요청',
  colAvg: '평균 응답',
  colSlow: '느린 요청',
  trendUp: (p: { n: string; pct: string }) =>
    `어제 요청은 ${p.n}건이에요. 일주일 전보다 ${p.pct} 늘었어요.`,
  trendDown: (p: { n: string; pct: string }) =>
    `어제 요청은 ${p.n}건이에요. 일주일 전보다 ${p.pct} 줄었어요.`,
  trendFlat: (p: { n: string }) => `어제 요청은 ${p.n}건이에요. 일주일 전과 비슷해요.`,
  yesterday: (p: { n: string }) => `어제 요청은 ${p.n}건이에요.`,
  note: '요청 수는 서버가 직접 센 근삿값이라 실제보다 조금 적을 수 있어요. 2026년 10월 16일부터 기록했어요.',
};

export type ServerStatusMsgs = typeof ko;
export const serverStatusText = ns('serverStatus', ko);
