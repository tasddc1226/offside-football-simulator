import { ns } from '../core';
const ko = {
  title: '구단 전력',
  note: '매일 오후 1시 이후 현실 성적을 확인해요. 새 전력은 다음 게임 내 시즌부터 적용돼요. 고교·대학·K2·K3는 고정이에요.',
  refresh: '새로고침',
  more: '이전 기록',
  empty: '아직 자동 갱신 기록이 없어요.',
  fail: '전력 갱신 기록을 불러오지 못했어요.',
  version: '적용 중인 전력표',
  changed: '전력 변경',
  unchanged: '변경 없음',
  failed: '수집 실패',
  unconfigured: '연결 필요',
  reason: '처리 사유',
  season: '현실 시즌',
  rows: '구단별 변경',
  same: '같은 순위표라 유지했어요.',
  held: '경기 수가 적은 구단의 전력은 유지했어요.',
  valid: '검증한 성적을 반영했어요.',
  missing: '데이터 출처와 API 연결이 필요해요.',
  invalid: '데이터 출처 설정을 확인해야 해요.',
  error: '수집 데이터와 구단 대응을 확인해야 해요.',
  asOf: '전력표 기준일',
};
export type ClubStrengthMsgs = typeof ko;
export const clubStrengthText = ns('clubStrength', ko);
