// T-10-096 선수 국적 — FIFA 회원국 전체. str = A대표팀 전력(게임 내 60~88 척도, 대략 FIFA 랭킹 기준).
export type Confed = 'AFC' | 'UEFA' | 'CONMEBOL' | 'CAF' | 'CONCACAF' | 'OFC';
export interface Nation {
  /** 국가 코드 — ISO 3166-1 alpha-2. 잉글랜드·스코틀랜드·웨일스·북아일랜드는 'GB-ENG','GB-SCT','GB-WLS','GB-NIR'. 코소보 'XK'. */
  code: string;
  /** 한국어 이름(화면 표시). */
  ko: string;
  /** 영어 이름(FIFA 표기, 예: 'Korea Republic'). */
  en: string;
  conf: Confed;
  /** A대표팀 전력. */
  str: number;
}

// 대륙연맹 순(AFC → UEFA → CONMEBOL → CAF → CONCACAF → OFC), 연맹 안에서는 전력 내림차순 → 이름순.
export const NATIONS: readonly Nation[] = [
  { code: 'JP', ko: '일본', en: 'Japan', conf: 'AFC', str: 77 },
  { code: 'KR', ko: '대한민국', en: 'Korea Republic', conf: 'AFC', str: 75 },
  { code: 'IR', ko: '이란', en: 'IR Iran', conf: 'AFC', str: 74 },
  { code: 'AU', ko: '호주', en: 'Australia', conf: 'AFC', str: 73 },
  { code: 'SA', ko: '사우디아라비아', en: 'Saudi Arabia', conf: 'AFC', str: 69 },
  { code: 'UZ', ko: '우즈베키스탄', en: 'Uzbekistan', conf: 'AFC', str: 68 },
  { code: 'QA', ko: '카타르', en: 'Qatar', conf: 'AFC', str: 68 },
  { code: 'JO', ko: '요르단', en: 'Jordan', conf: 'AFC', str: 67 },
  { code: 'IQ', ko: '이라크', en: 'Iraq', conf: 'AFC', str: 67 },
  { code: 'AE', ko: 'UAE', en: 'United Arab Emirates', conf: 'AFC', str: 66 },
  { code: 'OM', ko: '오만', en: 'Oman', conf: 'AFC', str: 64 },
  { code: 'BH', ko: '바레인', en: 'Bahrain', conf: 'AFC', str: 63 },
  { code: 'SY', ko: '시리아', en: 'Syria', conf: 'AFC', str: 62 },
  { code: 'CN', ko: '중국', en: 'China PR', conf: 'AFC', str: 62 },
  { code: 'ID', ko: '인도네시아', en: 'Indonesia', conf: 'AFC', str: 61 },
  { code: 'TH', ko: '태국', en: 'Thailand', conf: 'AFC', str: 61 },
  { code: 'VN', ko: '베트남', en: 'Vietnam', conf: 'AFC', str: 60 },
  { code: 'KP', ko: '북한', en: 'Korea DPR', conf: 'AFC', str: 60 },
  { code: 'PS', ko: '팔레스타인', en: 'Palestine', conf: 'AFC', str: 60 },
  { code: 'TJ', ko: '타지키스탄', en: 'Tajikistan', conf: 'AFC', str: 59 },
  { code: 'KW', ko: '쿠웨이트', en: 'Kuwait', conf: 'AFC', str: 58 },
  { code: 'KG', ko: '키르기스스탄', en: 'Kyrgyz Republic', conf: 'AFC', str: 58 },
  { code: 'LB', ko: '레바논', en: 'Lebanon', conf: 'AFC', str: 56 },
  { code: 'MY', ko: '말레이시아', en: 'Malaysia', conf: 'AFC', str: 56 },
  { code: 'IN', ko: '인도', en: 'India', conf: 'AFC', str: 56 },
  { code: 'PH', ko: '필리핀', en: 'Philippines', conf: 'AFC', str: 55 },
  { code: 'TM', ko: '투르크메니스탄', en: 'Turkmenistan', conf: 'AFC', str: 54 },
  { code: 'HK', ko: '홍콩', en: 'Hong Kong', conf: 'AFC', str: 53 },
  { code: 'SG', ko: '싱가포르', en: 'Singapore', conf: 'AFC', str: 52 },
  { code: 'YE', ko: '예멘', en: 'Yemen', conf: 'AFC', str: 52 },
  { code: 'AF', ko: '아프가니스탄', en: 'Afghanistan', conf: 'AFC', str: 51 },
  { code: 'TW', ko: '대만', en: 'Chinese Taipei', conf: 'AFC', str: 50 },
  { code: 'MV', ko: '몰디브', en: 'Maldives', conf: 'AFC', str: 50 },
  { code: 'MM', ko: '미얀마', en: 'Myanmar', conf: 'AFC', str: 50 },
  { code: 'BD', ko: '방글라데시', en: 'Bangladesh', conf: 'AFC', str: 49 },
  { code: 'KH', ko: '캄보디아', en: 'Cambodia', conf: 'AFC', str: 49 },
  { code: 'NP', ko: '네팔', en: 'Nepal', conf: 'AFC', str: 48 },
  { code: 'TL', ko: '동티모르', en: 'Timor-Leste', conf: 'AFC', str: 48 },
  { code: 'LA', ko: '라오스', en: 'Laos', conf: 'AFC', str: 47 },
  { code: 'MN', ko: '몽골', en: 'Mongolia', conf: 'AFC', str: 47 },
  { code: 'GU', ko: '괌', en: 'Guam', conf: 'AFC', str: 46 },
  { code: 'MO', ko: '마카오', en: 'Macau', conf: 'AFC', str: 46 },
  { code: 'BT', ko: '부탄', en: 'Bhutan', conf: 'AFC', str: 46 },
  { code: 'BN', ko: '브루나이', en: 'Brunei Darussalam', conf: 'AFC', str: 46 },
  { code: 'LK', ko: '스리랑카', en: 'Sri Lanka', conf: 'AFC', str: 46 },
  { code: 'PK', ko: '파키스탄', en: 'Pakistan', conf: 'AFC', str: 46 },
  { code: 'ES', ko: '스페인', en: 'Spain', conf: 'UEFA', str: 88 },
  { code: 'FR', ko: '프랑스', en: 'France', conf: 'UEFA', str: 88 },
  { code: 'GB-ENG', ko: '잉글랜드', en: 'England', conf: 'UEFA', str: 86 },
  { code: 'PT', ko: '포르투갈', en: 'Portugal', conf: 'UEFA', str: 85 },
  { code: 'NL', ko: '네덜란드', en: 'Netherlands', conf: 'UEFA', str: 84 },
  { code: 'DE', ko: '독일', en: 'Germany', conf: 'UEFA', str: 84 },
  { code: 'BE', ko: '벨기에', en: 'Belgium', conf: 'UEFA', str: 82 },
  { code: 'IT', ko: '이탈리아', en: 'Italy', conf: 'UEFA', str: 82 },
  { code: 'HR', ko: '크로아티아', en: 'Croatia', conf: 'UEFA', str: 81 },
  { code: 'DK', ko: '덴마크', en: 'Denmark', conf: 'UEFA', str: 80 },
  { code: 'CH', ko: '스위스', en: 'Switzerland', conf: 'UEFA', str: 79 },
  { code: 'NO', ko: '노르웨이', en: 'Norway', conf: 'UEFA', str: 78 },
  { code: 'AT', ko: '오스트리아', en: 'Austria', conf: 'UEFA', str: 78 },
  { code: 'TR', ko: '튀르키예', en: 'Türkiye', conf: 'UEFA', str: 77 },
  { code: 'UA', ko: '우크라이나', en: 'Ukraine', conf: 'UEFA', str: 75 },
  { code: 'RS', ko: '세르비아', en: 'Serbia', conf: 'UEFA', str: 74 },
  { code: 'SE', ko: '스웨덴', en: 'Sweden', conf: 'UEFA', str: 74 },
  { code: 'GB-SCT', ko: '스코틀랜드', en: 'Scotland', conf: 'UEFA', str: 74 },
  { code: 'PL', ko: '폴란드', en: 'Poland', conf: 'UEFA', str: 74 },
  { code: 'HU', ko: '헝가리', en: 'Hungary', conf: 'UEFA', str: 74 },
  { code: 'CZ', ko: '체코', en: 'Czechia', conf: 'UEFA', str: 73 },
  { code: 'GB-WLS', ko: '웨일스', en: 'Wales', conf: 'UEFA', str: 72 },
  { code: 'RO', ko: '루마니아', en: 'Romania', conf: 'UEFA', str: 71 },
  { code: 'IE', ko: '아일랜드', en: 'Republic of Ireland', conf: 'UEFA', str: 71 },
  { code: 'GR', ko: '그리스', en: 'Greece', conf: 'UEFA', str: 70 },
  { code: 'RU', ko: '러시아', en: 'Russia', conf: 'UEFA', str: 70 },
  { code: 'SK', ko: '슬로바키아', en: 'Slovakia', conf: 'UEFA', str: 70 },
  { code: 'AL', ko: '알바니아', en: 'Albania', conf: 'UEFA', str: 69 },
  { code: 'GE', ko: '조지아', en: 'Georgia', conf: 'UEFA', str: 69 },
  { code: 'SI', ko: '슬로베니아', en: 'Slovenia', conf: 'UEFA', str: 68 },
  { code: 'BA', ko: '보스니아 헤르체고비나', en: 'Bosnia and Herzegovina', conf: 'UEFA', str: 67 },
  { code: 'FI', ko: '핀란드', en: 'Finland', conf: 'UEFA', str: 67 },
  { code: 'MK', ko: '북마케도니아', en: 'North Macedonia', conf: 'UEFA', str: 66 },
  { code: 'GB-NIR', ko: '북아일랜드', en: 'Northern Ireland', conf: 'UEFA', str: 66 },
  { code: 'IS', ko: '아이슬란드', en: 'Iceland', conf: 'UEFA', str: 66 },
  { code: 'IL', ko: '이스라엘', en: 'Israel', conf: 'UEFA', str: 66 },
  { code: 'ME', ko: '몬테네그로', en: 'Montenegro', conf: 'UEFA', str: 65 },
  { code: 'BG', ko: '불가리아', en: 'Bulgaria', conf: 'UEFA', str: 65 },
  { code: 'XK', ko: '코소보', en: 'Kosovo', conf: 'UEFA', str: 65 },
  { code: 'KZ', ko: '카자흐스탄', en: 'Kazakhstan', conf: 'UEFA', str: 62 },
  { code: 'LU', ko: '룩셈부르크', en: 'Luxembourg', conf: 'UEFA', str: 60 },
  { code: 'BY', ko: '벨라루스', en: 'Belarus', conf: 'UEFA', str: 60 },
  { code: 'AM', ko: '아르메니아', en: 'Armenia', conf: 'UEFA', str: 60 },
  { code: 'AZ', ko: '아제르바이잔', en: 'Azerbaijan', conf: 'UEFA', str: 58 },
  { code: 'CY', ko: '키프로스', en: 'Cyprus', conf: 'UEFA', str: 58 },
  { code: 'EE', ko: '에스토니아', en: 'Estonia', conf: 'UEFA', str: 57 },
  { code: 'LV', ko: '라트비아', en: 'Latvia', conf: 'UEFA', str: 56 },
  { code: 'FO', ko: '페로 제도', en: 'Faroe Islands', conf: 'UEFA', str: 56 },
  { code: 'LT', ko: '리투아니아', en: 'Lithuania', conf: 'UEFA', str: 55 },
  { code: 'MD', ko: '몰도바', en: 'Moldova', conf: 'UEFA', str: 54 },
  { code: 'MT', ko: '몰타', en: 'Malta', conf: 'UEFA', str: 52 },
  { code: 'AD', ko: '안도라', en: 'Andorra', conf: 'UEFA', str: 48 },
  { code: 'GI', ko: '지브롤터', en: 'Gibraltar', conf: 'UEFA', str: 46 },
  { code: 'LI', ko: '리히텐슈타인', en: 'Liechtenstein', conf: 'UEFA', str: 45 },
  { code: 'SM', ko: '산마리노', en: 'San Marino', conf: 'UEFA', str: 45 },
  { code: 'AR', ko: '아르헨티나', en: 'Argentina', conf: 'CONMEBOL', str: 88 },
  { code: 'BR', ko: '브라질', en: 'Brazil', conf: 'CONMEBOL', str: 86 },
  { code: 'UY', ko: '우루과이', en: 'Uruguay', conf: 'CONMEBOL', str: 80 },
  { code: 'CO', ko: '콜롬비아', en: 'Colombia', conf: 'CONMEBOL', str: 80 },
  { code: 'EC', ko: '에콰도르', en: 'Ecuador', conf: 'CONMEBOL', str: 77 },
  { code: 'PY', ko: '파라과이', en: 'Paraguay', conf: 'CONMEBOL', str: 76 },
  { code: 'CL', ko: '칠레', en: 'Chile', conf: 'CONMEBOL', str: 72 },
  { code: 'PE', ko: '페루', en: 'Peru', conf: 'CONMEBOL', str: 72 },
  { code: 'VE', ko: '베네수엘라', en: 'Venezuela', conf: 'CONMEBOL', str: 71 },
  { code: 'BO', ko: '볼리비아', en: 'Bolivia', conf: 'CONMEBOL', str: 69 },
  { code: 'MA', ko: '모로코', en: 'Morocco', conf: 'CAF', str: 81 },
  { code: 'SN', ko: '세네갈', en: 'Senegal', conf: 'CAF', str: 78 },
  { code: 'DZ', ko: '알제리', en: 'Algeria', conf: 'CAF', str: 75 },
  { code: 'EG', ko: '이집트', en: 'Egypt', conf: 'CAF', str: 75 },
  { code: 'NG', ko: '나이지리아', en: 'Nigeria', conf: 'CAF', str: 74 },
  { code: 'CI', ko: '코트디부아르', en: "Côte d'Ivoire", conf: 'CAF', str: 74 },
  { code: 'GH', ko: '가나', en: 'Ghana', conf: 'CAF', str: 72 },
  { code: 'ML', ko: '말리', en: 'Mali', conf: 'CAF', str: 72 },
  { code: 'CM', ko: '카메룬', en: 'Cameroon', conf: 'CAF', str: 72 },
  { code: 'TN', ko: '튀니지', en: 'Tunisia', conf: 'CAF', str: 72 },
  { code: 'CD', ko: '콩고민주공화국', en: 'Congo DR', conf: 'CAF', str: 70 },
  { code: 'ZA', ko: '남아프리카공화국', en: 'South Africa', conf: 'CAF', str: 69 },
  { code: 'BF', ko: '부르키나파소', en: 'Burkina Faso', conf: 'CAF', str: 69 },
  { code: 'CV', ko: '카보베르데', en: 'Cabo Verde', conf: 'CAF', str: 69 },
  { code: 'GA', ko: '가봉', en: 'Gabon', conf: 'CAF', str: 63 },
  { code: 'GN', ko: '기니', en: 'Guinea', conf: 'CAF', str: 63 },
  { code: 'BJ', ko: '베냉', en: 'Benin', conf: 'CAF', str: 63 },
  { code: 'AO', ko: '앙골라', en: 'Angola', conf: 'CAF', str: 63 },
  { code: 'ZM', ko: '잠비아', en: 'Zambia', conf: 'CAF', str: 63 },
  { code: 'UG', ko: '우간다', en: 'Uganda', conf: 'CAF', str: 62 },
  { code: 'GQ', ko: '적도 기니', en: 'Equatorial Guinea', conf: 'CAF', str: 60 },
  { code: 'MZ', ko: '모잠비크', en: 'Mozambique', conf: 'CAF', str: 59 },
  { code: 'TZ', ko: '탄자니아', en: 'Tanzania', conf: 'CAF', str: 59 },
  { code: 'GW', ko: '기니비사우', en: 'Guinea-Bissau', conf: 'CAF', str: 58 },
  { code: 'NA', ko: '나미비아', en: 'Namibia', conf: 'CAF', str: 58 },
  { code: 'MG', ko: '마다가스카르', en: 'Madagascar', conf: 'CAF', str: 58 },
  { code: 'MR', ko: '모리타니', en: 'Mauritania', conf: 'CAF', str: 58 },
  { code: 'ZW', ko: '짐바브웨', en: 'Zimbabwe', conf: 'CAF', str: 58 },
  { code: 'KM', ko: '코모로', en: 'Comoros', conf: 'CAF', str: 58 },
  { code: 'GM', ko: '감비아', en: 'Gambia', conf: 'CAF', str: 57 },
  { code: 'LY', ko: '리비아', en: 'Libya', conf: 'CAF', str: 57 },
  { code: 'KE', ko: '케냐', en: 'Kenya', conf: 'CAF', str: 57 },
  { code: 'CG', ko: '콩고', en: 'Congo', conf: 'CAF', str: 57 },
  { code: 'NE', ko: '니제르', en: 'Niger', conf: 'CAF', str: 56 },
  { code: 'SD', ko: '수단', en: 'Sudan', conf: 'CAF', str: 56 },
  { code: 'TG', ko: '토고', en: 'Togo', conf: 'CAF', str: 56 },
  { code: 'MW', ko: '말라위', en: 'Malawi', conf: 'CAF', str: 55 },
  { code: 'SL', ko: '시에라리온', en: 'Sierra Leone', conf: 'CAF', str: 55 },
  { code: 'RW', ko: '르완다', en: 'Rwanda', conf: 'CAF', str: 53 },
  { code: 'LR', ko: '라이베리아', en: 'Liberia', conf: 'CAF', str: 52 },
  { code: 'BW', ko: '보츠와나', en: 'Botswana', conf: 'CAF', str: 52 },
  { code: 'BI', ko: '부룬디', en: 'Burundi', conf: 'CAF', str: 52 },
  { code: 'ET', ko: '에티오피아', en: 'Ethiopia', conf: 'CAF', str: 52 },
  { code: 'LS', ko: '레소토', en: 'Lesotho', conf: 'CAF', str: 50 },
  { code: 'CF', ko: '중앙아프리카공화국', en: 'Central African Republic', conf: 'CAF', str: 50 },
  { code: 'SS', ko: '남수단', en: 'South Sudan', conf: 'CAF', str: 48 },
  { code: 'MU', ko: '모리셔스', en: 'Mauritius', conf: 'CAF', str: 48 },
  { code: 'SZ', ko: '에스와티니', en: 'Eswatini', conf: 'CAF', str: 48 },
  { code: 'DJ', ko: '지부티', en: 'Djibouti', conf: 'CAF', str: 46 },
  { code: 'TD', ko: '차드', en: 'Chad', conf: 'CAF', str: 46 },
  { code: 'ST', ko: '상투메 프린시페', en: 'São Tomé and Príncipe', conf: 'CAF', str: 45 },
  { code: 'SC', ko: '세이셸', en: 'Seychelles', conf: 'CAF', str: 45 },
  { code: 'SO', ko: '소말리아', en: 'Somalia', conf: 'CAF', str: 45 },
  { code: 'ER', ko: '에리트레아', en: 'Eritrea', conf: 'CAF', str: 45 },
  { code: 'MX', ko: '멕시코', en: 'Mexico', conf: 'CONCACAF', str: 78 },
  { code: 'US', ko: '미국', en: 'USA', conf: 'CONCACAF', str: 78 },
  { code: 'CA', ko: '캐나다', en: 'Canada', conf: 'CONCACAF', str: 75 },
  { code: 'PA', ko: '파나마', en: 'Panama', conf: 'CONCACAF', str: 72 },
  { code: 'JM', ko: '자메이카', en: 'Jamaica', conf: 'CONCACAF', str: 70 },
  { code: 'CR', ko: '코스타리카', en: 'Costa Rica', conf: 'CONCACAF', str: 70 },
  { code: 'HT', ko: '아이티', en: 'Haiti', conf: 'CONCACAF', str: 66 },
  { code: 'HN', ko: '온두라스', en: 'Honduras', conf: 'CONCACAF', str: 66 },
  { code: 'CW', ko: '퀴라소', en: 'Curaçao', conf: 'CONCACAF', str: 66 },
  { code: 'GT', ko: '과테말라', en: 'Guatemala', conf: 'CONCACAF', str: 62 },
  { code: 'SV', ko: '엘살바도르', en: 'El Salvador', conf: 'CONCACAF', str: 62 },
  { code: 'SR', ko: '수리남', en: 'Suriname', conf: 'CONCACAF', str: 60 },
  { code: 'TT', ko: '트리니다드 토바고', en: 'Trinidad and Tobago', conf: 'CONCACAF', str: 60 },
  { code: 'CU', ko: '쿠바', en: 'Cuba', conf: 'CONCACAF', str: 58 },
  { code: 'GY', ko: '가이아나', en: 'Guyana', conf: 'CONCACAF', str: 55 },
  { code: 'NI', ko: '니카라과', en: 'Nicaragua', conf: 'CONCACAF', str: 55 },
  { code: 'DO', ko: '도미니카 공화국', en: 'Dominican Republic', conf: 'CONCACAF', str: 54 },
  { code: 'BM', ko: '버뮤다', en: 'Bermuda', conf: 'CONCACAF', str: 54 },
  { code: 'GD', ko: '그레나다', en: 'Grenada', conf: 'CONCACAF', str: 52 },
  { code: 'PR', ko: '푸에르토리코', en: 'Puerto Rico', conf: 'CONCACAF', str: 52 },
  { code: 'BB', ko: '바베이도스', en: 'Barbados', conf: 'CONCACAF', str: 50 },
  { code: 'BZ', ko: '벨리즈', en: 'Belize', conf: 'CONCACAF', str: 50 },
  { code: 'LC', ko: '세인트루시아', en: 'St. Lucia', conf: 'CONCACAF', str: 50 },
  { code: 'KN', ko: '세인트키츠 네비스', en: 'St. Kitts and Nevis', conf: 'CONCACAF', str: 50 },
  { code: 'AW', ko: '아루바', en: 'Aruba', conf: 'CONCACAF', str: 50 },
  { code: 'AG', ko: '앤티가 바부다', en: 'Antigua and Barbuda', conf: 'CONCACAF', str: 50 },
  {
    code: 'VC',
    ko: '세인트빈센트 그레나딘',
    en: 'St. Vincent and the Grenadines',
    conf: 'CONCACAF',
    str: 49,
  },
  { code: 'BS', ko: '바하마', en: 'Bahamas', conf: 'CONCACAF', str: 46 },
  { code: 'KY', ko: '케이맨 제도', en: 'Cayman Islands', conf: 'CONCACAF', str: 46 },
  { code: 'DM', ko: '도미니카 연방', en: 'Dominica', conf: 'CONCACAF', str: 45 },
  { code: 'MS', ko: '몬트세랫', en: 'Montserrat', conf: 'CONCACAF', str: 45 },
  { code: 'VI', ko: '미국령 버진아일랜드', en: 'US Virgin Islands', conf: 'CONCACAF', str: 45 },
  { code: 'AI', ko: '앵귈라', en: 'Anguilla', conf: 'CONCACAF', str: 45 },
  {
    code: 'VG',
    ko: '영국령 버진아일랜드',
    en: 'British Virgin Islands',
    conf: 'CONCACAF',
    str: 45,
  },
  {
    code: 'TC',
    ko: '터크스 케이커스 제도',
    en: 'Turks and Caicos Islands',
    conf: 'CONCACAF',
    str: 45,
  },
  { code: 'NZ', ko: '뉴질랜드', en: 'New Zealand', conf: 'OFC', str: 62 },
  { code: 'NC', ko: '뉴칼레도니아', en: 'New Caledonia', conf: 'OFC', str: 52 },
  { code: 'SB', ko: '솔로몬 제도', en: 'Solomon Islands', conf: 'OFC', str: 50 },
  { code: 'FJ', ko: '피지', en: 'Fiji', conf: 'OFC', str: 50 },
  { code: 'VU', ko: '바누아투', en: 'Vanuatu', conf: 'OFC', str: 49 },
  { code: 'PF', ko: '타히티', en: 'Tahiti', conf: 'OFC', str: 48 },
  { code: 'PG', ko: '파푸아뉴기니', en: 'Papua New Guinea', conf: 'OFC', str: 48 },
  { code: 'WS', ko: '사모아', en: 'Samoa', conf: 'OFC', str: 46 },
  { code: 'AS', ko: '미국령 사모아', en: 'American Samoa', conf: 'OFC', str: 45 },
  { code: 'CK', ko: '쿡 제도', en: 'Cook Islands', conf: 'OFC', str: 45 },
  { code: 'TO', ko: '통가', en: 'Tonga', conf: 'OFC', str: 45 },
];

/** 국가 코드 → 국가 정보. */
export const NATION_BY_CODE: ReadonlyMap<string, Nation> = new Map(NATIONS.map((n) => [n.code, n]));

/** 신규 선수 기본 국적. */
export const DEFAULT_NATION = 'KR';

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
