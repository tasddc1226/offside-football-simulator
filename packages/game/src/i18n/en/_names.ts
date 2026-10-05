// 저장된 한국어 이름 → 영어(i18n/names.ts tn). 정확히 같은 이름을 먼저 찾고, 없으면 patterns를 위에서부터 맞춘다.
// 세이브·서버에 남거나 코드가 비교하는 이름(구단·리그·대회·단계·트로피·수상·이정표·스토리·엔딩·병역·역할)의 영어 표기다.
// 저장값은 한국어 그대로고 이 표는 화면에 그릴 때만 쓴다. 표에 없는 이름(유저가 지은 구단명 등)은 한국어 그대로 보인다.
import { CONFEDS, NATIONS } from '@offside/contracts/nations';
import { NATION_EN } from '@offside/contracts/nations-en';
import type { NameTable, NamePattern } from '../names';

// ───────── 나라 ─────────
// 영어 이름은 NATION_EN(FIFA 표기)을 쓰되, 문장 안에서 어색한 몇 개만 흔히 쓰는 이름으로 바꾼다.
const NATION_SHORT: Record<string, string> = {
  KR: 'South Korea',
  IR: 'Iran',
  CN: 'China',
  KP: 'North Korea',
  KG: 'Kyrgyzstan',
  CD: 'DR Congo',
};
const nations: Record<string, string> = {};
for (const n of NATIONS)
  if (/[가-힣]/.test(n.ko)) nations[n.ko] = NATION_SHORT[n.code] ?? NATION_EN[n.code] ?? n.ko;

// ───────── 대륙연맹 ─────────
const REGION_EN: Record<string, string> = {
  AFC: 'Asia',
  UEFA: 'Europe',
  CONMEBOL: 'South America',
  CAF: 'Africa',
  CONCACAF: 'North and Central America',
  OFC: 'Oceania',
};
const CUP_EN: Record<string, string> = {
  AFC: 'AFC Asian Cup',
  UEFA: 'UEFA Euro',
  CONMEBOL: 'Copa América',
  CAF: 'Africa Cup of Nations',
  CONCACAF: 'CONCACAF Gold Cup',
  OFC: 'OFC Nations Cup',
};
const TITLE_EN: Record<string, string> = {
  AFC: 'King of Asia',
  UEFA: 'King of Europe',
  CONMEBOL: 'King of South America',
  CAF: 'King of Africa',
  CONCACAF: 'King of North and Central America',
  OFC: 'King of Oceania',
};
const confeds: Record<string, string> = {};
for (const [k, c] of Object.entries(CONFEDS)) {
  confeds[c.region] = REGION_EN[k]!;
  confeds[c.cup] = CUP_EN[k]!;
  confeds[c.title.name] = TITLE_EN[k]!;
}

// ───────── 대회 단계 ─────────
// 문장 속에서 쓰는 형태(관사 포함). 단독으로 쓰는 단계 이름은 STAGE에 따로 있다.
const ROUND: Record<string, string> = {
  '32강': 'the round of 32',
  '16강': 'the round of 16',
  '8강': 'the quarter-finals',
  '4강': 'the semi-finals',
  결승: 'the final',
  '1라운드': 'the first round',
  '녹아웃 PO': 'the knockout play-off',
  '리그 페이즈': 'the league phase',
  조별리그: 'the group stage',
  '동메달 결정전': 'the bronze medal match',
};
const round = (tn: (ko: string) => string, ko: string) => ROUND[ko] ?? tn(ko);

// ───────── 개최지 ─────────
const HOST: Record<string, string> = {
  '미국·캐나다·멕시코': 'USA, Canada and Mexico',
  '스페인·포르투갈·모로코': 'Spain, Portugal and Morocco',
  사우디아라비아: 'Saudi Arabia',
  '일본 아이치·나고야': 'Aichi-Nagoya, Japan',
  '카타르 도하': 'Doha, Qatar',
  '사우디아라비아 리야드': 'Riyadh, Saudi Arabia',
  '미국 LA': 'Los Angeles, USA',
  '호주 브리즈번': 'Brisbane, Australia',
  '영국·아일랜드': 'UK and Ireland',
  '이탈리아·튀르키예': 'Italy and Türkiye',
  '케냐·탄자니아·우간다': 'Kenya, Tanzania and Uganda',
  '개최지 미정': 'host to be decided',
};

