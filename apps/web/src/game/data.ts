// ───────── 정적 데이터: 리그 · 클럽 · 포지션 · 유형 · 특성 ─────────
export interface League {
  id: string;
  name: string;
  tier: number;
  avg: number;
  spread: number;
  wealth: number;
  matches: number;
  amateur?: boolean;
}
export const LEAGUES: League[] = [
  { id: 'hs', name: '고교 리그', tier: 0, avg: 46, spread: 5, wealth: 0, matches: 20, amateur: true },
  { id: 'uni', name: 'U리그 (대학)', tier: 0, avg: 52, spread: 5, wealth: 0, matches: 20, amateur: true },
  { id: 'k3', name: 'K3리그', tier: 0, avg: 51, spread: 5, wealth: 1.5, matches: 28 },
  { id: 'k2', name: 'K리그2', tier: 1, avg: 57, spread: 5, wealth: 4, matches: 36 },
  { id: 'k1', name: 'K리그1', tier: 2, avg: 63, spread: 6, wealth: 7, matches: 38 },
  { id: 'j1', name: 'J1리그', tier: 3, avg: 65, spread: 6, wealth: 9, matches: 38 },
  // T-10-016 미국 MLS. 유럽이 아니라 J1과 같은 tier 3(해외·단일 연도 시즌)에 두고, 전력은 J1보다 조금 위, 자금력은 에레디비시 위.
  { id: 'mls', name: 'MLS', tier: 3, avg: 66, spread: 7, wealth: 14, matches: 34 },
  { id: 'ere', name: '에레디비시', tier: 4, avg: 68, spread: 7, wealth: 12, matches: 34 },
  { id: 'l1', name: '리그 1', tier: 5, avg: 71, spread: 7, wealth: 18, matches: 34 },
  { id: 'bl', name: '분데스리가', tier: 6, avg: 74, spread: 7, wealth: 24, matches: 34 },
  { id: 'sa', name: '세리에 A', tier: 6, avg: 74, spread: 7, wealth: 24, matches: 38 },
  { id: 'll', name: '라리가', tier: 7, avg: 76, spread: 8, wealth: 30, matches: 38 },
  { id: 'pl', name: '프리미어리그', tier: 8, avg: 78, spread: 7, wealth: 40, matches: 38 },
];

