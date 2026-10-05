import type { Translation } from '../core';
import type { WebGameMsgs } from '../ko/webGame';

export const webGame: Translation<WebGameMsgs> = {
  // 영어 금액은 이미 원화 기호(₩)가 붙어 나온다.
  won: (p) => p.v,
};
