// ───────── 게임 상태 타입 (실용적 타이핑) ─────────
// 풀타임 원본은 선수 상태를 하나의 거대한 객체(G)로 다루며 필드를 느슨하게 추가합니다.
// 완전한 판별 유니온으로 다시 모델링하면 포팅 리스크가 커지므로, 여기서는 알려진 필드는 구체적으로
// 타이핑하고 나머지(로그 라인 종류가 다양한 필드, 이벤트별 임시 플래그 등)는 폭넓게 둡니다.
import type { LegendSnapshot } from '@offside/contracts';
import type { CareerBalance } from './balance.js';
import type { AttrKey, Pos, Club } from './data.js';
import type { SeasonEndResult } from './season.js';

export interface RngSaveState {
  seed: number;
}

export interface LogEntry {
  t: string;
  text: string;
  kind: string;
}

export interface SeasonComp {
  type: 'cup' | 'cont' | 'super';
  key?: string;
  name: string;
  alive: boolean;
  stage: string;
  apps: number;
  g: number;
  a: number;
  pts?: number;
  played?: number;
}

export interface Season {
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  ratingSum: number;
  cs: number;
  mins: number;
  played: number;
  pts: number;
  w: number;
  d: number;
  l: number;
  rivals: number[];
  honors: string[];
  comps?: SeasonComp[];
  trophiesMid?: string[];
  capsStart?: number;
}

export interface CareerRecord {
  year: number;
  age: number;
  club: string;
  league: string;
  apps: number;
  goals: number;
  assists: number;
  cs: number;
  lgApps?: number;
  lgGoals?: number;
  rating: number;
  rank: number | string;
  ovr: number;
  honors: string[];
  pro?: boolean;
  comps?: SeasonComp[];
  caps?: number;
  mil?: boolean | undefined;
  /** T-10-002. 이 시즌에 경신한 개인 커리어 하이(CH) 지표 키 목록(goals/assists/apps/rating/cs).
   * 옛 저장 데이터의 과거 시즌 레코드에는 없을 수 있다 — 없으면 그냥 배지를 표시하지 않는다. */
  ch?: string[] | undefined;
}

export interface NatTour {
  year: number;
  /** 대회 종류(wc·ag·asian·olympic). 시즌 결산 결과에만 있고 s.nat.tours 기록엔 없다. */
  key?: string;
  name: string;
  stage: string;
  inSquad: boolean;
  apps: number;
  goals: number;
  matches?: unknown[];
  why?: string;
}

export interface NatState {
  caps: number;
  goals: number;
  assists: number;
  tours: NatTour[];
  qual: Record<number, boolean>;
  captain: boolean;
  debutYear: number | null;
}

export interface MilState {
  exempt: string | null;
  served: boolean;
  serving: boolean;
  left: number;
  type: string | null;
  prevClub: { club: Club; leagueId: string; contract: Contract | null; abroad: boolean } | null;
  accepted?: boolean;
  applied?: boolean;
  armyNext?: boolean;
}

export interface Contract {
  years: number;
  salary: number;
}

export interface StoryState {
  stage: number;
  done: boolean;
  ending?: string;
  /** rival: 라이벌과의 격차(양수면 라이벌이 앞선다)·선전포고 여부. */
  gap?: number;
  tone?: 'loud' | 'quiet';
  /** rehab: 수술을 받았는지. */
  surgery?: boolean;
}

export interface ChainEvent {
  id: string;
  at: number;
  until: number;
}

export interface Flags {
  potBonus?: number;
  rescout?: number;
  scouted?: boolean;
  agent?: boolean;
  coachOffer?: boolean;
  natCall?: boolean;
  rivalName?: string;
  lastEvent?: string;
  evSeen?: Record<string, { t: number; n: number }>;
  rookieDone?: boolean;
  [k: string]: unknown;
}

export type Foot = '오른발' | '왼발' | '양발';

// ───────── 이적 시장 옵션 (판별 유니온) ─────────
// season.ts의 market()/acceptOption()이 다루는 선택지. kind로 구분되는 판별 유니온이라, kind로
// 좁히면 나머지 필드에 캐스팅 없이 접근할 수 있다.
export interface OfferOption {
  kind: 'offer';
  clubId: string;
  name: string;
  leagueId: string;
  str: number;
  years: number;
  salary: number;
  role: string;
  fee: number;
  trust?: number;
}
export interface UniOption {
  kind: 'uni';
  name: string;
  desc: string;
}
export interface StayOption {
  kind: 'stay';
  name: string;
  desc: string;
}
export interface RenewOption {
  kind: 'renew';
  name: string;
  years: number;
  salary: number;
  desc: string;
}
export type MilOptionKind = 'sangmu' | 'army' | 'serve';
/** military.ts의 병역 관련 선택지. market()이 다루는 MarketOption의 한 갈래이기도 하다. */
export interface MilOption {
  kind: MilOptionKind;
  name: string;
  desc?: string;
  due?: boolean;
  first?: boolean;
}
export type MarketOption = OfferOption | UniOption | StayOption | RenewOption | MilOption;

/**
 * T-9-009. 시즌 중 버퍼링되는 선택 로그 한 줄. 서버 계약(`@offside/contracts` `EventLogEntrySchema`)과
 * 필드가 같아야 한다. 자유 텍스트는 담지 않는다.
 */