// 대표팀 라이벌전 이름(nation.ts RIVAL.label).
const RIVALRY: Record<string, string> = {
  한일전: 'Korea v Japan',
  '남미 최고의 라이벌전': 'South American rivalry',
  '잉글랜드-독일전': 'England v Germany',
  '독일-네덜란드전': 'Germany v Netherlands',
  '네덜란드-독일전': 'Netherlands v Germany',
  '이베리아 더비': 'Iberian derby',
  '프랑스-이탈리아전': 'France v Italy',
  '이탈리아-프랑스전': 'Italy v France',
  '북중미 라이벌전': 'North American rivalry',
};

// ───────── 리그 · 구단 ─────────
const LEAGUE: Record<string, string> = {
  '고교 리그': 'High school league',
  'U리그 (대학)': 'U-League (university)',
  K3리그: 'K3 League',
  K리그2: 'K League 2',
  K리그1: 'K League 1',
  J1리그: 'J1 League',
  MLS: 'MLS',
  에레디비시: 'Eredivisie',
  '리그 1': 'Ligue 1',
  분데스리가: 'Bundesliga',
  '세리에 A': 'Serie A',
  라리가: 'La Liga',
  프리미어리그: 'Premier League',
  J리그: 'J.League',
};
const LEAGUE_NAMES = new Set(Object.keys(LEAGUE));

