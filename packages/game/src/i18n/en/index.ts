// 영어 사전 묶음 — 파일 이름 = ns() 이름 = export 이름 = 여기 키. 영어 사용자에게만 불러온다(웹은 지연 청크).
// 직접 고치지 않는다: node tooling/scripts/i18n-index.mjs
import { events } from './_events';
import { names } from './_names';

export const en = {
  __events: events,
  __names: names,
};
