/**
 * T-11-792 로그인 · 이번 시즌 팀 저장 · 첫 커리어 따라가기 안내 계측 계약(웹 · 앱 공용). 이벤트 이름과 값의 허용 목록을 한곳에 둔다.
 * 사용자 ID · 닉네임 · 팀 이름 · 서버 문자열 원문은 싣지 않는다. 목록 밖 값은 other로 접거나 이벤트를 버린다.
 *
 * - login_attempt: 로그인 버튼을 누른 한 번의 시도. outcome=start(누름)로 시작해 cancel(사용자가 닫음) · fail(reason 코드) ·
 *   linked(지금 프로필에 연결) · switched(기존 계정으로 전환) 중 하나로 끝난다. place는 버튼이 있던 곳이다.
 *   웹은 로그인하러 페이지를 떠났다 돌아오므로 끝 이벤트의 place를 탭 저장소에 적어 둔 값으로 읽는다(없으면 other).
 * - team_create_view: 팀이 아직 없는 구단주가 이번 시즌 팀 화면을 받았을 때(실행마다 한 번). players는 넣을 수 있는 선수 수 구간.
 * - team_create_done: 이번 시즌 팀이 없던 상태에서 저장 성공. starters는 채운 선발 자리 수 구간.
 *   서버는 시즌마다 새 팀을 만들게 하므로 team_create_view · team_create_done은 신규 구단주만이 아니라 시즌이 바뀐 뒤의
 *   기존 구단주도 다시 잡힌다(생애 첫 팀이 아니다). 응답에 지난 시즌 팀 유무가 없어 둘을 가르지 않는다.
 * - team_save_fail: 팀 저장이 실패함. reason은 서버 거절 사유 코드의 허용 목록이고, 요청이 서버에 닿지 않았거나 응답을 읽지
 *   못했으면 network다. mode는 이번 시즌 팀이 없던 때의 저장(create)인지 그 밖(edit: 고치기 · 지난 시즌 · 프리시즌 팀)인지.
 *   T-11-796 create · team_create_done은 team_create_view와 같은 조건(보고 있는 시즌이 이번 시즌)일 때만이다.
 * - tutorial_step · tutorial_skip · tutorial_done: 따라가기 안내의 단계가 실제로 보임(실행마다 단계별 한 번) · 건너뛰기 ·
 *   마지막 단계의 완료. 설정의 다시 보기로 연 안내는 보내지 않는다(부르는 쪽이 tutorial.coachReplaying으로 거른다).
 */
import { COACH_STEPS, type CoachId } from './tutorial.js';

export const LOGIN_EVENT = 'login_attempt';
/** 로그인 버튼이 있는 곳. retire = 은퇴 화면의 선수 지키기 카드, packs = 앱 상품 묶음, other = 웹에서 돌아왔는데 곳을 모름. */
export const LOGIN_PLACES = [
  'owner',
  'settings',
  'home',
  'retire',
  'chat',
  'board',
  'team_comments',
  'league',
  'cup',
  'market',
  'shop',
  'packs',
  'manager',
  'team',
  'rename',
  'other',
] as const;
export type LoginPlace = (typeof LOGIN_PLACES)[number];
export type LoginProvider = 'google' | 'apple';
export type LoginOutcome = 'start' | 'cancel' | 'fail' | 'linked' | 'switched';
/**
 * 실패 사유. 서버가 돌려보낸 코드(session · rate_limited · unavailable · exchange · state)와 클라이언트 단계
 * (offline 세션 · 프로필을 못 받음, start 시작 요청 실패, provider 로그인 창 오류, token 신원 토큰 없음, finish 토큰 교환 실패,
 * inapp 인앱 브라우저라 막음)다. 그 밖은 other.
 */
export const LOGIN_REASONS = [
  'session',
  'rate_limited',
  'unavailable',
  'exchange',
  'state',
  'offline',
  'start',
  'provider',
  'token',
  'finish',
  'inapp',
  'other',
] as const;
export type LoginReason = (typeof LOGIN_REASONS)[number];

/**
 * 팀 저장 실패 사유. 서버 거절(details.reason)은 코드 그대로, CUP_로 시작하는 컵 검사 사유는 CUP 하나로 묶는다.
 * T-11-796 network는 서버 거절이 아니라 요청이 닿지 않았거나(연결 끊김 · 시간 초과) 응답을 읽지 못한 경우다.
 */