// 구단은 이름으로 짝을 짓는다(club-names.ts CLUB_NAMES 순서가 바뀌어도 이 표는 어긋나지 않는다).
const CLUB: Record<string, string> = {
  // hs
  한빛고: 'Hanbit High',
  청운고: 'Cheongun High',
  서해공고: 'Seohae Technical High',
  동진고: 'Dongjin High',
  태백고: 'Taebaek High',
  남강고: 'Namgang High',
  금성고: 'Geumseong High',
  새봄고: 'Saebom High',
  해오름고: 'Haeoreum High',
  푸른솔고: 'Pureunsol High',
  대림공고: 'Daerim Technical High',
  백운고: 'Baegun High',
  // uni
  한성대: 'Hanseong Univ.',
  청명대: 'Cheongmyeong Univ.',
  동원대: 'Dongwon Univ.',
  서라벌대: 'Seorabeol Univ.',
  백제대: 'Baekje Univ.',
  금강대: 'Geumgang Univ.',
  한울대: 'Hanul Univ.',
  가람대: 'Garam Univ.',
  새누리대: 'Saenuri Univ.',
  늘봄대: 'Neulbom Univ.',
  태화대: 'Taehwa Univ.',
  온누리대: 'Onnuri Univ.',
  // k3
  '경주 원자력': 'Gyeongju Nuclear',
  '창원 시티': 'Changwon City',
  '부산 레일웨이': 'Busan Railway',
  '양평 리버사이드': 'Yangpyeong Riverside',
  '대전 레일로더스': 'Daejeon Railroaders',
  '포천 마운틴스': 'Pocheon Mountains',
  '강릉 씨사이드': 'Gangneung Seaside',
  '시흥 웨이브': 'Siheung Wave',
  '울산 고래시티': 'Ulsan Whale City',
  '전북 그린모터스 N': 'Jeonbuk Green Motors N',
  '춘천 레이크사이드': 'Chuncheon Lakeside',
  '목포 하버라이트': 'Mokpo Harbor Light',
  '여주 리버밸리': 'Yeoju River Valley',
  '당진 해나루': 'Dangjin Haenaru',
  // k2
  '수원 블루윙': 'Suwon Blue Wings',
  '부산 아이콘스': 'Busan Icons',
  '서울 E-랜더스': 'Seoul E-Landers',
  '전남 드래건스': 'Jeonnam Dragons',
  '성남 까치군단': 'Seongnam Magpies',
  '대구 스카이블루': 'Daegu Sky Blue',
  '수원 캐슬': 'Suwon Castle',
  '경남 레드윙스': 'Gyeongnam Red Wings',
  '김포 골드웨이브': 'Gimpo Gold Wave',
  '충남 아산 레인보우': 'Chungnam Asan Rainbow',
  '천안 스카이울브스': 'Cheonan Sky Wolves',
  '충북 청주 레이더스': 'Chungbuk Cheongju Raiders',
  '안산 그린포레스트': 'Ansan Green Forest',
  '김해 가야시티': 'Gimhae Gaya City',
  '화성 드림': 'Hwaseong Dream',
  '용인 미르': 'Yongin Mir',
  '파주 보더라인': 'Paju Borderline',
  // k1
  '울산 블루타이거즈': 'Ulsan Blue Tigers',
  '전북 그린모터스': 'Jeonbuk Green Motors',
  '포항 스틸웨이브': 'Pohang Steel Wave',
  'FC 서울시티': 'FC Seoul City',
  '대전 퍼플시티즌': 'Daejeon Purple Citizens',
  '인천 하버 유나이티드': 'Incheon Harbor United',
  '강원 마운틴스': 'Gangwon Mountains',
  '광주 옐로우썬더': 'Gwangju Yellow Thunder',
  '제주 오렌지윙스': 'Jeju Orange Wings',
  '안양 바이올렛': 'Anyang Violet',
  '부천 95': 'Bucheon 95',
  // j1
  '우라와 다이아몬즈': 'Urawa Diamonds',
  '고베 빅토리': 'Kobe Victory',
  '가시마 사슴뿔': 'Kashima Antlers',
  '요코하마 트리콜로레': 'Yokohama Tricolore',
  '가와사키 블루돌핀': 'Kawasaki Blue Dolphins',
  '히로시마 트리플애로우': 'Hiroshima Triple Arrows',
  '가시와 옐로우선': 'Kashiwa Yellow Sun',
  '마치다 블루스카이': 'Machida Blue Sky',
  '오사카 블루블랙': 'Osaka Blue Black',
  'FC 도쿄 블루레드': 'FC Tokyo Blue Red',
  '나고야 붉은 범고래': 'Nagoya Red Orcas',
  '교토 퍼플': 'Kyoto Purple',
  '오사카 체리핑크': 'Osaka Cherry Pink',
  '도쿄 베르디그린': 'Tokyo Verdi Green',
  '후쿠오카 벌룬스': 'Fukuoka Balloons',
  '시미즈 오렌지펄스': 'Shimizu Orange Pulse',
  '오카야마 꿩군단': 'Okayama Pheasants',
  '나가사키 세일러즈': 'Nagasaki Sailors',
  '지바 캐너리즈': 'Chiba Canaries',
  '미토 접시꽃': 'Mito Hollyhocks',
  // mls
  '마이애미 핑크헤론스': 'Miami Pink Herons',
  '필라델피아 자유의 종': 'Philadelphia Liberty Bell',
  '밴쿠버 하얀 파도': 'Vancouver White Waves',
  '로스앤젤레스 블랙앤골드': 'Los Angeles Black & Gold',
  '샌디에이고 태평양': 'San Diego Pacific',
  '신시내티 오렌지 사자': 'Cincinnati Orange Lions',
  '콜럼버스 노란 일꾼들': 'Columbus Yellow Crew',
  '시애틀 사운드 그린': 'Seattle Sound Green',
  '미네소타 룬스': 'Minnesota Loons',
  '샬럿 퀸시티': 'Charlotte Queen City',
  '뉴욕 스카이라인': 'New York Skyline',
  '내슈빌 코요테스': 'Nashville Coyotes',
  '포틀랜드 벌목꾼들': 'Portland Lumberjacks',
  '오스틴 베르데': 'Austin Verde',
  '올랜도 퍼플라이언스': 'Orlando Purple Lions',
  '시카고 불꽃': 'Chicago Flames',
  '뉴저지 붉은 황소': 'New Jersey Red Bulls',
  '솔트레이크 클라렛': 'Salt Lake Claret',
  '새너제이 지진': 'San Jose Quakes',
  '콜로라도 급류': 'Colorado Rapids',
  '휴스턴 오렌지 다이너모': 'Houston Orange Dynamo',
  '로스앤젤레스 은하수': 'Los Angeles Galaxy',
  '애틀랜타 파이브 스트라이프스': 'Atlanta Five Stripes',
  '세인트루이스 시티 레드': 'St. Louis City Red',
  '캔자스시티 스포팅 블루': 'Kansas City Sporting Blue',
  '워싱턴 블랙 이글스': 'Washington Black Eagles',
  '몬트리올 블뢰블랑': 'Montreal Bleu Blanc',
  '토론토 레드 노스': 'Toronto Red North',
  '뉴잉글랜드 혁명군': 'New England Revolutionaries',
  '댈러스 후프스': 'Dallas Hoops',
  // ere
  '암스테르담 아이아스': 'Amsterdam Ajax',
  '에인트호번 필립스': 'Eindhoven Philips',
  '로테르담 페예': 'Rotterdam Feye',
  '알크마르 치즈메이커스': 'Alkmaar Cheesemakers',
  '엔스헤데 트벤테': 'Enschede Twente',
  '위트레흐트 돔': 'Utrecht Dom',
  '데벤터르 이글스': 'Deventer Eagles',
  '네이메헌 레드그린': 'Nijmegen Red Green',
  '헤이렌베인 프리슬란트': 'Heerenveen Friesland',
  '로테르담 스파르탄스': 'Rotterdam Spartans',
  '즈볼레 블루핑거스': 'Zwolle Blue Fingers',
  '흐로닝언 노스프라이드': 'Groningen North Pride',
  '시타르트 포르투나': 'Sittard Fortuna',
  '브레다 옐로블랙': 'Breda Yellow Black',
  '알멜로 헤라클레스': 'Almelo Hercules',
  '로테르담 크랄링언': 'Rotterdam Kralingen',
  '벨선 화이트엔젤스': 'Velsen White Angels',
  '폴렌담 어부들': 'Volendam Fishermen',
  // l1
  '파리 레 파리지앵': 'Paris Les Parisiens',
  '마르세유 올랭피크': 'Marseille Olympique',
  '모나코 로열': 'Monaco Royal',
  '릴 레 도그': 'Lille Les Dogues',
  '리옹 레 고네': 'Lyon Les Gones',
  '니스 레 제글롱': 'Nice Les Aiglons',
  '랑스 상 에 오르': 'Lens Sang et Or',
  '렌 루주 에 누아르': 'Rennes Rouge et Noir',
  '스트라스부르 라 라시': 'Strasbourg La Racing',
  '툴루즈 레 비올레': 'Toulouse Les Violets',
  '브레스트 레 피라트': 'Brest Les Pirates',
  '낭트 레 카나리': 'Nantes Les Canaris',
  '파리 FC 센': 'Paris FC Seine',
  '오세르 부르고뉴': 'Auxerre Burgundy',
  '앙제 블랑 에 누아르': 'Angers Blanc et Noir',
  '르아브르 도커스': 'Le Havre Dockers',
  '로리앙 레 메를뤼': 'Lorient Les Merlus',
  '메스 그르나': 'Metz Grenats',
  // bl
  '뮌헨 바이에른 로트': 'Munich Bayern Rot',
  '도르트문트 슈바르츠겔브': 'Dortmund Schwarzgelb',
  '레버쿠젠 베르크셀프': 'Leverkusen Werkself',
  '라이프치히 황소군단': 'Leipzig Bulls',
  '프랑크푸르트 아들러': 'Frankfurt Adler',
  '슈투트가르트 슈바벤': 'Stuttgart Swabians',
  '프라이부르크 브라이스가우': 'Freiburg Breisgau',
  '볼프스부르크 그린울브스': 'Wolfsburg Green Wolves',
  '묀헨글라트바흐 망아지군단': 'Mönchengladbach Foals',
  '마인츠 카니발': 'Mainz Carnival',
  '베를린 유니온 아이언': 'Berlin Union Iron',
  '브레멘 베르더 그린': 'Bremen Werder Green',
  '호펜하임 크라이히가우': 'Hoffenheim Kraichgau',
  '아우크스부르크 푸거슈타트': 'Augsburg Fuggerstadt',
  '함부르크 레드쇼츠': 'Hamburg Red Shorts',
  '쾰른 산양군단': 'Cologne Billy Goats',
  '함부르크 해적깃발': 'Hamburg Jolly Roger',
  '하이덴하임 브렌츠': 'Heidenheim Brenz',
  // sa
  '밀라노 네라주리': 'Milan Nerazzurri',
  '토리노 비앙코네리': 'Turin Bianconeri',
  '나폴리 파르테노페이': 'Naples Partenopei',
  '밀라노 로소네리': 'Milan Rossoneri',
  '베르가모 라 데아': 'Bergamo La Dea',
  '로마 잘로로시': 'Rome Giallorossi',
  '로마 비앙코첼레스티': 'Rome Biancocelesti',
  '코모 라리아니': 'Como Lariani',
  '볼로냐 로소블루': 'Bologna Rossoblu',
  '피렌체 비올라': 'Florence Viola',
  '토리노 그라나타': 'Turin Granata',
  '우디네 프리울리': 'Udine Friuli',
  '제노바 그리포네': 'Genoa Grifone',
  '파르마 크로치아티': 'Parma Crociati',
  '칼리아리 사르데냐': 'Cagliari Sardinia',
  '사수올로 네로베르디': 'Sassuolo Neroverdi',
  '레체 살렌티니': 'Lecce Salentini',
  '베로나 스칼리제리': 'Verona Scaligeri',
  '크레모나 그리지오로시': 'Cremona Grigiorossi',
  '피사 네로아주리': 'Pisa Neroazzurri',
  // ll
  '마드리드 로스 블랑코스': 'Madrid Los Blancos',
  '바르셀로나 블라우그라나': 'Barcelona Blaugrana',
  '마드리드 콜초네로스': 'Madrid Colchoneros',
  '빌바오 레오네스': 'Bilbao Leones',
  '비야레알 노란 잠수함': 'Villarreal Yellow Submarine',
  '세비야 네르비온': 'Seville Nervion',
  '산세바스티안 추리우르딘': 'San Sebastián Txuri-Urdin',
  '세비야 베르디블랑코스': 'Seville Verdiblancos',
  '비고 셀레스테스': 'Vigo Celestes',
  '발렌시아 박쥐군단': 'Valencia Bats',
  '팜플로나 로히요스': 'Pamplona Rojillos',
  '마드리드 번개': 'Madrid Lightning',
  '헤타페 아술로네스': 'Getafe Azulones',
  '지로나 블랑키베르메이스': 'Girona Blanquivermells',
  '바르셀로나 페리코스': 'Barcelona Periquitos',
  '마요르카 베르메욘스': 'Mallorca Bermellones',
  '비토리아 바바소로스': 'Vitoria Babazorros',
  '엘체 프란하베르데스': 'Elche Franjiverdes',
  '발렌시아 그라노테스': 'Valencia Granotes',
  '오비에도 카르바요네스': 'Oviedo Carbayones',
  // pl
  '맨체스터 스카이블루': 'Manchester Sky Blue',
  '리버풀 더 레즈': 'Liverpool The Reds',
  '런던 거너스': 'London Gunners',
  '런던 블루스': 'London Blues',
  '맨체스터 레드데블스': 'Manchester Red Devils',
  '런던 스퍼스': 'London Spurs',
  '뉴캐슬 맥파이스': 'Newcastle Magpies',
  '버밍엄 빌런스': 'Birmingham Villans',
  '브라이턴 시걸스': 'Brighton Seagulls',
  '노팅엄 포레스터스': 'Nottingham Foresters',
  '런던 비즈': 'London Bees',
  '런던 이글스': 'London Eagles',
  '본머스 체리스': 'Bournemouth Cherries',
  '런던 코티저스': 'London Cottagers',
  '리버풀 토피스': 'Liverpool Toffees',
  '런던 해머스': 'London Hammers',
  '울버햄튼 울브스': 'Wolverhampton Wolves',
  '리즈 화이트스': 'Leeds Whites',
  '선덜랜드 블랙캣츠': 'Sunderland Black Cats',
  '번리 클라레츠': 'Burnley Clarets',

  '김천 상무': 'Gimcheon Sangmu',
  '김천 상무 (국군체육부대)': 'Gimcheon Sangmu (Armed Forces Athletic Corps)',
};

