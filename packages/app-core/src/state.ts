// ───────── 앱 상태 (웹·앱 공용, T-11-002) ─────────
// 화면·탭·진행 중 커리어·생성 초안 등 클라이언트 상태의 모양과 처음 값. 반응성은 클라이언트가 붙인다 —
// 웹은 Svelte `$state`로 감싸고(ui/state.svelte.ts), 앱은 자기 스토어로 감싼다. 게임 진행 액션
// (game-actions.ts)은 넘겨받은 객체를 그대로 고친다.
import type { PotentialFlow } from './potential-view.js';
import { personName } from '@offside/game/i18n/names';
import { BODY_DEFAULT, type Body } from '@offside/contracts/body';
import { nationFromLocales } from '@offside/contracts/nations';
import { deviceLocales } from './i18n/core.js';
import type { HofSort, RetiredNumberResult, TeamRankSort } from '@offside/contracts';
import type { BoardKey } from '@offside/contracts/board-limits';
import { activeSeason, retireAtNow } from '@offside/contracts/service-seasons';
import { detailPosOpen, dposFor, DETAILS_OF } from '@offside/contracts/positions';
import type { OutboxItem } from './outbox.js';
import type { AttrKey, DetailPos, Pos } from '@offside/game/data';
import { pick, ri } from '@offside/game/rng';
import { SURNAMES, GIVEN, defaultFocus } from '@offside/game/data';
import type { GameState, HofEntry, LegendSource } from '@offside/game/types';
import type { Candidate } from '@offside/game/candidates';
import type { PhaseReport } from './sheets.js';

/** 기록실(하단 메뉴 'hof')의 탭. T-11-028 'ach' = 업적 랭킹. */
export type HofTab = 'legends' | 'rn' | 'teams' | 'ach';
/**
 * 기록실 화면 상태. season: 서비스 시즌 순위(T-10-090). null이면 전체 명예의 전당. team: 라이브 랭킹에서 연 팀
 * 프로필(T-10-092).
 */
export type HofView = {
  tab: HofTab;
  page: number;
  sort: HofSort;
  season: number | null;
  team: string | null;
  /** T-10-101 이름 검색어(공개 이름 부분 일치). */
  q: string;
  /** T-11-018 포지션별 순위(null = 모든 포지션). */
  pos: Pos | null;
  /** T-11-129 팀 랭킹 탭을 열 때의 정렬(홈 구단 가치 TOP 3의 전체 보기). 없으면 레이팅. */
  teamSort?: TeamRankSort;
  /** T-11-150 team 팀의 구단주 프로필을 연다(팀 프로필 대신). */
  owner?: boolean;
};
/** 기록실을 열 때의 상태. 시즌이 진행 중이면 그 시즌 순위부터 보여 준다. */
export const hofStart = (): HofView => ({
  tab: 'legends',
  page: 1,
  sort: 'score',
  season: activeSeason(new Date().toISOString())?.id ?? null,
  team: null,
  q: '',
  pos: null,
});

export type TeamView = 'team' | 'achievements' | 'opponents' | 'result' | 'history';

export type Screen =
  | 'home'
  | 'create'
  | 'retired'
  | 'game'
  | 'legend'
  | 'settings'
  | 'owner'
  | 'honors'
  /** T-10-092 구단주 팀(구단주 화면에서 연다). */
  | 'team'
  /** T-11-080 이적시장(구단주 화면에서 연다). */
  | 'market'
  /** 구단 자금 내역(구단주 화면의 구단 자금 칸에서 연다). */
  | 'funds'
  /** T-11-128 구단주 시즌 결산(구단주 화면의 '시즌 결산' 카드로 연다). */
  | 'recap'
  /** T-11-145 오프사이드 컵(구단주 화면의 컵 배너로 연다). */
  | 'cup'
  | 'board'
  | 'dex'
  | 'hof'
  | 'firsts'
  /** T-11-015 라운지 채팅(홈의 채팅 버튼으로 연다). */
  | 'chat'
  | 'admin'
  | 'shared';
export type Tab = 'season' | 'player' | 'career' | 'trophy';

export interface DraftCharacter {
  name: string;
  number: number;
  pos: Pos;
  /** T-10-091 세부 포지션. 시즌 1 개막 전(프리시즌)엔 고르지 않는다 — create-view.draftDpos()가 거른다. */
  dpos: DetailPos | null;
  foot: GameState['foot'];
  /** T-10-008. 키우고 싶은 주력 능력치(FOCUS_PICK개). */
  focus: AttrKey[];
  trait: string;
  /** T-10-096 국적(국가 코드, 기본 대한민국). */
  nation: string;
  /** T-10-096 키(cm)·몸무게(kg). null이면 포지션 기본 체격을 따른다(포지션을 바꾸면 같이 바뀐다). */
  height: number | null;
  weight: number | null;
}

