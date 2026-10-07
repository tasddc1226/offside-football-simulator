// ───────── 게임 상태 타입 (실용적 타이핑) ─────────
// 풀타임 원본은 선수 상태를 하나의 거대한 객체(G)로 다루며 필드를 느슨하게 추가합니다.
// 완전한 판별 유니온으로 다시 모델링하면 포팅 리스크가 커지므로, 여기서는 알려진 필드는 구체적으로
// 타이핑하고 나머지(로그 라인 종류가 다양한 필드, 이벤트별 임시 플래그 등)는 폭넓게 둡니다.
import type { Body } from '@offside/contracts/body';
import type { LegendSnapshot, PlayStyle, RetiredNumberResult } from '@offside/contracts';
import type { PeakProfile } from '@offside/contracts/positions';
import type { CareerBalance } from './balance.js';
import type { AttrKey, Pos, Club, SAVE_VERSION, DetailPos } from './data.js';
import type { SeasonEndResult } from './season.js';
import type { MgKind } from './minigame.js';

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
  /** T-11-134 rivals 앞쪽과 짝인 상대 구단 id(순서 같음). 리그 경기 상대·순위표 이름이 이 구단이다. 옛 시즌에는 없다. */
  opp?: string[];
  honors: string[];
  comps?: SeasonComp[];
  trophiesMid?: string[];
  capsStart?: number;
  /** T-10-110 승격으로 s.leagueId가 바뀐 뒤에도 이 시즌의 순위표가 뛴 리그로 남도록, 승격한 시즌에만 적는다. */
  leagueId?: string;
}

