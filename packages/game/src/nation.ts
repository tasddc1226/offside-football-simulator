// ───────── T-10-096 선수 국적 ─────────
// 국적이 없는 저장(기능 이전 커리어)과 대한민국 선수는 예전과 한 글자도 다르지 않게 돈다 — 대표팀 표·확률·
// 시드 RNG 소비 순서가 그대로다. 외국 국적 선수도 커리어는 한국 고3(유학 온 선수)에서 시작하고, 발탁 문턱은
// 같다. 나라 전력은 A매치 상대와 대회 성적에만 들어가고, 병역(상무·현역)은 대한민국 국적에만 있다.
import {
  CONFEDS,
  DEFAULT_NATION,
  NATIONS,
  NATION_BY_CODE,
  flagOf,
  type Confed,
  type Nation,
} from '@offside/contracts/nations';

export { flagOf, type Confed, type Nation };

/** 대한민국 — 국적 없는 저장의 기본값이자 다른 나라 전력의 기준점. */
export const KR = NATION_BY_CODE.get(DEFAULT_NATION)!;

export const nationOf = (s: { nation?: string | undefined }): Nation =>
  (s.nation && NATION_BY_CODE.get(s.nation)) || KR;
export const isKorean = (s: { nation?: string | undefined }) =>
  !s.nation || s.nation === DEFAULT_NATION;

/** 대표팀 이름들 — 트로피의 club이 대표팀인지 가린다(대표팀 트로피엔 clubId가 없다). */
const NATION_NAMES = new Set(NATIONS.map((n) => n.ko));
export const isNationalTeam = (club: string) => NATION_NAMES.has(club);

/** 자국 축구협회 올해의 선수상. */
export const federationPoty = (s: { nation?: string | undefined }) =>
  isKorean(s) ? '대한축구협회 올해의 선수' : `${nationOf(s).ko} 축구협회 올해의 선수`;

/** 대륙 올해의 선수상 — 자기 대륙 밖에서 뛰면 abroad(아시아만 국제선수상이 따로 있다). 조건·확률은 모든 연맹이 같다. */
export function confPoty(s: { nation?: string | undefined }, abroad: boolean) {
  const c = CONFEDS[nationOf(s).conf];
  return abroad ? (c.potyAbroad ?? c.poty) : c.poty;
}

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