/** 새 커리어에 넣을 체격 — 입력하지 않은 칸은 포지션 기본값. */
export const draftBody = (c: Pick<DraftCharacter, 'pos' | 'height' | 'weight'>): Body => ({
  h: c.height ?? BODY_DEFAULT[c.pos].h,
  w: c.weight ?? BODY_DEFAULT[c.pos].w,
});

/** T-10-091 지금 새 선수가 세부 포지션을 고를 수 있는가(시즌 1 개막부터). */
export const detailOpenNow = (): boolean => detailPosOpen(new Date().toISOString());

/** 새 커리어에 넣을 세부 포지션 — 프리시즌이거나 큰 포지션과 어긋나면 넣지 않는다. */
export const draftDpos = (
  c: Pick<DraftCharacter, 'pos' | 'dpos'>,
  now = new Date().toISOString(),
): DetailPos | undefined => (detailPosOpen(now) && dposFor(c.pos, c.dpos)) || undefined;

/** T-11-045 새 커리어의 은퇴 나이 — 지금 시즌(개막 전이면 프리시즌)의 값으로 정해져 커리어에 고정된다. */
export const draftRetireAt = (): number => retireAtNow(new Date().toISOString());

/** 생성 확정 시각을 한 번만 읽는다. 자정을 넘긴 초안도 화면과 같은 기본 세부 포지션을 받는다. */
export function draftCareerRules(
  c: Pick<DraftCharacter, 'pos' | 'dpos'>,
  now = new Date().toISOString(),
): { dpos: DetailPos | undefined; retireAt: number } {
  return {
    dpos: draftDpos(c, now) ?? (detailPosOpen(now) ? DETAILS_OF[c.pos][0] : undefined),
    retireAt: retireAtNow(now),
  };
}

/** 무작위 이름 — 영어면 같은 뽑기를 로마자로 보여 준다(난수 소비는 언어와 같다). */
export function randomName(): string {
  return personName(pick(SURNAMES) + pick(GIVEN));
}

/** T-10-076 기본 등번호는 무작위(1~99) — 모두 10번으로 시작하면 영구결번이 10번에 몰린다. 칸은 비우고 직접 적을 수 있다. */
export const randomNumber = (): number => ri(1, 99);

/** T-10-005 은퇴 선수 상세 화면에 띄울 대상. 내 선수(로컬 ft_hof)면 `own`이 있고 이름 공개를 바꿀 수 있다. */
export interface LegendView {
  name: string;
  number: number | null;
  pos: Pos;
  /** T-10-091 세부 포지션 — 있으면 시즌 1 선수라 레전드 등급을 시즌 1 기준으로 가른다(T-11-018). */
  dpos: string | null | undefined;
  /** 국적 코드. 남긴 국적이 없는 옛 로컬 기록은 undefined — 국기를 그리지 않는다. */
  nation?: string | undefined;
  age: number;
  lastClub: string;
  /** T-10-066. 옛 기록에는 없다 — 엠블럼은 이름으로 찾는다. */
  lastClubId?: string | null | undefined;
  /** T-11-122 도트 선수 얼굴을 정하는 커리어 ID. 옛 로컬 기록처럼 ID가 없으면 null(그리지 않는다).
   * 모습(retiredAvatarSpec)은 화면에서 만든다 — 여기서 만들면 그림 모듈이 첫 화면 번들에 들어간다. */
  avatarId?: string | null | undefined;
  score: number;
  peak: number;
  /** 시즌별 상세. 옛 기록(스냅샷 없음)은 null — 요약만 보여 준다. */
  d: LegendSource | null;
  totals: {
    apps: number;
    goals: number;
    assists: number;
    trophies: number;
    awards: number;
    caps: number;
    ballon: number;
  };
  own: HofEntry | null;
  /** T-10-069 공유 링크를 걸 커리어 id — 내 선수(이 기기·계정 기록) 중 명예의 전당에 오른 기록만. 아래 공유 바(ShareBar)를 띄운다. */
  shareId: string | null;
  /** 남의 공개 이름이면 이름 신고(앱스토어 UGC 정책)에 쓸 커리어 id. 내 선수·익명이면 null. */
  reportId: string | null;
  /** T-10-026 대표 칭호 id. */
  title: string | null;
  /** 은퇴 시점의 기록된 잠재력(반올림한 truePot). 값이 없는 옛 기록에는 표시하지 않는다. */
  pot?: { real: string; value: number } | undefined;
  /** T-11-141 이 기기에서 은퇴한 커리어만: 잠재력이 바뀐 과정과 시드·밸런스 버전. */
  flow?: PotentialFlow | undefined;
  /** T-10-076 영구결번 심사 결과. null = 자격 없음, undefined = 아직 모름(업로드 전·옛 기록). */
  rn?: RetiredNumberResult | null | undefined;
  /** Server-verified public retirement honor, even when the selected title differs. */
  wallOfHonor?: boolean | undefined;
}

