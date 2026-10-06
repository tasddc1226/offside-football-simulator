// legend 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  // 알림(legend.ts)
  detailFailed: '상세 기록을 불러오지 못했어요.',
  nameBlocked: '링크나 욕설이 들어간 이름은 공개할 수 없어요. 익명으로만 올라가요.',
  namePublished: '명예의 전당에 이름을 공개했어요.',
  nameAnon: '명예의 전당에서 익명으로 바꿨어요.',
};

export type LegendToastMsgs = typeof ko;
export const legendToastText = ns('legendToast', ko);
