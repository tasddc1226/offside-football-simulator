// 서비스 시즌 이름의 화면 표기(T-11-106). contracts의 이름('프리시즌' · '시즌 N')은 서버와 공유하는 한국어 값이라
// 바꾸지 않고 그릴 때만 지금 언어로 옮긴다. 홈 명예의 전당 미리보기(첫 화면)가 쓰므로 문구 네임스페이스를 끌어오지
// 않고 영어 두 줄만 여기 둔다(첫 화면 청크 예산). 모르는 형식의 이름은 tn()으로 넘긴다.
import { getLocale } from '@offside/contracts/i18n';
import { tn } from '@offside/game/i18n/names';
import { teamSeasonName } from '@offside/contracts/service-seasons';

/** 시즌 id(0 = 프리시즌)와 한국어 이름으로 지금 언어의 시즌 이름. */
export function seasonLabel(id: number, name: string): string {
  if (getLocale() === 'ko') return name;
  if (id === 0) return 'Pre-season';
  const m = /^시즌 (\d+)$/.exec(name);
  return m ? `Season ${m[1]}` : tn(name);
}

/** 팀 시즌 id의 이름(contracts teamSeasonName의 화면용). */
export const teamSeasonLabel = (id: number): string => seasonLabel(id, teamSeasonName(id));
