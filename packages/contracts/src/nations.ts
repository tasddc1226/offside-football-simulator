// T-10-096 선수 국적 — FIFA 회원국 전체. str = A대표팀 전력(게임 내 60~88 척도, 대략 FIFA 랭킹 기준).
export type Confed = 'AFC' | 'UEFA' | 'CONMEBOL' | 'CAF' | 'CONCACAF' | 'OFC';
export interface Nation {
  /** 국가 코드 — ISO 3166-1 alpha-2. 잉글랜드·스코틀랜드·웨일스·북아일랜드는 'GB-ENG','GB-SCT','GB-WLS','GB-NIR'. 코소보 'XK'. */
  code: string;
  /** 한국어 이름(화면 표시). */
  ko: string;
  conf: Confed;
  /** A대표팀 전력. */
  str: number;
}

// 대륙연맹 순(AFC → UEFA → CONMEBOL → CAF → CONCACAF → OFC), 연맹 안에서는 전력 내림차순 → 이름순.
export const NATIONS: readonly Nation[] = [
  { code: 'JP', ko: '일본', conf: 'AFC', str: 77 },
  { code: 'KR', ko: '대한민국', conf: 'AFC', str: 75 },
  { code: 'IR', ko: '이란', conf: 'AFC', str: 74 },
  { code: 'AU', ko: '호주', conf: 'AFC', str: 73 },
  { code: 'SA', ko: '사우디아라비아', conf: 'AFC', str: 69 },
  { code: 'UZ', ko: '우즈베키스탄', conf: 'AFC', str: 68 },
  { code: 'QA', ko: '카타르', conf: 'AFC', str: 68 },
  { code: 'JO', ko: '요르단', conf: 'AFC', str: 67 },
  { code: 'IQ', ko: '이라크', conf: 'AFC', str: 67 },
  { code: 'AE', ko: 'UAE', conf: 'AFC', str: 66 },
  { code: 'OM', ko: '오만', conf: 'AFC', str: 64 },
  { code: 'BH', ko: '바레인', conf: 'AFC', str: 63 },
  { code: 'SY', ko: '시리아', conf: 'AFC', str: 62 },
  { code: 'CN', ko: '중국', conf: 'AFC', str: 62 },
  { code: 'ID', ko: '인도네시아', conf: 'AFC', str: 61 },
  { code: 'TH', ko: '태국', conf: 'AFC', str: 61 },
  { code: 'VN', ko: '베트남', conf: 'AFC', str: 60 },
  { code: 'KP', ko: '북한', conf: 'AFC', str: 60 },
  { code: 'PS', ko: '팔레스타인', conf: 'AFC', str: 60 },
  { code: 'TJ', ko: '타지키스탄', conf: 'AFC', str: 59 },
  { code: 'KW', ko: '쿠웨이트', conf: 'AFC', str: 58 },
  { code: 'KG', ko: '키르기스스탄', conf: 'AFC', str: 58 },
  { code: 'LB', ko: '레바논', conf: 'AFC', str: 56 },
  { code: 'MY', ko: '말레이시아', conf: 'AFC', str: 56 },
  { code: 'IN', ko: '인도', conf: 'AFC', str: 56 },
  { code: 'PH', ko: '필리핀', conf: 'AFC', str: 55 },
  { code: 'TM', ko: '투르크메니스탄', conf: 'AFC', str: 54 },
  { code: 'HK', ko: '홍콩', conf: 'AFC', str: 53 },
  { code: 'SG', ko: '싱가포르', conf: 'AFC', str: 52 },
  { code: 'YE', ko: '예멘', conf: 'AFC', str: 52 },
  { code: 'AF', ko: '아프가니스탄', conf: 'AFC', str: 51 },
  { code: 'TW', ko: '대만', conf: 'AFC', str: 50 },
  { code: 'MV', ko: '몰디브', conf: 'AFC', str: 50 },
  { code: 'MM', ko: '미얀마', conf: 'AFC', str: 50 },
  { code: 'BD', ko: '방글라데시', conf: 'AFC', str: 49 },
  { code: 'KH', ko: '캄보디아', conf: 'AFC', str: 49 },
  { code: 'NP', ko: '네팔', conf: 'AFC', str: 48 },
  { code: 'TL', ko: '동티모르', conf: 'AFC', str: 48 },
  { code: 'LA', ko: '라오스', conf: 'AFC', str: 47 },
  { code: 'MN', ko: '몽골', conf: 'AFC', str: 47 },
  { code: 'GU', ko: '괌', conf: 'AFC', str: 46 },
  { code: 'MO', ko: '마카오', conf: 'AFC', str: 46 },
  { code: 'BT', ko: '부탄', conf: 'AFC', str: 46 },
  { code: 'BN', ko: '브루나이', conf: 'AFC', str: 46 },
  { code: 'LK', ko: '스리랑카', conf: 'AFC', str: 46 },
  { code: 'PK', ko: '파키스탄', conf: 'AFC', str: 46 },
  { code: 'ES', ko: '스페인', conf: 'UEFA', str: 88 },
  { code: 'FR', ko: '프랑스', conf: 'UEFA', str: 88 },
  { code: 'GB-ENG', ko: '잉글랜드', conf: 'UEFA', str: 86 },
  { code: 'PT', ko: '포르투갈', conf: 'UEFA', str: 85 },
  { code: 'NL', ko: '네덜란드', conf: 'UEFA', str: 84 },
  { code: 'DE', ko: '독일', conf: 'UEFA', str: 84 },
  { code: 'BE', ko: '벨기에', conf: 'UEFA', str: 82 },
  { code: 'IT', ko: '이탈리아', conf: 'UEFA', str: 82 },
  { code: 'HR', ko: '크로아티아', conf: 'UEFA', str: 81 },
  { code: 'DK', ko: '덴마크', conf: 'UEFA', str: 80 },
  { code: 'CH', ko: '스위스', conf: 'UEFA', str: 79 },
  { code: 'NO', ko: '노르웨이', conf: 'UEFA', str: 78 },
  { code: 'AT', ko: '오스트리아', conf: 'UEFA', str: 78 },
  { code: 'TR', ko: '튀르키예', conf: 'UEFA', str: 77 },
  { code: 'UA', ko: '우크라이나', conf: 'UEFA', str: 75 },
  { code: 'RS', ko: '세르비아', conf: 'UEFA', str: 74 },
  { code: 'SE', ko: '스웨덴', conf: 'UEFA', str: 74 },
  { code: 'GB-SCT', ko: '스코틀랜드', conf: 'UEFA', str: 74 },
  { code: 'PL', ko: '폴란드', conf: 'UEFA', str: 74 },
  { code: 'HU', ko: '헝가리', conf: 'UEFA', str: 74 },
  { code: 'CZ', ko: '체코', conf: 'UEFA', str: 73 },
  { code: 'GB-WLS', ko: '웨일스', conf: 'UEFA', str: 72 },
  { code: 'RO', ko: '루마니아', conf: 'UEFA', str: 71 },
  { code: 'IE', ko: '아일랜드', conf: 'UEFA', str: 71 },
  { code: 'GR', ko: '그리스', conf: 'UEFA', str: 70 },
  { code: 'RU', ko: '러시아', conf: 'UEFA', str: 70 },
  { code: 'SK', ko: '슬로바키아', conf: 'UEFA', str: 70 },
  { code: 'AL', ko: '알바니아', conf: 'UEFA', str: 69 },
  { code: 'GE', ko: '조지아', conf: 'UEFA', str: 69 },
  { code: 'SI', ko: '슬로베니아', conf: 'UEFA', str: 68 },
  { code: 'BA', ko: '보스니아 헤르체고비나', conf: 'UEFA', str: 67 },
  { code: 'FI', ko: '핀란드', conf: 'UEFA', str: 67 },
  { code: 'MK', ko: '북마케도니아', conf: 'UEFA', str: 66 },
  { code: 'GB-NIR', ko: '북아일랜드', conf: 'UEFA', str: 66 },
  { code: 'IS', ko: '아이슬란드', conf: 'UEFA', str: 66 },
  { code: 'IL', ko: '이스라엘', conf: 'UEFA', str: 66 },
  { code: 'ME', ko: '몬테네그로', conf: 'UEFA', str: 65 },
  { code: 'BG', ko: '불가리아', conf: 'UEFA', str: 65 },
  { code: 'XK', ko: '코소보', conf: 'UEFA', str: 65 },
  { code: 'KZ', ko: '카자흐스탄', conf: 'UEFA', str: 62 },
  { code: 'LU', ko: '룩셈부르크', conf: 'UEFA', str: 60 },
  { code: 'BY', ko: '벨라루스', conf: 'UEFA', str: 60 },
  { code: 'AM', ko: '아르메니아', conf: 'UEFA', str: 60 },
  { code: 'AZ', ko: '아제르바이잔', conf: 'UEFA', str: 58 },
  { code: 'CY', ko: '키프로스', conf: 'UEFA', str: 58 },
  { code: 'EE', ko: '에스토니아', conf: 'UEFA', str: 57 },
  { code: 'LV', ko: '라트비아', conf: 'UEFA', str: 56 },
  { code: 'FO', ko: '페로 제도', conf: 'UEFA', str: 56 },
  { code: 'LT', ko: '리투아니아', conf: 'UEFA', str: 55 },
  { code: 'MD', ko: '몰도바', conf: 'UEFA', str: 54 },
  { code: 'MT', ko: '몰타', conf: 'UEFA', str: 52 },
  { code: 'AD', ko: '안도라', conf: 'UEFA', str: 48 },
  { code: 'GI', ko: '지브롤터', conf: 'UEFA', str: 46 },
  { code: 'LI', ko: '리히텐슈타인', conf: 'UEFA', str: 45 },
  { code: 'SM', ko: '산마리노', conf: 'UEFA', str: 45 },
  { code: 'AR', ko: '아르헨티나', conf: 'CONMEBOL', str: 88 },
  { code: 'BR', ko: '브라질', conf: 'CONMEBOL', str: 86 },
  { code: 'UY', ko: '우루과이', conf: 'CONMEBOL', str: 80 },
  { code: 'CO', ko: '콜롬비아', conf: 'CONMEBOL', str: 80 },
  { code: 'EC', ko: '에콰도르', conf: 'CONMEBOL', str: 77 },
  { code: 'PY', ko: '파라과이', conf: 'CONMEBOL', str: 76 },
  { code: 'CL', ko: '칠레', conf: 'CONMEBOL', str: 72 },
  { code: 'PE', ko: '페루', conf: 'CONMEBOL', str: 72 },
  { code: 'VE', ko: '베네수엘라', conf: 'CONMEBOL', str: 71 },
  { code: 'BO', ko: '볼리비아', conf: 'CONMEBOL', str: 69 },
  { code: 'MA', ko: '모로코', conf: 'CAF', str: 81 },
  { code: 'SN', ko: '세네갈', conf: 'CAF', str: 78 },
  { code: 'DZ', ko: '알제리', conf: 'CAF', str: 75 },
  { code: 'EG', ko: '이집트', conf: 'CAF', str: 75 },
  { code: 'NG', ko: '나이지리아', conf: 'CAF', str: 74 },
  { code: 'CI', ko: '코트디부아르', conf: 'CAF', str: 74 },
  { code: 'GH', ko: '가나', conf: 'CAF', str: 72 },
  { code: 'ML', ko: '말리', conf: 'CAF', str: 72 },
  { code: 'CM', ko: '카메룬', conf: 'CAF', str: 72 },
  { code: 'TN', ko: '튀니지', conf: 'CAF', str: 72 },
  { code: 'CD', ko: '콩고민주공화국', conf: 'CAF', str: 70 },
  { code: 'ZA', ko: '남아프리카공화국', conf: 'CAF', str: 69 },
  { code: 'BF', ko: '부르키나파소', conf: 'CAF', str: 69 },
  { code: 'CV', ko: '카보베르데', conf: 'CAF', str: 69 },
  { code: 'GA', ko: '가봉', conf: 'CAF', str: 63 },
  { code: 'GN', ko: '기니', conf: 'CAF', str: 63 },
  { code: 'BJ', ko: '베냉', conf: 'CAF', str: 63 },
  { code: 'AO', ko: '앙골라', conf: 'CAF', str: 63 },
  { code: 'ZM', ko: '잠비아', conf: 'CAF', str: 63 },
  { code: 'UG', ko: '우간다', conf: 'CAF', str: 62 },
  { code: 'GQ', ko: '적도 기니', conf: 'CAF', str: 60 },
  { code: 'MZ', ko: '모잠비크', conf: 'CAF', str: 59 },
  { code: 'TZ', ko: '탄자니아', conf: 'CAF', str: 59 },
  { code: 'GW', ko: '기니비사우', conf: 'CAF', str: 58 },
  { code: 'NA', ko: '나미비아', conf: 'CAF', str: 58 },
  { code: 'MG', ko: '마다가스카르', conf: 'CAF', str: 58 },
  { code: 'MR', ko: '모리타니', conf: 'CAF', str: 58 },
  { code: 'ZW', ko: '짐바브웨', conf: 'CAF', str: 58 },
  { code: 'KM', ko: '코모로', conf: 'CAF', str: 58 },
  { code: 'GM', ko: '감비아', conf: 'CAF', str: 57 },
  { code: 'LY', ko: '리비아', conf: 'CAF', str: 57 },
  { code: 'KE', ko: '케냐', conf: 'CAF', str: 57 },
  { code: 'CG', ko: '콩고', conf: 'CAF', str: 57 },
  { code: 'NE', ko: '니제르', conf: 'CAF', str: 56 },
  { code: 'SD', ko: '수단', conf: 'CAF', str: 56 },
  { code: 'TG', ko: '토고', conf: 'CAF', str: 56 },
  { code: 'MW', ko: '말라위', conf: 'CAF', str: 55 },
  { code: 'SL', ko: '시에라리온', conf: 'CAF', str: 55 },
  { code: 'RW', ko: '르완다', conf: 'CAF', str: 53 },
  { code: 'LR', ko: '라이베리아', conf: 'CAF', str: 52 },
  { code: 'BW', ko: '보츠와나', conf: 'CAF', str: 52 },
  { code: 'BI', ko: '부룬디', conf: 'CAF', str: 52 },
  { code: 'ET', ko: '에티오피아', conf: 'CAF', str: 52 },
  { code: 'LS', ko: '레소토', conf: 'CAF', str: 50 },
  { code: 'CF', ko: '중앙아프리카공화국', conf: 'CAF', str: 50 },
  { code: 'SS', ko: '남수단', conf: 'CAF', str: 48 },
  { code: 'MU', ko: '모리셔스', conf: 'CAF', str: 48 },
  { code: 'SZ', ko: '에스와티니', conf: 'CAF', str: 48 },
  { code: 'DJ', ko: '지부티', conf: 'CAF', str: 46 },
  { code: 'TD', ko: '차드', conf: 'CAF', str: 46 },
  { code: 'ST', ko: '상투메 프린시페', conf: 'CAF', str: 45 },
  { code: 'SC', ko: '세이셸', conf: 'CAF', str: 45 },
  { code: 'SO', ko: '소말리아', conf: 'CAF', str: 45 },
  { code: 'ER', ko: '에리트레아', conf: 'CAF', str: 45 },
  { code: 'MX', ko: '멕시코', conf: 'CONCACAF', str: 78 },
  { code: 'US', ko: '미국', conf: 'CONCACAF', str: 78 },
  { code: 'CA', ko: '캐나다', conf: 'CONCACAF', str: 75 },
  { code: 'PA', ko: '파나마', conf: 'CONCACAF', str: 72 },
  { code: 'JM', ko: '자메이카', conf: 'CONCACAF', str: 70 },
  { code: 'CR', ko: '코스타리카', conf: 'CONCACAF', str: 70 },
  { code: 'HT', ko: '아이티', conf: 'CONCACAF', str: 66 },
  { code: 'HN', ko: '온두라스', conf: 'CONCACAF', str: 66 },
  { code: 'CW', ko: '퀴라소', conf: 'CONCACAF', str: 66 },
  { code: 'GT', ko: '과테말라', conf: 'CONCACAF', str: 62 },
  { code: 'SV', ko: '엘살바도르', conf: 'CONCACAF', str: 62 },
  { code: 'SR', ko: '수리남', conf: 'CONCACAF', str: 60 },
  { code: 'TT', ko: '트리니다드 토바고', conf: 'CONCACAF', str: 60 },
  { code: 'CU', ko: '쿠바', conf: 'CONCACAF', str: 58 },
  { code: 'GY', ko: '가이아나', conf: 'CONCACAF', str: 55 },
  { code: 'NI', ko: '니카라과', conf: 'CONCACAF', str: 55 },
  { code: 'DO', ko: '도미니카 공화국', conf: 'CONCACAF', str: 54 },
  { code: 'BM', ko: '버뮤다', conf: 'CONCACAF', str: 54 },
  { code: 'GD', ko: '그레나다', conf: 'CONCACAF', str: 52 },
  { code: 'PR', ko: '푸에르토리코', conf: 'CONCACAF', str: 52 },
  { code: 'BB', ko: '바베이도스', conf: 'CONCACAF', str: 50 },
  { code: 'BZ', ko: '벨리즈', conf: 'CONCACAF', str: 50 },
  { code: 'LC', ko: '세인트루시아', conf: 'CONCACAF', str: 50 },
  { code: 'KN', ko: '세인트키츠 네비스', conf: 'CONCACAF', str: 50 },
  { code: 'AW', ko: '아루바', conf: 'CONCACAF', str: 50 },
  { code: 'AG', ko: '앤티가 바부다', conf: 'CONCACAF', str: 50 },
  { code: 'VC', ko: '세인트빈센트 그레나딘', conf: 'CONCACAF', str: 49 },
  { code: 'BS', ko: '바하마', conf: 'CONCACAF', str: 46 },
  { code: 'KY', ko: '케이맨 제도', conf: 'CONCACAF', str: 46 },
  { code: 'DM', ko: '도미니카 연방', conf: 'CONCACAF', str: 45 },
  { code: 'MS', ko: '몬트세랫', conf: 'CONCACAF', str: 45 },
  { code: 'VI', ko: '미국령 버진아일랜드', conf: 'CONCACAF', str: 45 },
  { code: 'AI', ko: '앵귈라', conf: 'CONCACAF', str: 45 },
  { code: 'VG', ko: '영국령 버진아일랜드', conf: 'CONCACAF', str: 45 },
  { code: 'TC', ko: '터크스 케이커스 제도', conf: 'CONCACAF', str: 45 },
  { code: 'NZ', ko: '뉴질랜드', conf: 'OFC', str: 62 },
  { code: 'NC', ko: '뉴칼레도니아', conf: 'OFC', str: 52 },
  { code: 'SB', ko: '솔로몬 제도', conf: 'OFC', str: 50 },
  { code: 'FJ', ko: '피지', conf: 'OFC', str: 50 },
  { code: 'VU', ko: '바누아투', conf: 'OFC', str: 49 },
  { code: 'PF', ko: '타히티', conf: 'OFC', str: 48 },
  { code: 'PG', ko: '파푸아뉴기니', conf: 'OFC', str: 48 },
  { code: 'WS', ko: '사모아', conf: 'OFC', str: 46 },
  { code: 'AS', ko: '미국령 사모아', conf: 'OFC', str: 45 },
  { code: 'CK', ko: '쿡 제도', conf: 'OFC', str: 45 },
  { code: 'TO', ko: '통가', conf: 'OFC', str: 45 },
];

