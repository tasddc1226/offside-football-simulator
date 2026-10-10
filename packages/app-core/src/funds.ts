// 구단 자금 표기. format.ts는 첫 화면 청크에 실려 appFormat 문구를 끌어오지 않게 따로 둔다.
import { fmtValue } from './format.js';
import { appFormatText } from './i18n/ko/appFormat.js';

/** 구단 자금 표기(0이면 '0원' — fmtValue는 0을 '-'로 쓴다). */
export const fundsText = (man: number) => (man > 0 ? fmtValue(man) : appFormatText.zeroWon);
