// T-11-589 통신판매업 사업자 정보(전자상거래법 10조) 칸 이름. 값은 운영 설정 BUSINESS_INFO에서 온다(apps/web businessInfo.ts).
// 푸터(지연 청크)에서만 불러 첫 화면 번들에 싣지 않는다.
import { ns } from '../core';

const ko = {
  name: '상호',
  owner: '대표자',
  regNo: '사업자등록번호',
  mailOrder: '통신판매업 신고',
  address: '주소',
  phone: '전화',
  check: '사업자 정보 확인',
};

export type BizInfoMsgs = typeof ko;
export const bizInfoText = ns('bizInfo', ko);
