// title 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  /** 칭호 알약 앞의 스크린 리더용 글자(웹). 끝 공백까지 한 덩이다. */
  tagSr: (p: { rarity: string }) => `${p.rarity} 칭호 `,
};

export type TitleTagMsgs = typeof ko;
export const titleTagText = ns('titleTag', ko);
