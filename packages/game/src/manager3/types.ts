// T-11-648 감독 커리어 3 상태. 기기에만 저장한다(ft_mgr3_save). 이름은 한국어 저장값이고 그릴 때 옮긴다.
import type { ManagerOrigin, ManagerStyle } from '@offside/contracts/manager-rules';
import type { RngState } from '../rng.js';
import type { BoardTarget } from '../manager.js';
import type {
  M3Attr,
  M3Attrs,
  M3Formation,
  M3License,
  M3Plan,
  M3Role,
  M3Trait,
  M3_SAVE_VERSION,
} from './rules.js';

export interface M3Player {
  id: number;
  name: string;
  /** 이름 풀 나라(KR · JP · …). */
  nat: string;
  role: M3Role;
  age: number;
  ovr: number;
  /** 잠재력(화면에는 선수 보는 눈만큼 범위로만 보인다). */
  pot: number;
  morale: number;
  fit: number;
  /** 남은 부상 구간(0이면 뛸 수 있다). */
  inj: number;
  /** 남은 계약 시즌. */
  contract: number;
  /** 시즌 주급 총액(만 원). */
  wage: number;
  trait: M3Trait | null;
  /** 이 구단 유스 출신. */
  academy: boolean;
  apps: number;
  goals: number;
  /** 판매 등록 희망가(만 원). null이면 등록 안 함. */
  listed: number | null;
  /** 다음 구간 선발을 약속했다(출전 불만 이야기). */
  promised?: boolean;
  /** 유스 출신 데뷔 · 리그 평균 이상으로 자람(한 번만 센다). */
  debut?: boolean;
  star?: boolean;
}

export interface M3Club {
  id: string;
  name: string;
  leagueId: string;
  /** 리그 데이터의 구단 전력(승격 · 강등하면 새 리그에 맞춘다). */
  base: number;
  trainFac: number;
  youthFac: number;
  /** 이적 자금(만 원). */
  budget: number;
  /** 시즌 주급 예산(만 원). */
  wageBudget: number;
}

export interface M3Offer {
  clubId: string;
  name: string;
  leagueId: string;
  base: number;
  /** 공석 지원(경질 · 공백 뒤)인지. */
  vacancy: boolean;
}

/** 이적시장 영입 후보. 화면에는 선수 보는 눈으로 흐린 범위(lo~hi)만 보인다. */
export interface M3Target {
  player: M3Player;
  fromClub: string | null;
  fee: number;
  ovrLo: number;
  ovrHi: number;
  potLo: number;
  potHi: number;
  /** 수락 확률(0~1). */
  willing: number;
}

export interface M3TableRow {
  clubId: string;
  name: string;
  str: number;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface M3Fixture {
  home: string;
  away: string;
}

export interface M3Match {
  round: number;
  cup: boolean;
  opp: string;
  oppName: string;
  home: boolean;
  gf: number;
  ga: number;
  /** 우리 팀 득점자(선수 id). */
  scorers: number[];
  /** 컵 승부차기 승리 여부(비겼을 때만). */
  pens?: boolean;
}

/** 구간 결과(결과 화면이 그린다). */
export interface M3BlockReport {
  block: number;
  matches: M3Match[];
  rankBefore: number;
  rankAfter: number;
  injuries: number[];
  morale: number;
  event: M3Event | null;
}

/**
 * 이야기. kind가 legacy면 감독 커리어 2 이벤트(id로 문구), story면 이야기 표(stories.ts)의 id,
 * 나머지는 선수 이야기(player가 주인공).
 */
export interface M3Event {
  kind: 'legacy' | 'story' | 'playtime' | 'renewal' | 'bigbid' | 'fight';
  id: string;
  player?: number;
  other?: number;
  /** 빅클럽 제안 금액(만 원). */
  fee?: number;
  choice: number | null;
  ok?: boolean;
}

export type M3Phase =
  'offers' | 'preseason' | 'window' | 'block' | 'blockResult' | 'review' | 'done';

export interface M3SeasonRecord {
  n: number;
  age: number;
  clubId: string | null;
  club: string | null;
  leagueId: string | null;
  formation: M3Formation | null;
  mentality: ManagerStyle | null;
  target: BoardTarget | null;
  rank: number;
  teams: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  title: boolean;
  cup: boolean;
  cupRound: number;
  promoted: boolean;
  relegated: boolean;
  met: boolean;
  outcome: 'renew' | 'sacked' | 'rest' | 'left' | 'retire';
  /** 그 시즌 최다 득점 선수 이름 · 골. */
  topScorer: { name: string; goals: number } | null;
  award: boolean;
}

export interface M3Review {
  record: M3SeasonRecord;
  /** 이번 리뷰에서 성장 · 하락한 선수(id, 변화). */
  growth: { id: number; d: number }[];
  retired: string[];
  intake: number[];
  /** 계약이 끝나는 선수(재계약하지 않으면 나간다). */
  expiring: number[];
  board: number;
  sacked: boolean;
  /** 구간 3 뒤 시즌 도중 경질. */
  midSeason: boolean;
  licenseUp: M3License | null;
  points: number;
}

export interface M3State {
  v: typeof M3_SAVE_VERSION;
  /** 서버 감독 커리어 id(mgr_…). */
  id: string;
  careerId: string;
  name: string | null;
  origin: ManagerOrigin;
  rng: RngState;
  phase: M3Phase;
  /** 끝낸 시즌 수(쉰 시즌 포함). */
  season: number;
  age: number;
  rep: number;
  attrs: M3Attrs;
  license: M3License;
  /** 나눠 줄 성장 점수. */
  points: number;
  board: number;
  fans: number;
  harmony: number;
  club: M3Club | null;
  clubSeasons: number;
  squad: M3Player[];
  nextId: number;
  /** 포메이션별 익숙함(0~100). */
  fam: Record<M3Formation, number>;
  plan: M3Plan;
  target: BoardTarget;
  /** 이번 시즌 일정 · 순위표 · 진행. */
  fixtures: M3Fixture[][];
  table: M3TableRow[];
  block: number;
  /** 이번 시즌 컵 라운드(0 탈락 전 시작, 이긴 라운드 수). null이면 탈락. */
  cupAlive: boolean;
  cupRound: number;
  /** 다음 구간 전력 보정(이야기 · 팀 토크). */
  form: number;
  window: 'summer' | 'winter' | null;
  targets: M3Target[];
  /** 내 선수에게 온 제안(이적시장). */
  bids: { player: number; fee: number; club: string }[];
  lastReport: M3BlockReport | null;
  review: M3Review | null;
  offers: M3Offer[];
  history: M3SeasonRecord[];
  clubs: string[];
  /** 커리어 누적. */
  titles: number;
  cups: number;
  promotions: number;
  sacked: number;
  awards: number;
  wins: number;
  draws: number;
  losses: number;
  topLeague: string;
  comeback: boolean;
  /** 포메이션 · 성향을 쓴 구간 수, 포메이션별 가장 높았던 익숙함. */
  formUse: Record<M3Formation, number>;
  /** 커리어 전체에서 포메이션별 쓴 구간 수(감독 카드 숙련 · 특기). */
  blocksBy: Record<M3Formation, number>;
  styleUse: Record<ManagerStyle, number>;
  famPeak: Record<M3Formation, number>;
  /** 유스 출신이 데뷔한 수 · 리그 평균 이상으로 자란 수. */
  youthDebuts: number;
  youthStars: number;
  seenEvents: string[];
  /** 성장 점수를 준 능력치 기록(카드 화면 연출용). */
  spent: Partial<Record<M3Attr, number>>;
}