// ───────── 대회 · 시상 ─────────
const COMP: Record<string, string> = {
  // 국내 컵
  전국고교축구선수권: 'National High School Championship',
  전국대학축구선수권: 'National University Championship',
  코리아컵: 'Korea Cup',
  일왕배: "Emperor's Cup",
  J리그컵: 'J.League Cup',
  'US 오픈컵': 'US Open Cup',
  리그스컵: 'Leagues Cup',
  KNVB컵: 'KNVB Cup',
  '쿠프 드 프랑스': 'Coupe de France',
  'DFB-포칼': 'DFB-Pokal',
  '코파 이탈리아': 'Coppa Italia',
  '코파 델 레이': 'Copa del Rey',
  FA컵: 'FA Cup',
  EFL컵: 'EFL Cup',
  // 슈퍼컵
  'FA 커뮤니티 실드': 'FA Community Shield',
  '수페르코파 데 에스파냐': 'Supercopa de España',
  '수페르코파 이탈리아나': 'Supercoppa Italiana',
  'DFL 슈퍼컵': 'DFL-Supercup',
  '트로페 데 샹피옹': 'Trophée des Champions',
  '요한 크라위프 스할': 'Johan Cruyff Shield',
  '재팬 슈퍼컵': 'Japan Super Cup',
  // 대륙 클럽 대회
  'UEFA 챔피언스리그': 'UEFA Champions League',
  'UEFA 유로파리그': 'UEFA Europa League',
  'UEFA 컨퍼런스리그': 'UEFA Conference League',
  'AFC 챔피언스리그 엘리트': 'AFC Champions League Elite',
  'AFC 챔피언스리그 2': 'AFC Champions League Two',
  'CONCACAF 챔피언스컵': 'CONCACAF Champions Cup',
  챔피언스리그: 'Champions League',
  'FIFA 클럽 월드컵': 'FIFA Club World Cup',
  // 국가대표 대회
  'FIFA 월드컵': 'FIFA World Cup',
  월드컵: 'World Cup',
  아시안게임: 'Asian Games',
  올림픽: 'Olympics',
  '올림픽 남자축구': 'Olympic men’s football',
  'AFC U-23 아시안컵': 'AFC U-23 Asian Cup',
  '친선 A매치': 'International friendly',
};

