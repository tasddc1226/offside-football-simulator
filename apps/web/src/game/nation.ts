// ───────── T-10-096 선수 국적 ─────────
// 국적이 없는 저장(기능 이전 커리어)과 대한민국 선수는 예전과 한 글자도 다르지 않게 돈다 — 대표팀 표·확률·
// 시드 RNG 소비 순서가 그대로다. 외국 국적 선수도 커리어는 한국 고3(유학 온 선수)에서 시작하고, 발탁 문턱은
// 같다. 나라 전력은 A매치 상대와 대회 성적에만 들어가고, 병역(상무·현역)은 대한민국 국적에만 있다.
import {
  DEFAULT_NATION,
  NATIONS,
  NATION_BY_CODE,
  flagOf,
  type Confed,
  type Nation,
} from '@offside/contracts/nations';

export { flagOf, type Confed, type Nation };

const KR = NATION_BY_CODE.get(DEFAULT_NATION)!;

export const nationOf = (s: { nation?: string | undefined }): Nation =>
  (s.nation && NATION_BY_CODE.get(s.nation)) || KR;
export const isKorean = (s: { nation?: string | undefined }) =>
  !s.nation || s.nation === DEFAULT_NATION;

/** 대표팀 이름들 — 트로피의 club이 대표팀인지 가린다(대표팀 트로피엔 clubId가 없다). */
const NATION_NAMES = new Set(NATIONS.map((n) => n.ko));
export const isNationalTeam = (club: string) => NATION_NAMES.has(club);

/** 대륙 연맹의 지역 이름(예선·수상 문구). */
export const REGION: Record<Confed, string> = {
  AFC: '아시아',
  UEFA: '유럽',
  CONMEBOL: '남미',
  CAF: '아프리카',
  CONCACAF: '북중미',
  OFC: '오세아니아',
};

/** 대륙 올해의 선수상 — 대한민국(AFC)은 예전 이름 그대로. 조건·확률은 모든 연맹이 같다. */
export const CONF_POTY: Record<Confed, { home: string; abroad: string }> = {
  AFC: { home: 'AFC 올해의 선수', abroad: 'AFC 올해의 국제선수' },
  UEFA: { home: 'UEFA 올해의 선수', abroad: 'UEFA 올해의 선수' },
  CONMEBOL: { home: '남미 올해의 선수', abroad: '남미 올해의 선수' },
  CAF: { home: '아프리카 올해의 선수', abroad: '아프리카 올해의 선수' },
  CONCACAF: { home: 'CONCACAF 올해의 선수', abroad: 'CONCACAF 올해의 선수' },
  OFC: { home: 'OFC 올해의 선수', abroad: 'OFC 올해의 선수' },
};

/** 자국 축구협회 올해의 선수상. */
export const federationPoty = (s: { nation?: string | undefined }) =>
  isKorean(s) ? '대한축구협회 올해의 선수' : `${nationOf(s).ko} 축구협회 올해의 선수`;

/** 라이벌전 — 이기면 인기가 크게 오른다(대한민국의 한일전과 같은 보상). */
export const RIVAL: Record<string, { opp: string; label: string }> = {
  KR: { opp: '일본', label: '한일전' },
  JP: { opp: '대한민국', label: '한일전' },
  AR: { opp: '브라질', label: '남미 최고의 라이벌전' },
  BR: { opp: '아르헨티나', label: '남미 최고의 라이벌전' },
  'GB-ENG': { opp: '독일', label: '잉글랜드-독일전' },
  DE: { opp: '네덜란드', label: '독일-네덜란드전' },
  NL: { opp: '독일', label: '네덜란드-독일전' },
  ES: { opp: '포르투갈', label: '이베리아 더비' },
  PT: { opp: '스페인', label: '이베리아 더비' },
  FR: { opp: '이탈리아', label: '프랑스-이탈리아전' },
  IT: { opp: '프랑스', label: '이탈리아-프랑스전' },
  US: { opp: '멕시코', label: '북중미 라이벌전' },
  MX: { opp: '미국', label: '북중미 라이벌전' },
};
