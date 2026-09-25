/** T-10-029 은퇴 커리어 공유 링크 경로(`/career/<커리어 UUID>`). 워커(앱 셸로 서빙)와 앱(보기 전용 화면)이 함께 쓴다. */
export const SHARE_PATH = /^\/career\/([0-9a-f-]{36})\/?$/i;