const AWARD: Record<string, string> = {
  // 아마추어
  득점왕: 'Top scorer',
  도움왕: 'Top assister',
  '대회 MVP': 'Tournament MVP',
  '대회 베스트 11': 'Tournament Best XI',
  // 리그 득점상 · 올해의 선수 · 영플레이어(이름이 틀에 안 맞는 것)
  '피치치 트로피': 'Pichichi Trophy',
  카포칸노니에레: 'Capocannoniere',
  토르예거카논: 'Torjägerkanone',
  'K리그1 영플레이어상': 'K League 1 Young Player Award',
  'K리그2 영플레이어상': 'K League 2 Young Player Award',
  'J리그 베스트 영플레이어상': 'J.League Best Young Player Award',
  // 시상식
  발롱도르: 'Ballon d’Or',
  '발롱도르 수상!': 'Ballon d’Or winner!',
  '코파 트로피': 'Kopa Trophy',
  '야신 트로피': 'Yashin Trophy',
  'FIFA 더 베스트 남자 선수': 'FIFA The Best Men’s Player',
  'FIFPRO 월드 11': 'FIFPRO World XI',
  '게르트 뮐러 트로피': 'Gerd Müller Trophy',
  '유러피언 골든슈': 'European Golden Shoe',
  'FIFA 푸스카스상': 'FIFA Puskás Award',
  대한축구협회: 'Korea Football Association',
  '대한축구협회 올해의 선수': 'Korea Football Association Player of the Year',
  // 대표팀 메달
  '아시안게임 금메달': 'Asian Games gold medal',
  '올림픽 금메달': 'Olympic gold medal',
  '올림픽 은메달': 'Olympic silver medal',
  '올림픽 동메달': 'Olympic bronze medal',
};