export const TEAM_FAIL_REASONS = [
  'RESERVED_NAME',
  'BLOCKED_WORD',
  'DUPLICATE_PLAYER',
  'PLAYER_NOT_ELIGIBLE',
  'SEASON_NOT_OPEN',
  'CUP',
  'network',
  'other',
] as const;
export type TeamFailReason = (typeof TEAM_FAIL_REASONS)[number];
/** 서버 답을 받지 못한 실패의 클라이언트 코드(api/transport의 failure 코드). */
const NO_ANSWER_CODES: readonly unknown[] = ['NETWORK_ERROR', 'INVALID_RESPONSE'];

export type FunnelEvent =
  | {
      kind: 'login';
      outcome: LoginOutcome;
      place: LoginPlace;
      provider: LoginProvider;
      /** fail일 때만 쓴다. 서버 reason 원문을 넘겨도 허용 목록으로 접는다. */
      reason?: unknown;
    }
  | { kind: 'team_view'; players: number }
  | { kind: 'team_done'; starters: number }
  | { kind: 'team_fail'; reason: unknown; created: boolean }
  | { kind: 'tutorial'; action: 'step' | 'skip' | 'done'; step: CoachId };

const OUTCOMES: readonly unknown[] = ['start', 'cancel', 'fail', 'linked', 'switched'];
const fold = <T extends string>(list: readonly T[], raw: unknown): T =>
  (list as readonly unknown[]).includes(raw) ? (raw as T) : ('other' as T);

/** 서버 · 클라이언트 실패 사유를 허용 목록으로 접는다. */
export const loginReason = (raw: unknown): LoginReason => fold(LOGIN_REASONS, raw);
export const teamFailReason = (raw: unknown): TeamFailReason =>
  NO_ANSWER_CODES.includes(raw)
    ? 'network'
    : typeof raw === 'string' && raw.startsWith('CUP_')
      ? 'CUP'
      : fold(TEAM_FAIL_REASONS, raw);

/** 넣을 수 있는 은퇴 선수 수 구간. */
export const playersBucket = (n: number): string =>
  !(n > 0) ? '0' : n < 5 ? '1_4' : n < 11 ? '5_10' : '11_plus';
/** 채운 선발 자리 수 구간. */
export const startersBucket = (n: number): string =>
  !(n > 0) ? '0' : n < 6 ? '1_5' : n < 11 ? '6_10' : '11';

/**
 * 보낼 이벤트 이름과 매개변수. 허용 목록 밖이면 null(보내지 않는다).
 * once가 있으면 보내는 쪽이 실행마다 그 키로 한 번만 보낸다.
 */
export function funnelParams(
  e: FunnelEvent,
): { name: string; params: Record<string, string>; once?: string } | null {
  switch (e.kind) {
    case 'login': {
      if (!(LOGIN_PLACES as readonly unknown[]).includes(e.place)) return null;
      if (e.provider !== 'google' && e.provider !== 'apple') return null;
      if (!OUTCOMES.includes(e.outcome)) return null;
      return {
        name: LOGIN_EVENT,
        params: {
          place: e.place,
          provider: e.provider,
          outcome: e.outcome,
          ...(e.outcome === 'fail' ? { reason: loginReason(e.reason) } : {}),
        },
      };
    }
    case 'team_view':
      return {
        name: 'team_create_view',
        params: { players: playersBucket(e.players) },
        once: 'team_view',
      };
    case 'team_done':
      return { name: 'team_create_done', params: { starters: startersBucket(e.starters) } };
    case 'team_fail':
      return {
        name: 'team_save_fail',
        params: { reason: teamFailReason(e.reason), mode: e.created ? 'create' : 'edit' },
      };
    case 'tutorial': {
      if (!COACH_STEPS.some((s) => s.id === e.step)) return null;
      if (e.action !== 'step' && e.action !== 'skip' && e.action !== 'done') return null;
      return {
        name: 'tutorial_' + e.action,
        params: { step: e.step },
        ...(e.action === 'step' ? { once: 'tutorial:' + e.step } : {}),
      };
    }
    default:
      return null;
  }
}