/** 국가 코드 → 국가 정보. */
export const NATION_BY_CODE: ReadonlyMap<string, Nation> = new Map(NATIONS.map((n) => [n.code, n]));

/** 신규 선수 기본 국적. */
export const DEFAULT_NATION = 'KR';

/** 지역 없는 언어 태그의 나라(ja → JP). 영어처럼 여러 나라가 쓰는 언어는 넣지 않는다. */
const LANG_NATION: Record<string, string> = {
  ko: 'KR',
  ja: 'JP',
  zh: 'CN',
  vi: 'VN',
  th: 'TH',
  id: 'ID',
};
/** 영국은 FIFA 기준 네 나라로 나뉘어 지역 GB를 잉글랜드로 본다. */
const REGION_NATION: Record<string, string> = { GB: 'GB-ENG', UK: 'GB-ENG' };

/**
 * T-11-140 선수 생성 국적 기본값: 기기·브라우저 언어 태그의 지역(ja-JP → JP, en-US → US)에서 고른다.
 * 첫 태그만 보고, 지역이 없으면 언어로(ja → JP), 고를 수 없으면 대한민국. 위치 권한·서버 요청 없이 정한다.
 */
export function nationFromLocales(tags: readonly string[]): string {
  const tag = tags.find(Boolean);
  if (!tag) return DEFAULT_NATION;
  const [lang, ...rest] = tag.replace(/_/g, '-').split('-');
  const region = rest.find((x) => /^[A-Za-z]{2}$/.test(x))?.toUpperCase();
  const code = region ? (REGION_NATION[region] ?? region) : LANG_NATION[lang!.toLowerCase()];
  return code && NATION_BY_CODE.has(code) ? code : DEFAULT_NATION;
}

