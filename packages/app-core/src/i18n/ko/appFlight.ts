// 이적 비행 장면의 공항 도시·나라 이름(flight.ts). 리그 나라 코드별로 둔다.
import { ns } from '../core';

const ko = {
  cityKR: '인천',
  cityJP: '도쿄',
  cityUS: '뉴욕',
  cityNL: '암스테르담',
  cityFR: '파리',
  cityDE: '프랑크푸르트',
  cityIT: '밀라노',
  cityES: '마드리드',
  cityGB: '런던',
  countryKR: '대한민국',
  countryJP: '일본',
  countryUS: '미국',
  countryNL: '네덜란드',
  countryFR: '프랑스',
  countryDE: '독일',
  countryIT: '이탈리아',
  countryES: '스페인',
  countryGB: '잉글랜드',
};

export type AppFlightMsgs = typeof ko;
export const appFlightText = ns('appFlight', ko);
