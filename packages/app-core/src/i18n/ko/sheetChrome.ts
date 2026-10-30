// T-11-588 업무 모드(웹 PC) 스프레드시트 틀의 꾸밈 글자. 화면 언어의 스프레드시트처럼 보이게 언어마다 둔다.
import { ns } from '../core';

const ko = {
  /** 문서 이름(틀의 제목 · 탭 제목). */
  doc: '4분기 업무 정리_v3',
  /** 브라우저 탭 제목. */
  tabTitle: (p: { doc: string }) => `${p.doc} - 스프레드시트`,
  /** 메뉴 줄(| 로 나눈다). */
  menus: '파일|수정|보기|삽입|서식|데이터|도구|확장 프로그램|도움말',
  share: '공유',
  me: '나',
  font: '기본값...',
  currency: '₩',
  sheet: '시트1',
};

export type SheetChromeMsgs = typeof ko;
export const sheetChromeText = ns('sheetChrome', ko);