// T-10-009: 리그마다 실제 참가 팀 수만큼 클럽을 둔다(국내 2026 시즌, 유럽 2025-26 시즌 기준). 이름은
// 실명이 아닌 별칭이고, 배열 순서가 곧 전력 순서다. 고교·대학은 단일 리그가 없어 권역 리그 한 조 규모(12)로
// 둔다. K리그1은 11개 + 병역 중에만 소속되는 김천 상무(military.SANGMU)로 12개다.
// 클럽 id는 `${리그}-${배열 위치}`라 위치를 바꾸면 기존 저장의 현재 소속이 다른 이름으로 바뀐다(boot.ts가
// id로 최신 이름을 덮는다) — 새 클럽은 뒤에 붙이고, 앞쪽 순서는 되도록 건드리지 않는다.
const CLUB_NAMES: Record<string, string[]> = {
  hs: ['한빛고', '청운고', '서해공고', '동진고', '태백고', '남강고', '금성고', '새봄고', '해오름고', '푸른솔고', '대림공고', '백운고'],
  uni: ['한성대', '청명대', '동원대', '서라벌대', '백제대', '금강대', '한울대', '가람대', '새누리대', '늘봄대', '태화대', '온누리대'],
  k3: [
    '경주 원자력', '창원 시티', '부산 레일웨이', '양평 리버사이드', '대전 레일로더스', '포천 마운틴스', '강릉 씨사이드',
    '시흥 웨이브', '울산 고래시티', '전북 그린모터스 N', '춘천 레이크사이드', '목포 하버라이트', '여주 리버밸리', '당진 해나루',
  ],
  k2: [
    '수원 블루윙', '부산 아이콘스', '서울 E-랜더스', '전남 드래건스', '성남 까치군단', '대구 스카이블루', '수원 캐슬',
    '경남 레드윙스', '김포 골드웨이브', '충남 아산 레인보우', '천안 스카이울브스', '충북 청주 레이더스', '안산 그린포레스트',
    '김해 가야시티', '화성 드림', '용인 미르', '파주 보더라인',
  ],
  k1: [
    '울산 블루타이거즈', '전북 그린모터스', '포항 스틸웨이브', 'FC 서울시티', '대전 퍼플시티즌', '인천 하버 유나이티드',
    '강원 마운틴스', '광주 옐로우썬더', '제주 오렌지윙스', '안양 바이올렛', '부천 95',
  ],
  j1: [
    '우라와 다이아몬즈', '고베 빅토리', '가시마 사슴뿔', '요코하마 트리콜로레', '가와사키 블루돌핀', '히로시마 트리플애로우',
    '가시와 옐로우선', '마치다 블루스카이', '오사카 블루블랙', 'FC 도쿄 블루레드', '나고야 붉은 범고래', '교토 퍼플',
    '오사카 체리핑크', '도쿄 베르디그린', '후쿠오카 벌룬스', '시미즈 오렌지펄스', '오카야마 꿩군단', '나가사키 세일러즈',
    '지바 캐너리즈', '미토 접시꽃',
  ],
  // T-10-016 MLS 2026 시즌 30개 팀(미국 27 · 캐나다 3).
  mls: [
    '마이애미 핑크헤론스', '필라델피아 자유의 종', '밴쿠버 하얀 파도', '로스앤젤레스 블랙앤골드', '샌디에이고 태평양',
    '신시내티 오렌지 사자', '콜럼버스 노란 일꾼들', '시애틀 사운드 그린', '미네소타 룬스', '샬럿 퀸시티',
    '뉴욕 스카이라인', '내슈빌 코요테스', '포틀랜드 벌목꾼들', '오스틴 베르데', '올랜도 퍼플라이언스',
    '시카고 불꽃', '뉴저지 붉은 황소', '솔트레이크 클라렛', '새너제이 지진', '콜로라도 급류',
    '휴스턴 오렌지 다이너모', '로스앤젤레스 은하수', '애틀랜타 파이브 스트라이프스', '세인트루이스 시티 레드', '캔자스시티 스포팅 블루',
    '워싱턴 블랙 이글스', '몬트리올 블뢰블랑', '토론토 레드 노스', '뉴잉글랜드 혁명군', '댈러스 후프스',
  ],
  ere: [
    '암스테르담 아이아스', '에인트호번 필립스', '로테르담 페예', '알크마르 치즈메이커스', '엔스헤데 트벤테', '위트레흐트 돔',
    '데벤터르 이글스', '네이메헌 레드그린', '헤이렌베인 프리슬란트', '로테르담 스파르탄스', '즈볼레 블루핑거스',
    '흐로닝언 노스프라이드', '시타르트 포르투나', '브레다 옐로블랙', '알멜로 헤라클레스', '로테르담 크랄링언',
    '벨선 화이트엔젤스', '폴렌담 어부들',
  ],
  l1: [
    '파리 레 파리지앵', '마르세유 올랭피크', '모나코 로열', '릴 레 도그', '리옹 레 고네', '니스 레 제글롱',
    '랑스 상 에 오르', '렌 루주 에 누아르', '스트라스부르 라 라시', '툴루즈 레 비올레', '브레스트 레 피라트', '낭트 레 카나리',
    '파리 FC 센', '오세르 부르고뉴', '앙제 블랑 에 누아르', '르아브르 도커스', '로리앙 레 메를뤼', '메스 그르나',
  ],
  bl: [
    '뮌헨 바이에른 로트', '도르트문트 슈바르츠겔브', '레버쿠젠 베르크셀프', '라이프치히 황소군단', '프랑크푸르트 아들러', '슈투트가르트 슈바벤',
    '프라이부르크 브라이스가우', '볼프스부르크 그린울브스', '묀헨글라트바흐 망아지군단', '마인츠 카니발', '베를린 유니온 아이언',
    '브레멘 베르더 그린', '호펜하임 크라이히가우', '아우크스부르크 푸거슈타트', '함부르크 레드쇼츠', '쾰른 산양군단',
    '함부르크 해적깃발', '하이덴하임 브렌츠',
  ],
  sa: [
    '밀라노 네라주리', '토리노 비앙코네리', '나폴리 파르테노페이', '밀라노 로소네리', '베르가모 라 데아', '로마 잘로로시',
    '로마 비앙코첼레스티', '코모 라리아니', '볼로냐 로소블루', '피렌체 비올라', '토리노 그라나타', '우디네 프리울리',
    '제노바 그리포네', '파르마 크로치아티', '칼리아리 사르데냐', '사수올로 네로베르디', '레체 살렌티니', '베로나 스칼리제리',
    '크레모나 그리지오로시', '피사 네로아주리',
  ],
  ll: [
    '마드리드 로스 블랑코스', '바르셀로나 블라우그라나', '마드리드 콜초네로스', '빌바오 레오네스', '비야레알 노란 잠수함', '세비야 네르비온',
    '산세바스티안 추리우르딘', '세비야 베르디블랑코스', '비고 셀레스테스', '발렌시아 박쥐군단', '팜플로나 로히요스',
    '마드리드 번개', '헤타페 아술로네스', '지로나 블랑키베르메이스', '바르셀로나 페리코스', '마요르카 베르메욘스',
    '비토리아 바바소로스', '엘체 프란하베르데스', '발렌시아 그라노테스', '오비에도 카르바요네스',
  ],
  pl: [
    '맨체스터 스카이블루', '리버풀 더 레즈', '런던 거너스', '런던 블루스', '맨체스터 레드데블스', '런던 스퍼스',
    '뉴캐슬 맥파이스', '버밍엄 빌런스', '브라이턴 시걸스', '노팅엄 포레스터스', '런던 비즈', '런던 이글스',
    '본머스 체리스', '런던 코티저스', '리버풀 토피스', '런던 해머스', '울버햄튼 울브스', '리즈 화이트스',
    '선덜랜드 블랙캣츠', '번리 클라레츠',
  ],
};
/** 리그 안 전력 편차: 1위 +9 ~ 꼴찌 -6을 팀 수에 맞춰 고르게 나눈다(6팀이면 9,6,3,0,-3,-6 — 예전 고정값과 같다). */
const clubOffset = (i: number, n: number) => (n > 1 ? Math.round(9 - (15 * i) / (n - 1)) : 0);
export interface Club {
  id: string;
  name: string;
  leagueId: string;
  str: number;
  /** T-10-009. 기본(별칭) 이름 — 유저가 이름을 바꿔도 되돌릴 수 있게 남긴다. */
  baseName?: string;
}
export const CLUBS: Club[] = [];
for (const L of LEAGUES) {
  const names = CLUB_NAMES[L.id] ?? [];
  names.forEach((name, i) => CLUBS.push({ id: `${L.id}-${i}`, name, baseName: name, leagueId: L.id, str: L.avg + clubOffset(i, names.length) }));
}

