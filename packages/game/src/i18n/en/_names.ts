// 저장된 한국어 이름 → 영어(i18n/names.ts tn). 정확히 같은 이름을 먼저 찾고, 없으면 patterns를 위에서부터 맞춘다.
import type { NameTable } from '../names';

export const names: NameTable = {
  exact: {},
  patterns: [],
};