export interface CareerRecord {
  year: number;
  age: number;
  club: string;
  /** T-10-066. 그 시즌 클럽 id(CLUBS[].id). 구단명이 바뀌어도 엠블럼이 제 클럽을 찾는다. 옛 기록에는 없다. */
  clubId?: string | undefined;
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

/** s.nat.tours에 남기는 대회 기록. 시즌 결산이 돌려주는 더 자세한 결과는 national.ts NatTourResult. */
export interface NatTour {
  year: number;
  name: string;
  stage: string;
  inSquad: boolean;
  apps: number;
  goals: number;
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
  /** 특례를 받은 메달. 기존 저장 키를 유지하며 완전 면제를 뜻하지 않는다. */
  exempt: string | null;
  /** 시즌 단위 체육요원 복무. null은 기간 기록이 없는 기존 특례 저장이다. */
  sportsService?: { monthsLeft: number | null; lastYear: number };
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

/** T-11-083 잠재력 강화 시도 한 번(관찰·기록용). */
export interface BoostTry {
  y: number;
  age: number;
  /** 시도 전 단계. */
  lv: number;
  /** 시도한 확률(%). */
  p: number;
  /** 쓴 자금(만 원). 광고로 시도했으면 0. */
  c: number;
  ok: boolean;
  /** T-11-116 자금이 모자라 보상형 광고로 시도했다(앱). 기능 전 기록·자금 시도엔 없다. */
  ad?: true;
}
export interface BoostState {
  /** 지금 단계(성공 횟수). flags.potBonus에 같은 만큼 더해져 있다. */
  lv: number;
  /** 지금 단계에서 연속으로 실패한 횟수(실패 보정). */
  fails: number;
  /** 마지막으로 시도한 시즌(시즌마다 한 번). */
  year?: number | undefined;
  log: BoostTry[];
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
  /** 조기 연장: years는 잔여 1년을 포함한 총기간. 없는 옛 제안은 만료 재계약이다. */
  extension?: { years: number; clubId: string; year: number };
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
  /** T-10-089 미니게임 탭 정확도(구간 가운데에서 떨어진 정도 ×100, 100 이하 성공). */
  mg?: number;
}

/** 이적 시장 한 번의 선택지(season.market·military.milEnlistMarket). */
export interface MarketResult {
  options: MarketOption[];
  note: string;
  canRetire: boolean;
}

/** 화면이 이어서 열어야 하는 결정(이벤트·시즌 결산·이적 시장). 저장에 남아 새로고침해도 같은 시트로 돌아온다.
 * market의 res(시즌 결산 결과)·m(이적 옵션)은 한 번 계산하면 저장해 두고 다시 굴리지 않는다. */
export type Pending =
  | { type: 'event'; id: string; then?: 'seasonEnd' | null }
  | { type: 'seasonEnd' }
  | { type: 'market'; res: SeasonEndResult | null; m: MarketResult | null };

export interface GameState {
  /** T-10-016 이 커리어에 적용 중인 서버 밸런스 버전(없으면 코드 기본값 = 버전 0). */
  bal?: CareerBalance;
  v: typeof SAVE_VERSION;
  /** T-9-009. 커리어 고유 ID(`crypto.randomUUID()`). 서버 업로드의 URL 키다. 시드 RNG를 절대
   * 소모하지 않고 만든다 — RNG 시퀀스가 이 변경으로 바뀌면 안 된다. */
  cid: string;
  halves: number;
  name: string;
  number: number;
  pos: Pos;
  /** T-10-091 세부 포지션(시즌 1부터 만든 선수). 없으면 주력 조합의 유형으로 역할을 정한다. */
  dpos?: DetailPos | undefined;
  /** T-10-096 국적(nations.ts 코드). 없으면 대한민국 — 옛 저장과 대한민국 선수는 이 필드가 없다. */
  nation?: string | undefined;
  /** T-10-096 키(cm)·몸무게(kg). 기능 이전 저장엔 없다. */
  body?: Body | undefined;
  /**
   * T-11-045 은퇴 나이 — 이 나이가 되는 이적 시장에서 은퇴한다. 만들 때의 서비스 시즌(service-seasons retireAt)으로
   * 정해져 바뀌지 않는다. 없으면 프리시즌 선수(41세) — 옛 저장과 프리시즌 선수는 이 필드가 없다.
   */
  retireAt?: number | undefined;
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
  /** T-10-110 이 커리어에서 리그를 옮긴 구단(K2 우승 승격·그 자리를 비운 K1 구단 강등) — 구단 id → 지금 리그 id.
   * 정적 CLUBS 소속은 그대로 두고 커리어마다 따로 둔다. 없으면 모든 구단이 정적 소속이다. 지금 리그는 leagueId가
   * 정본이고, club.leagueId는 CLUBS에서 복사한 정적 값이다(읽지 않는다). */
  leagueMoves?: Record<string, string>;
  contract: Contract | null;
  phase: number;
  uniYears: number;
  season: Season;
  seasonStart: Record<AttrKey, number>;
  seasonStartSub: Record<string, number>;
  career: CareerRecord[];
  /** club이 대표팀(나라 이름, nation.ts isNationalTeam)이면 clubId가 없다(T-10-066, 옛 기록에도 없다). */
  trophies: { year: number; t: string; club: string; clubId?: string | undefined }[];
  awards: { year: number; t: string }[];
  ballon?: { year: number; rank: number }[];
  nat: NatState;
  mil: MilState;
  injury: number;
  log: LogEntry[];
  pending: Pending | null;
  flags: Flags;
  peak: number;
  /** T-10-092 최고 OVR을 찍은 시즌 말의 능력치(구단주 팀의 자리별 실력). 옛 저장본엔 없다 — 은퇴 때 지금 능력치로 추정한다. */
  peakProfile?: PeakProfile | undefined;
  training: string;
  /** T-11-012 자기 투자(training.ts INVESTS). 훈련과 따로 구간마다 자금을 쓴다. 기능 전 저장엔 없다 — 없으면 '투자 안 함'. */
  invest?: string | undefined;
  /** T-11-083 잠재력 강화(boost.ts). 기능 전 저장·시도하지 않은 커리어엔 없다. */
  boost?: BoostState | undefined;
  retired: boolean;
  chains: ChainEvent[];
  story: Record<string, StoryState>;
  storyLog: { year: number; key: string; name: string; ending: string }[];
  miles?: { year: number; t: string }[];
  /** T-10-026. 획득한 칭호(획득 순). 칭호 도입 전 저장엔 없다 — 불러올 때 titles.ensureTitles()가 채운다. */
  titles?: { id: string; year: number }[] | undefined;
  /** T-10-026. 유저가 고른 대표 칭호 id. 없으면 mainTitle()이 자동으로 고른다. */
  titleSel?: string;
  /** T-10-077. 커리어 내내 센 플레이 성향(playStyle.ts). 기능이 나오기 전에 시작한 저장엔 처음 선택 때 생긴다. */
  style?: PlayStyle | undefined;
  rng: RngSaveState;
  /** T-9-009. 이번 시즌 버퍼링된 선택 로그(`ft_save`와 함께 자동 저장). 시즌 종료 시 업로드 페이로드로
   * 옮겨지고 비워진다. 최대 300개, 넘치면 가장 오래된 것부터 버린다. */
  evBuf?: EventLogEntry[];
  /** T-11-048. 이번 시즌 구간(프리시즌·전반기·후반기)에 들어갈 때의 OVR. 시즌 종료 업로드(`takeSeasonGrowth`)가
   * 옮겨 가고 비운다. 관찰용 기록이라 게임 진행에는 쓰이지 않고 RNG도 쓰지 않는다. */
  ovrBuf?: number[];
}

export interface HofEntry {
  /** T-11-072 은퇴 때 남긴 국적. 옛 로컬 기록에는 없어 국적을 추측하지 않는다. */
  nation?: string | undefined;
  name: string;
  pos: Pos;
  dpos?: DetailPos | undefined;
  number: number;
  peak: number;
  /** T-10-092 서버로 보내는 최고 시점 능력치. 옛 기록엔 없다. */
  profile?: PeakProfile | undefined;
  /** T-11-030 은퇴 때 기록한 실제 잠재력(반올림). 리포트·기록실·서버 관찰에 쓰며 옛 기록엔 없다. */
  pot?: number | undefined;
  age: number;
  apps: number;
  goals: number;
  assists: number;
  trophies: number;
  awards: number;
  caps: number;
  ballon: number;
  lastClub: string;
  /** T-10-066. 마지막 소속 클럽 id. 옛 항목에는 없다. */
  lastClubId?: string | undefined;
  score: number;
  date: string;
  /** T-10-005. 커리어 ID(G.cid) — 서버 명예의 전당 행과 같은 키. 옛 항목에는 없다. */
  id?: string;
  /** T-10-005. 은퇴 상세(시즌별 기록·수상·여정). 옛 항목에는 없어 요약만 보여 준다. */
  detail?: LegendSnapshot;
  /** T-10-005. 전체 명예의 전당에 선수 이름을 공개했는지. 은퇴 때 환경설정 '선수 이름 공개'를 따른다(T-10-065). */
  public?: boolean;
  /** T-10-026. 은퇴 때의 대표 칭호 id. */
  title?: string | undefined;
  /** T-10-076. 서버의 영구결번 심사 결과(null = 자격 없음). 업로드 응답을 받기 전·옛 항목에는 없다. */
  rn?: RetiredNumberResult | null;
  /**
   * T-11-029. 서버가 정한 선수의 서비스 시즌(0 = 프리시즌) — 은퇴 업로드 응답으로 받아 남긴다. 업로드 전이거나 옛
   * 항목에는 없다(없으면 프리시즌으로 센다 — mySeason.ts).
   */
  season?: number | undefined;
}

/** 은퇴 리포트(레전드 점수 구성·시즌별 기록·수상·여정)가 읽는 필드. 진행 중인 GameState와 저장된
 * 은퇴 스냅샷(LegendSnapshot) 둘 다 이 모양을 만족한다. */
export type LegendSource = Pick<
  GameState,
  | 'pos'
  | 'dpos'
  | 'peak'
  | 'career'
  | 'trophies'
  | 'awards'
  | 'ballon'
  | 'storyLog'
  | 'miles'
  | 'titles'
  | 'style'
> & {
  /** goals·assists는 T-10-086부터 남긴다 — 옛 은퇴 스냅샷엔 없다. */
  nat: { caps: number; goals?: number | undefined; assists?: number | undefined };
};

export interface Choice {
  label: string | ((s: GameState) => string);
  p?: (s: GameState) => number;
  /**
   * T-10-089 경기 장면이 있는 선택지(p가 있어야 한다)는 확률 판정 대신 원터치 미니게임으로 가린다.
   * side: 문구가 방향을 정한 장면(-1 왼쪽 · 0 제자리). 없으면 화면에서 무작위로 고른다.
   */
  mg?: { kind: MgKind; side?: -1 | 0 };
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