const STAGE: Record<string, string> = {
  우승: 'Winners',
  준우승: 'Runners-up',
  금메달: 'Gold medal',
  은메달: 'Silver medal',
  동메달: 'Bronze medal',
  '4위': 'Fourth place',
  '32강': 'Round of 32',
  '16강': 'Round of 16',
  '8강': 'Quarter-finals',
  '4강': 'Semi-finals',
  결승: 'Final',
  '1라운드': 'First round',
  '녹아웃 PO': 'Knockout play-off',
  '리그 페이즈': 'League phase',
  조별리그: 'Group stage',
  '동메달 결정전': 'Bronze medal match',
  '조별리그 탈락': 'Out in the group stage',
  '본선 진출 실패': 'Failed to qualify',
  '본선 진출 확정': 'Qualified',
  진행: 'In progress',
};

const PHASE: Record<string, string> = {
  프리시즌: 'Pre-season',
  전반기: 'First half',
  후반기: 'Second half',
  '시즌 종료': 'Season end',
};

// ───────── 이정표 · 스토리 · 병역 · 역할 · 기타 ─────────
const MISC: Record<string, string> = {
  // 이정표
  '프로 데뷔골': 'First pro goal',
  '챔피언스리그 결승 무대': 'Champions League final appearance',
  'A매치 데뷔': 'International debut',
  'A매치 데뷔골': 'First international goal',
  '센추리 클럽 가입 (A매치 100경기)': 'Joined the century club (100 caps)',
  '국가대표팀 주장 선임': 'Named national team captain',
  '월드컵 본선 출전': 'Played at a World Cup',
  '월드컵 본선 득점': 'Scored at a World Cup',
  '발롱도르 30인 후보 선정': 'Named in the Ballon d’Or top 30',
  'A대표팀 은퇴 경기': 'National team farewell match',
  // 스토리 이름
  '평생의 라이벌': 'Lifelong rival',
  '재활의 시간': 'Road to recovery',
  스캔들: 'Scandal',
  '유럽의 꿈': 'European dream',
  '감독과의 인연': 'Bond with the manager',
  // 스토리 결말(칭호 키이기도 하다)
  '끝내 넘어선 벽': 'Finally over the wall',
  '영원한 2인자': 'Forever second best',
  '라이벌에서 동료로': 'From rivals to teammates',
  '어색한 휴전': 'An awkward truce',
  '더 강해져서 돌아왔다': 'Came back stronger',
  '조용한 복귀': 'A quiet return',
  '긴 터널을 지나': 'Through the long tunnel',
  '없던 일로': 'As if it never happened',
  '진심은 통한다': 'Sincerity wins through',
  '실력이 곧 해명': 'Form is the answer',
  '지워지지 않는 꼬리표': 'A label that stuck',
  '완벽한 적응': 'A perfect fit',
  '느린 적응': 'Slow to settle',
  '말보다 실력': 'Skill over words',
  '말보다 골': 'Goals over words',
  향수병: 'Homesick',
  '이루지 못한 꿈': 'The dream that never came true',
  '은사와 함께': 'Together with the mentor',
  홀로서기: 'Standing on your own',
  '흐지부지 끝난 이야기': 'A story that fizzled out',
  // 병역
  '현역 복무': 'Active-duty service',
  병역: 'Military service',
  // 역할
  주전: 'Starter',
  로테이션: 'Rotation',
  벤치: 'Bench',
  '주전 보장': 'Guaranteed starter',
  '벤치 경쟁': 'Fight for a place',
  '은사의 부름 · 감독 신뢰 두터움': 'Old mentor calls · Strong manager trust',
  '입단 테스트 합격 · 세미프로': 'Passed the trial · Semi-pro',
  '하부 리그 · 재기 도전': 'Lower league · Comeback bid',
  // 발
  오른발: 'Right foot',
  왼발: 'Left foot',
  양발: 'Both feet',
  // 포지션
  공격수: 'Forward',
  미드필더: 'Midfielder',
  수비수: 'Defender',
  골키퍼: 'Goalkeeper',
};

