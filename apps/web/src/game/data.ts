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
  { id: 'ere', name: '에레디비시', tier: 4, avg: 68, spread: 7, wealth: 12, matches: 34 },
  { id: 'l1', name: '리그 1', tier: 5, avg: 71, spread: 7, wealth: 18, matches: 34 },
  { id: 'bl', name: '분데스리가', tier: 6, avg: 74, spread: 7, wealth: 24, matches: 34 },
  { id: 'sa', name: '세리에 A', tier: 6, avg: 74, spread: 7, wealth: 24, matches: 38 },
  { id: 'll', name: '라리가', tier: 7, avg: 76, spread: 8, wealth: 30, matches: 38 },
  { id: 'pl', name: '프리미어리그', tier: 8, avg: 78, spread: 7, wealth: 40, matches: 38 },
];

const CLUB_OFFSETS = [9, 6, 3, 0, -3, -6];
const CLUB_NAMES: Record<string, string[]> = {
  hs: ['한빛고', '청운고', '서해공고', '동진고', '태백고', '남강고'],
  uni: ['한성대', '청명대', '동원대', '서라벌대', '백제대', '금강대'],
  k3: ['김해 가야시티', '경주 원자력', '화성 드림', '창원 시티', '부산 레일웨이', '양평 리버사이드'],
  k2: ['수원 블루윙', '부산 아이콘스', '서울 E-랜더스', '전남 드래건스', '성남 까치군단', '부천 95'],
  k1: ['울산 블루타이거즈', '전북 그린모터스', '포항 스틸웨이브', 'FC 서울시티', '대구 스카이블루', '인천 하버 유나이티드'],
  j1: ['우라와 다이아몬즈', '고베 빅토리', '가시마 사슴뿔', '요코하마 트리콜로레', '가와사키 블루돌핀', '히로시마 트리플애로우'],
  ere: ['암스테르담 아이아스', '에인트호번 필립스', '로테르담 페예', '알크마르 치즈메이커스', '엔스헤데 트벤테', '위트레흐트 돔'],
  l1: ['파리 레 파리지앵', '마르세유 올랭피크', '모나코 로열', '릴 레 도그', '리옹 레 고네', '니스 레 제글롱'],
  bl: ['뮌헨 바이에른 로트', '도르트문트 슈바르츠겔브', '레버쿠젠 베르크셀프', '라이프치히 황소군단', '프랑크푸르트 아들러', '슈투트가르트 슈바벤'],
  sa: ['밀라노 네라주리', '토리노 비앙코네리', '나폴리 파르테노페이', '밀라노 로소네리', '베르가모 라 데아', '로마 잘로로시'],
  ll: ['마드리드 로스 블랑코스', '바르셀로나 블라우그라나', '마드리드 콜초네로스', '빌바오 레오네스', '비야레알 노란 잠수함', '세비야 네르비온'],
  pl: ['맨체스터 스카이블루', '리버풀 더 레즈', '런던 거너스', '런던 블루스', '맨체스터 레드데블스', '런던 스퍼스'],
};
export interface Club {
  id: string;
  name: string;
  leagueId: string;
  str: number;
}
export const CLUBS: Club[] = [];
for (const L of LEAGUES) {
  (CLUB_NAMES[L.id] ?? []).forEach((name, i) =>
    CLUBS.push({ id: `${L.id}-${i}`, name, leagueId: L.id, str: L.avg + (CLUB_OFFSETS[i] ?? 0) }),
  );
}

export const ATTR_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];
export const ATTR_LABEL: Record<AttrKey, string> = { pac: '스피드', sho: '슈팅', pas: '패스', dri: '드리블', def: '수비', phy: '피지컬' };
export const GK_LABEL: Record<AttrKey, string> = { pac: '반사 신경', sho: '스피드', pas: '킥', dri: '위치 선정', def: '다이빙', phy: '핸들링' };

export type Pos = 'FW' | 'MF' | 'DF' | 'GK';
export interface PosDef {
  label: string;
  base: Record<AttrKey, number>;
  w: Partial<Record<AttrKey, number>>;
  goal: number;
  assist: number;
  atk: Partial<Record<AttrKey, number>>;
}
export const POS: Record<Pos, PosDef> = {
  FW: {
    label: '공격수',
    base: { pac: 50, sho: 52, pas: 42, dri: 48, def: 28, phy: 46 },
    w: { sho: 0.34, pac: 0.2, dri: 0.24, phy: 0.1, pas: 0.1, def: 0.02 },
    goal: 0.34,
    assist: 0.13,
    atk: { sho: 0.6, dri: 0.25, pac: 0.15 },
  },
  MF: {
    label: '미드필더',
    base: { pac: 46, sho: 42, pas: 52, dri: 48, def: 40, phy: 44 },
    w: { pas: 0.32, dri: 0.2, sho: 0.12, def: 0.14, phy: 0.1, pac: 0.12 },
    goal: 0.14,
    assist: 0.19,
    atk: { sho: 0.45, dri: 0.3, pas: 0.25 },
  },
  DF: {
    label: '수비수',
    base: { pac: 44, sho: 30, pas: 42, dri: 38, def: 54, phy: 52 },
    w: { def: 0.42, phy: 0.22, pac: 0.16, pas: 0.14, dri: 0.04, sho: 0.02 },
    goal: 0.05,
    assist: 0.06,
    atk: { sho: 0.3, phy: 0.5, pac: 0.2 },
  },
  GK: {
    label: '골키퍼',
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

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
}
export const TRAITS: TraitDef[] = [
  { id: 'early', name: '조기 성장', desc: '어릴 때 빠르게 크고 일찍 주목받지만, 일찍 꺾입니다.' },
  { id: 'late', name: '대기만성', desc: '늦게 피지만 전성기가 길어요.' },
  { id: 'iron', name: '강철 체력', desc: '부상 확률이 크게 낮습니다.' },
  { id: 'star', name: '스타성', desc: '인기와 스폰서가 잘 따라옵니다.' },
];

export const PHASES = ['프리시즌', '전반기', '후반기', '시즌 종료'];
export const LAST_PHASE = 2;

export const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권'];
export const GIVEN = ['민재', '흥민', '강인', '태윤', '도현', '지호', '서준', '유찬', '하람', '시우', '건우', '은호', '재혁', '준서'];