export const ATTR_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];
export const ATTR_LABEL: Record<AttrKey, string> = { pac: '스피드', sho: '슈팅', pas: '패스', dri: '드리블', def: '수비', phy: '피지컬' };
export const GK_LABEL: Record<AttrKey, string> = { pac: '반사 신경', sho: '스피드', pas: '킥', dri: '위치 선정', def: '다이빙', phy: '핸들링' };

export type Pos = 'FW' | 'MF' | 'DF' | 'GK';
/** 골키퍼는 같은 여섯 능력치를 다른 이름으로 부른다. */
export const attrLabels = (pos: Pos): Record<AttrKey, string> => (pos === 'GK' ? GK_LABEL : ATTR_LABEL);
export interface PosDef {
  label: string;
  /** 선수 생성 화면의 한 줄 설명. */
  blurb: string;
  base: Record<AttrKey, number>;
  w: Partial<Record<AttrKey, number>>;
  goal: number;
  assist: number;
  atk: Partial<Record<AttrKey, number>>;
}
export const POS: Record<Pos, PosDef> = {
  FW: {
    label: '공격수',
    blurb: '골로 말하는 해결사',
    base: { pac: 50, sho: 52, pas: 42, dri: 48, def: 28, phy: 46 },
    w: { sho: 0.34, pac: 0.2, dri: 0.24, phy: 0.1, pas: 0.1, def: 0.02 },
    goal: 0.34,
    assist: 0.13,
    atk: { sho: 0.6, dri: 0.25, pac: 0.15 },
  },
  MF: {
    label: '미드필더',
    blurb: '패스로 경기를 조율',
    base: { pac: 46, sho: 42, pas: 52, dri: 48, def: 40, phy: 44 },
    w: { pas: 0.32, dri: 0.2, sho: 0.12, def: 0.14, phy: 0.1, pac: 0.12 },
    goal: 0.14,
    assist: 0.19,
    atk: { sho: 0.45, dri: 0.3, pas: 0.25 },
  },
  DF: {
    label: '수비수',
    blurb: '실점을 막는 벽',
    base: { pac: 44, sho: 30, pas: 42, dri: 38, def: 54, phy: 52 },
    w: { def: 0.42, phy: 0.22, pac: 0.16, pas: 0.14, dri: 0.04, sho: 0.02 },
    goal: 0.05,
    assist: 0.06,
    atk: { sho: 0.3, phy: 0.5, pac: 0.2 },
  },
  GK: {
    label: '골키퍼',
    blurb: '마지막 방어선',
    base: { pac: 48, sho: 30, pas: 38, dri: 40, def: 54, phy: 48 },
    w: { def: 0.45, pac: 0.25, phy: 0.15, pas: 0.1, dri: 0.05, sho: 0 },
    goal: 0,
    assist: 0.008,
    atk: { sho: 1 },
  },
};