/**
 * 대륙연맹별 이름 — 지역, 대륙컵, 올해의 선수상, 대륙컵 칭호(=최초 기록 id). 웹(대회·수상·칭호)과
 * API(최초 기록·팀 업적)·영구결번 점수가 모두 이 표에서 이름을 꺼낸다. 순서가 곧 화면·목록 순서다.
 */
export const CONFEDS: Record<
  Confed,
  {
    region: string;
    cup: string;
    poty: string;
    /** 자기 대륙 밖에서 뛰는 선수의 올해의 선수상(없으면 poty). */
    potyAbroad?: string;
    title: { id: string; name: string };
  }
> = {
  AFC: {
    region: '아시아',
    cup: 'AFC 아시안컵',
    poty: 'AFC 올해의 선수',
    potyAbroad: 'AFC 올해의 국제선수',
    title: { id: 'asiancup', name: '아시아의 왕' },
  },
  UEFA: {
    region: '유럽',
    cup: 'UEFA 유로',
    poty: 'UEFA 올해의 선수',
    title: { id: 'euro', name: '유럽의 왕' },
  },
  CONMEBOL: {
    region: '남미',
    cup: '코파 아메리카',
    poty: '남미 올해의 선수',
    title: { id: 'copa', name: '남미의 왕' },
  },
  CAF: {
    region: '아프리카',
    cup: '아프리카 네이션스컵',
    poty: '아프리카 올해의 선수',
    title: { id: 'afcon', name: '아프리카의 왕' },
  },
  CONCACAF: {
    region: '북중미',
    cup: 'CONCACAF 골드컵',
    poty: 'CONCACAF 올해의 선수',
    title: { id: 'goldcup', name: '북중미의 왕' },
  },
  OFC: {
    region: '오세아니아',
    cup: 'OFC 네이션스컵',
    poty: 'OFC 올해의 선수',
    title: { id: 'ofcup', name: '오세아니아의 왕' },
  },
};
export const CONF_ORDER = Object.keys(CONFEDS) as Confed[];
/** 대륙컵 우승 트로피 이름(예: 'UEFA 유로 우승'). */
export const cupTrophy = (c: Confed) => `${CONFEDS[c].cup} 우승`;
/** 대표팀 우승 트로피 — 월드컵·대륙컵(연맹 순)·아시안게임·올림픽 금메달. */
export const NATIONAL_WINS: readonly string[] = [
  'FIFA 월드컵 우승',
  ...CONF_ORDER.map(cupTrophy),
  '아시안게임 금메달',
  '올림픽 금메달',
];

/** 국기 이모지. 영국 4개 협회는 서브디비전 태그 시퀀스(🏴󠁧󠁢󠁥󠁮󠁧󠁿 등)를 쓴다. */
export function flagOf(code: string): string {
  // 잉글랜드·스코틀랜드·웨일스: 검은 깃발 + 태그 문자 + 취소 태그
  if (code === 'GB-ENG' || code === 'GB-SCT' || code === 'GB-WLS') {
    const tags = 'gb' + code.slice(3).toLowerCase();
    return String.fromCodePoint(
      0x1f3f4,
      ...[...tags].map((c) => 0xe0000 + c.charCodeAt(0)),
      0xe007f,
    );
  }
  // 북아일랜드는 공식 이모지가 없어 영국 국기로 대체
  if (code === 'GB-NIR') return '\u{1F1EC}\u{1F1E7}';
  // 그 외 2글자 코드: 지역 표시 기호(regional indicator)
  if (/^[A-Z]{2}$/.test(code)) {
    return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  }
  return '🏳️';
}