export interface AppState {
  G: GameState | null;
  screen: Screen;
  tab: Tab;
  lastRetired: HofEntry | null;
  legend: LegendView | null;
  C: DraftCharacter;
  /** T-10-002. 선수 생성 후보 카드 3장(같은 능력치 총합, 다른 분포) — 생성 화면을 벗어나면 null. */
  candidates: Candidate[] | null;
  candidatesOpen: boolean[];
  candidatePick: number | null;
  candidatePotentialOpen: boolean;
  /** T-10-011. 소식 화면에서 마지막으로 본 게시판. */
  board: BoardKey;
  /** 소식 화면에서 펼친 글(없으면 목록). 홈의 소식 섹션에서 누른 글을 바로 열 때도, 뒤로 가기로 되살릴 때도 쓴다. */
  boardOpenId: string | null;
  /** T-10-113 소식 화면에서 하단 '소식'을 다시 누른 횟수 — 바뀌면 글 상세를 닫고 목록으로 간다. */
  boardTop: number;
  /** T-10-013. 진행 중 커리어가 다른 계정 소유라 서버가 거절한 시즌 업로드(홈에서 처리를 고른다). */
  ownerConflict: OutboxItem[] | null;
  /** 기록실 화면의 탭(명예의 전당·영구결번)·페이지(1부터)·순위 유형. 선수 상세에서 돌아와도 그대로다. */
  hof: HofView;
  /** 선수 상세의 '← 이전으로'가 돌아갈 화면. */
  legendBack: 'home' | 'hof' | 'owner';
  /** T-10-130 구단주 팀 안의 화면 — 뒤로 가기 기록에 남도록 appState에 둔다(history.svelte.ts). */
  teamView: TeamView;
  /** T-10-029. 공유 링크(/career/:id)로 들어온 은퇴 선수 id — 보기 전용 화면(SharedCareer)이 읽는다. */
  sharedCareer: string | null;
  /** T-10-024. 방금 끝난 구간 리포트(시즌 탭 맨 위). 저장하지 않는다 — 새로고침하면 사라진다. */
  report: PhaseReport | null;
  /** T-11-034 업적 탭에서 아직 보지 않은 새 업적 수 — 하단 '구단주'·내 팀 '업적' 탭의 점(achNudge.ts). */
  achNew: number;
  /** T-11-128 끝난 시즌 결산이 나왔는데 이 기기에서 아직 안 열어 봤는가 — 하단 '구단주' 탭의 점(recapUnseen). */
  recapNew: boolean;
  /** T-11-142 받은 친구 신청 수 — 하단 '구단주'·내 팀 '경기' 탭·'친구' 버튼의 점(friendPending). */
  friendReq: number;
}

/** 기기·브라우저 언어 태그(웹 navigator.languages, 앱은 Intl). 읽을 수 없으면 빈 목록. */
/** 선수 생성 국적 기본값 — 접속한 기기의 언어 지역을 따른다(T-11-140, ja-JP → 일본). */
const deviceNation = () => nationFromLocales(deviceLocales());

/** 앱을 열 때의 상태. */
export const initialAppState = (): AppState => ({
  G: null,
  screen: 'home',
  tab: 'season',
  lastRetired: null,
  legend: null,
  C: {
    name: randomName(),
    number: randomNumber(),
    pos: 'FW',
    dpos: null,
    foot: '오른발',
    focus: defaultFocus('FW'),
    trait: 'late',
    nation: deviceNation(),
    height: null,
    weight: null,
  },
  candidates: null,
  candidatesOpen: [],
  candidatePick: null,
  candidatePotentialOpen: false,
  board: 'notice',
  boardOpenId: null,
  boardTop: 0,
  ownerConflict: null,
  hof: hofStart(),
  legendBack: 'home',
  teamView: 'team',
  sharedCareer: null,
  report: null,
  achNew: 0,
  recapNew: false,
  friendReq: 0,
});
