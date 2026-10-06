// 서버 요청이 실패했을 때 클라이언트가 만드는 오류 문구(app-core api/client.ts). 서버가 보내는 문장은 옮기지 않는다.
import { ns } from '../core';

const ko = {
  network: '서버에 연결하지 못했어요.',
  badResponse: '서버 응답을 읽지 못했어요.',
  failed: '요청을 처리하지 못했어요.',
  failedStatus: (p: { status: number }) => `요청을 처리하지 못했어요(${p.status}).`,
  badShape: '서버 응답 형식이 올바르지 않아요.',
};

export type SettingsApiMsgs = typeof ko;
export const settingsApiText = ns('settingsApi', ko);