export interface TypeDef {
  id: string;
  name: string;
  desc: string;
  mod: Partial<Record<AttrKey, number>>;
}
export const TYPES: Record<Pos, TypeDef[]> = {
  FW: [
    { id: 'poacher', name: '골 사냥꾼', desc: '슈팅 ▲▲ · 수비 ▼', mod: { sho: 8, dri: 1, def: -5, pas: -2 } },
    { id: 'speed', name: '스피드스터', desc: '스피드 ▲▲ · 피지컬 ▼', mod: { pac: 8, dri: 2, phy: -5 } },
    { id: 'target', name: '타깃맨', desc: '피지컬 ▲▲ · 스피드 ▼', mod: { phy: 8, sho: 3, pac: -6 } },
  ],
  MF: [
    { id: 'maker', name: '플레이메이커', desc: '패스 ▲▲ · 피지컬 ▼', mod: { pas: 8, dri: 2, phy: -5 } },
    { id: 'b2b', name: '박스 투 박스', desc: '피지컬·수비 ▲ · 드리블 ▼', mod: { phy: 5, def: 5, dri: -3 } },
    { id: 'winger', name: '윙어', desc: '드리블·스피드 ▲ · 수비 ▼', mod: { dri: 6, pac: 5, def: -6 } },
  ],
  DF: [
    { id: 'stopper', name: '스토퍼', desc: '수비·피지컬 ▲ · 패스 ▼', mod: { def: 6, phy: 5, pas: -5 } },
    { id: 'fullback', name: '공격형 풀백', desc: '스피드·패스 ▲ · 피지컬 ▼', mod: { pac: 7, pas: 3, phy: -4 } },
    { id: 'libero', name: '빌드업 센터백', desc: '패스 ▲▲ · 스피드 ▼', mod: { pas: 7, def: 2, pac: -5 } },
  ],
  GK: [
    { id: 'shot', name: '슈퍼 세이버', desc: '다이빙·반사 신경 ▲ · 킥 ▼', mod: { def: 6, pac: 4, pas: -5 } },
    { id: 'sweeper', name: '스위퍼 키퍼', desc: '킥 ▲▲ · 핸들링 ▼', mod: { pas: 8, pac: 2, phy: -5 } },
    { id: 'wall', name: '통곡의 벽', desc: '핸들링 ▲▲ · 반사 신경 ▼', mod: { phy: 8, def: 3, pac: -6 } },
  ],
};