export interface EventLogEntry {
  /** 종류: 'ev'(이벤트) | 'mkt'(이적시장) | 'mil'(병역) 등. */
  k: string;
  id: string;
  c: number | string;
  ok?: boolean;
  /** 발생 시점(halves/phase 인덱스). */
  h: number;
}

/** 화면이 이어서 열어야 하는 결정(이벤트·시즌 결산·이적 시장). 저장에 남아 새로고침해도 같은 시트로 돌아온다.
 * market의 res(시즌 결산 결과)·m(이적 옵션)은 한 번 계산하면 저장해 두고 다시 굴리지 않는다. */
/** 이적 시장 한 번의 선택지(season.market·military.milEnlistMarket). */
export interface MarketResult {
  options: MarketOption[];
  note: string;
  canRetire: boolean;
}

export type Pending =
  | { type: 'event'; id: string; then?: 'seasonEnd' | null }
  | { type: 'seasonEnd' }
  | { type: 'market'; res: SeasonEndResult | null; m: MarketResult | null };

export interface GameState {
  /** T-10-016 이 커리어에 적용 중인 서버 밸런스 버전(없으면 코드 기본값 = 버전 0). */
  bal?: CareerBalance;
  v: 1;
  /** T-9-009. 커리어 고유 ID(`crypto.randomUUID()`). 서버 업로드의 URL 키다. 시드 RNG를 절대
   * 소모하지 않고 만든다 — RNG 시퀀스가 이 변경으로 바뀌면 안 된다. */
  cid: string;
  halves: number;
  name: string;
  number: number;
  pos: Pos;
  foot: Foot;
  /** 주력 조합에서 파생된 호환용 유형 id(역할·이벤트 조건·서버 meta). */
  type: string;
  /** T-10-008. 선수 생성 때 고른 주력 능력치. 옛 저장본엔 없다 — engine.focusOf()로 읽는다. */
  focus?: AttrKey[];
  trait: string;
  age: number;
  year: number;
  attrs: Record<AttrKey, number>;
  sub: Record<string, number>;
  pot: number;
  bloom: number;
  cond: number;
  morale: number;
  fame: number;
  trust: number;
  money: number;
  leagueId: string;
  club: Club;
  contract: Contract | null;
  phase: number;
  uniYears: number;
  season: Season;
  seasonStart: Record<AttrKey, number>;
  seasonStartSub: Record<string, number>;
  career: CareerRecord[];
  trophies: { year: number; t: string; club: string }[];
  awards: { year: number; t: string }[];
  ballon?: { year: number; rank: number }[];
  nat: NatState;
  mil: MilState;
  injury: number;
  log: LogEntry[];
  pending: Pending | null;
  flags: Flags;
  peak: number;
  training: string;
  retired: boolean;
  chains: ChainEvent[];
  story: Record<string, StoryState>;
  storyLog: { year: number; key: string; name: string; ending: string }[];
  miles?: { year: number; t: string }[];
  /** T-10-026. 획득한 칭호(획득 순). 칭호 도입 전 저장엔 없다 — 불러올 때 titles.ensureTitles()가 채운다. */
  titles?: { id: string; year: number }[] | undefined;
  /** T-10-026. 유저가 고른 대표 칭호 id. 없으면 mainTitle()이 자동으로 고른다. */
  titleSel?: string;
  rng: RngSaveState;
  /** T-9-009. 이번 시즌 버퍼링된 선택 로그(`ft_save`와 함께 자동 저장). 시즌 종료 시 업로드 페이로드로
   * 옮겨지고 비워진다. 최대 300개, 넘치면 가장 오래된 것부터 버린다. */
  evBuf?: EventLogEntry[];
}

export interface HofEntry {
  name: string;
  pos: Pos;
  number: number;
  peak: number;
  age: number;
  apps: number;
  goals: number;
  assists: number;
  trophies: number;
  awards: number;
  caps: number;
  ballon: number;
  lastClub: string;
  score: number;
  date: string;
  /** T-10-005. 커리어 ID(G.cid) — 서버 명예의 전당 행과 같은 키. 옛 항목에는 없다. */
  id?: string;
  /** T-10-005. 은퇴 상세(시즌별 기록·수상·여정). 옛 항목에는 없어 요약만 보여 준다. */
  detail?: LegendSnapshot;
  /** T-10-005. 전체 명예의 전당에 선수 이름을 공개했는지(기본 false = 익명). */
  public?: boolean;
  /** T-10-026. 은퇴 때의 대표 칭호 id. */
  title?: string | undefined;
}

/** 은퇴 리포트(레전드 점수 구성·시즌별 기록·수상·여정)가 읽는 필드. 진행 중인 GameState와 저장된
 * 은퇴 스냅샷(LegendSnapshot) 둘 다 이 모양을 만족한다. */
export type LegendSource = Pick<GameState, 'pos' | 'peak' | 'career' | 'trophies' | 'awards' | 'ballon' | 'storyLog' | 'miles' | 'titles'> & {
  nat: { caps: number };
};

export interface Choice {
  label: string | ((s: GameState) => string);
  p?: (s: GameState) => number;
  ok: { text: string | ((s: GameState) => string); fx: (s: GameState) => void };
  fail?: { text: string | ((s: GameState) => string); fx: (s: GameState) => void };
}

export interface EventDef {
  id: string;
  title: string;
  w: number;
  cond: (s: GameState) => boolean;
  text: (s: GameState) => string;
  choices: Choice[];
  story?: string;
  stage?: number;
  chain?: boolean;
  expireEnding?: string;
}