// ───────── 이름이 이어 붙은 것 ─────────
const PLAYER_AWARD: Record<string, string> = {
  선수: 'Player',
  국제선수: 'International Player',
  영플레이어: 'Young Player',
  수비수: 'Defender',
  골키퍼: 'Goalkeeper',
  미드필더: 'Midfielder',
};
const MONTH = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ordinal = (n: number) => {
  const r = n % 100;
  return `${n}${r >= 11 && r <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
};
const MEDAL: Record<string, string> = { 금: 'gold', 은: 'silver', 동: 'bronze' };
const host = (tn: (ko: string) => string, ko: string | undefined) =>
  ko ? ` (${HOST[ko] ?? tn(ko)})` : '';

const patterns: NamePattern[] = [
  // 로그 시각 라벨 `2026 프리시즌`
  [/^(\d{4}) (프리시즌|전반기|후반기|시즌 종료)$/, (m) => `${m[1]} ${PHASE[m[2]!]}`],
  // 대표팀 대회 이름 `2026 FIFA 월드컵 (미국·캐나다·멕시코)`
  [
    /^(\d{4}) (FIFA 월드컵|AFC 아시안컵|코파 아메리카|아프리카 네이션스컵|CONCACAF 골드컵|OFC 네이션스컵|아시안게임|올림픽 남자축구)(?: \((.+)\))?$/,
    (m, tn) => `${m[1]} ${tn(m[2]!)}${host(tn, m[3])}`,
  ],
  [/^UEFA 유로 (\d{4})(?: \((.+)\))?$/, (m, tn) => `UEFA Euro ${m[1]}${host(tn, m[2])}`],
  [/^(\d{4}) 월드컵 (.+) 예선$/, (m, tn) => `${m[1]} World Cup qualifying (${tn(m[2]!)})`],
  [
    /^(\d{4}) 올림픽 아시아 예선 \(AFC U-23 아시안컵\)$/,
    (m) => `${m[1]} Olympic qualifying, Asia (AFC U-23 Asian Cup)`,
  ],
  [/^(\d{4}) 올림픽 (.+) 예선$/, (m, tn) => `${m[1]} Olympic qualifying (${tn(m[2]!)})`],
  [/^(\d+)월 A매치$/, (m) => `${MONTH[Number(m[1]) - 1] ?? m[1]} internationals`],
  [/^(.+) U-23$/, (m, tn) => `${tn(m[1]!)} U-23`],
  // 단계
  [/^(.+) 통과$/, (m, tn) => `Through ${round(tn, m[1]!)}`],
  [/^(.+) 탈락$/, (m, tn) => `Out in ${round(tn, m[1]!)}`],
  [/^(.+) 진출$/, (m, tn) => `Into ${round(tn, m[1]!)}`],
  [/^(.+) 직행$/, (m, tn) => `Straight into ${round(tn, m[1]!)}`],
  // 트로피
  [/^(.+) 우승$/, (m, tn) => `${tn(m[1]!)} ${LEAGUE_NAMES.has(m[1]!) ? 'champions' : 'winners'}`],
  [/^올림픽 (금|은|동)메달$/, (m) => `Olympic ${MEDAL[m[1]!]} medal`],
  // 수상
  [/^(.+) 축구협회 올해의 선수$/, (m, tn) => `${tn(m[1]!)} FA Player of the Year`],
  [/^(.+) 올해의 팀$/, (m, tn) => `${tn(m[1]!)} Team of the Year`],
  [
    /^(.+) 올해의 (선수|국제선수|영플레이어|수비수|골키퍼|미드필더)$/,
    (m, tn) => `${tn(m[1]!)} ${PLAYER_AWARD[m[2]!]} of the Year`,
  ],
  [/^(.+) 베스트 11$/, (m, tn) => `${tn(m[1]!)} Best XI`],
  [/^(.+) 득점왕$/, (m, tn) => `${tn(m[1]!)} top scorer`],
  [/^(.+) 도움왕$/, (m, tn) => `${tn(m[1]!)} top assister`],
  [/^(.+) 골든부트$/, (m, tn) => `${tn(m[1]!)} Golden Boot`],
  [/^(.+) MVP$/, (m, tn) => `${tn(m[1]!)} MVP`],
  [
    /^발롱도르 (\d+)위 \(30인 후보\)$/,
    (m) => `Ballon d’Or: ${ordinal(Number(m[1]))} (30-player shortlist)`,
  ],
  // 이정표
  [/^프로 데뷔 \((.+)\)$/, (m, tn) => `Pro debut (${tn(m[1]!)})`],
  [/^프로 통산 (\d+)경기 출전$/, (m) => `${m[1]} pro appearances`],
  [/^프로 통산 (\d+)골$/, (m) => `${m[1]} pro goals`],
  [/^유럽 무대 진출 \((.+)\)$/, (m, tn) => `Moved to Europe (${tn(m[1]!)})`],
  [/^유럽 5대 리그 입성 \((.+)\)$/, (m, tn) => `Joined a top-five European league (${tn(m[1]!)})`],
  [/^미국 무대 진출 \((.+)\)$/, (m, tn) => `Moved to the USA (${tn(m[1]!)})`],
  [/^(.+) 데뷔$/, (m, tn) => `${tn(m[1]!)} debut`],
  [/^(.+) 데뷔골$/, (m, tn) => `${tn(m[1]!)} first goal`],
  [/^A매치 (\d+)경기 출전$/, (m) => `${m[1]} caps`],
  [/^(.+) 한 팀에서 5시즌$/, (m, tn) => `Five seasons at ${tn(m[1]!)}`],
  [
    /^원클럽맨 · (.+) 헌정 \(No\.(\d+)\)$/,
    (m, tn) => `One-club man · ${tn(m[1]!)} tribute (No. ${m[2]})`,
  ],
  [/^(.+) 레전드 헌정$/, (m, tn) => `${tn(m[1]!)} legend tribute`],
  [/^(.+) 홈구장에서 은퇴 경기$/, (m, tn) => `Farewell match at ${tn(m[1]!)}’s home stadium`],
  // 스토리 · 병역 · 시즌 결산
  [/^「(.+)」 (.+)$/, (m, tn) => `${tn(m[1]!)}: ${tn(m[2]!)}`],
  [/^FIFA 클럽 월드컵 (.+)$/, (m, tn) => `FIFA Club World Cup: ${tn(m[1]!)}`],
  [/^병역 특례\(입대 면제\) · (.+)$/, (m, tn) => `Military service exemption · ${tn(m[1]!)}`],
];

export const names: NameTable = {
  exact: {
    ...nations,
    ...confeds,
    ...LEAGUE,
    ...CLUB,
    ...COMP,
    ...AWARD,
    ...STAGE,
    ...PHASE,
    ...MISC,
    ...HOST,
    ...RIVALRY,
  },
  patterns,
};