// ───────── 주력 능력치 (T-10-008) ─────────
// 선수 생성 때 유형 대신 "키우고 싶은 능력치" FOCUS_PICK개를 고른다. 초기 분포는 주력 능력치에
// +FOCUS_UP씩 얹고, 그 포지션에서 OVR 가중치가 가장 낮은 비주력 능력치 두 개에서 FOCUS_DOWN만큼
// 뺀다(순합 +5 — 기존 유형 mod 순합 2~7과 같은 폭). 성장은 engine.applyTraining이 주력 훈련에
// FOCUS_GROWTH, 비주력 훈련에 OFF_FOCUS_GROWTH를 곱한다 — 6개 중 2개라 무작위 훈련의 기대 배율은 1이다.
// `type`은 저장·서버 계약·역할/이벤트 조건 호환을 위해 주력 조합에서 가장 가까운 유형으로 계속 채운다.
export const FOCUS_PICK = 2;
export const FOCUS_UP = 6;
const FOCUS_DOWN = [4, 3] as const;
export const FOCUS_GROWTH = 1.2;
export const OFF_FOCUS_GROWTH = 0.9;

export function focusMod(pos: Pos, focus: readonly AttrKey[]): Partial<Record<AttrKey, number>> {
  const mod: Partial<Record<AttrKey, number>> = {};
  for (const k of focus) mod[k] = FOCUS_UP;
  const w = POS[pos].w;
  const weakest = ATTR_KEYS.filter((k) => !focus.includes(k)).sort((a, b) => (w[a] ?? 0) - (w[b] ?? 0));
  FOCUS_DOWN.forEach((d, i) => {
    const k = weakest[i];
    if (k) mod[k] = -d;
  });
  return mod;
}

/** 포지션 기본 주력 — OVR 가중치가 가장 큰 FOCUS_PICK개. */
export const defaultFocus = (pos: Pos): AttrKey[] =>
  ATTR_KEYS.slice()
    .sort((a, b) => (POS[pos].w[b] ?? 0) - (POS[pos].w[a] ?? 0))
    .slice(0, FOCUS_PICK);

/** 주력 조합에 가장 가까운 기존 유형(동점이면 목록 앞쪽). */
export function typeForFocus(pos: Pos, focus: readonly AttrKey[]): string {
  const score = (t: TypeDef) => focus.reduce((sum, k) => sum + (t.mod[k] ?? 0), 0);
  return TYPES[pos].reduce((best, t) => (score(t) > score(best) ? t : best)).id;
}

/** 유형에서 주력 능력치를 거꾸로 구한다(옛 저장본·시뮬레이터용) — mod가 큰 순 상위 FOCUS_PICK개. */
export function focusOfType(pos: Pos, typeId: string): AttrKey[] {
  const mod = (TYPES[pos].find((t) => t.id === typeId) ?? TYPES[pos][0]!).mod;
  return ATTR_KEYS.filter((k) => (mod[k] ?? 0) > 0)
    .sort((a, b) => mod[b]! - mod[a]!)
    .slice(0, FOCUS_PICK);
}

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
  /** 선수 생성 화면 태그 카드용 아이콘·짧은 설명. */
  icon: string;
  short: string;
}
export const TRAITS: TraitDef[] = [
  { id: 'early', name: '조기 성장', desc: '어릴 때 빠르게 크고 일찍 주목받지만, 일찍 꺾입니다.', icon: '⚡', short: '빨리 크고 일찍 꺾여요' },
  { id: 'late', name: '대기만성', desc: '늦게 피지만 전성기가 길어요.', icon: '🌱', short: '늦게 피고 오래 가요' },
  { id: 'iron', name: '강철 체력', desc: '부상 확률이 크게 낮습니다.', icon: '🛡️', short: '부상이 크게 줄어요' },
  { id: 'star', name: '스타성', desc: '인기와 스폰서가 잘 따라옵니다.', icon: '⭐', short: '인기·스폰서가 따라와요' },
];

export const PHASES = ['프리시즌', '전반기', '후반기', '시즌 종료'];
export const LAST_PHASE = 2;

export const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권'];
export const GIVEN = ['민재', '흥민', '강인', '태윤', '도현', '지호', '서준', '유찬', '하람', '시우', '건우', '은호', '재혁', '준서'];
