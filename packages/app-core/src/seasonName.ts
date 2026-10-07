// 서비스 시즌 이름의 화면 표기(T-11-106). contracts의 이름('프리시즌' · '시즌 N')은 서버와 공유하는 한국어 값이라
// 바꾸지 않고 그릴 때만 지금 언어로 옮긴다. 서버가 보낸 시즌 이름(목록의 name)도 같은 규칙으로 옮긴다.
import { teamSeasonName } from '@offside/contracts/service-seasons';
import { tn } from '@offside/game/i18n/names';
import { getLocale } from './i18n/core.js';

/** 시즌 id(0 = 프리시즌)와 한국어 이름으로 지금 언어의 시즌 이름. */
export function seasonLabel(id: number, name: string): string {
  const lang = getLocale();
  if (lang === 'ko') return name;
  const m = /^시즌 (\d+)$/.exec(name);
  return id === 0 ? teamSeasonName(0, lang) : m ? teamSeasonName(Number(m[1]), lang) : tn(name);
}

/** 팀 시즌 id의 이름(contracts teamSeasonName의 화면용). */
export const teamSeasonLabel = (id: number): string => teamSeasonName(id, getLocale());
