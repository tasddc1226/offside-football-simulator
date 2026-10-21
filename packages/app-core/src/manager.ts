// T-11-310 감독 커리어(웹 ui/Manager.svelte · 앱 screens/owner/Manager.tsx 공용). 감독 커리어는 기기에서 돌고(게임 엔진
// manager.ts, 세이브 ft_mgr_save), 서버는 시작 · 포기 · 완료와 팀 감독 칸만 맡는다. 감독 화면(지연 청크)만 import한다.
import type {
  ReleaseManagerResponse,
  ManagerCandidate,
  ManagerCareer,
  ManagerCareerResponse,
  ManagerResult,
  ManagersResponse,
  PutTeamCoachResponse,
  TeamCoach,
} from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/storage';
import {
  MANAGER_SAVE_KEY,
  currentEvent,
  managerChoiceOdds,
  migrateManagerSave,
  newManagerCareer,
  type ManagerState,
  type MgrEvent,
  type MgrSeason,
  type MgrSnapshot,
} from '@offside/game/manager';
import type { Chip } from '@offside/game/stats';
import { apiFetch, ownerCachedGet } from './api/client.js';
import { fmtValue } from './format.js';
import { managerText as M } from './i18n/ko/manager.js';

export type { Chip, ManagerCandidate, ManagerCareer, ManagersResponse, TeamCoach };
export { coachEffectText, managerName } from './managerCard.js';

/** 감독 화면 데이터(진행 중 · 끝낸 감독 · 시작할 수 있는 카드). 쓰기가 성공하면 메모가 비워진다. */
export const fetchManagers = () => ownerCachedGet<ManagersResponse>('/v1/managers', 60_000);
export const startManager = (careerId: string) =>
  apiFetch<ManagerCareerResponse>('/v1/managers', {
    method: 'POST',
    body: JSON.stringify({ careerId }),
  });
export const abandonManager = (id: string) =>
  apiFetch<void>(`/v1/managers/${id}/abandon`, { method: 'POST' });
export const finishManager = (id: string, result: ManagerResult) =>
  apiFetch<ManagerCareerResponse>(`/v1/managers/${id}/finish`, {
    method: 'POST',
    body: JSON.stringify({ result }),
  });
/** 지금 시즌 팀 감독 칸(null이면 비운다). */
/** T-11-345 끝낸 감독 경질(되돌릴 수 없다). 직접 키운 선수면 방출처럼 자금을 받는다. */
export const releaseManager = (id: string) =>
  apiFetch<ReleaseManagerResponse>(`/v1/managers/${id}/release`, { method: 'POST' });
export const setTeamCoach = (coach: string | null) =>
  apiFetch<PutTeamCoachResponse>('/v1/owner-team/coach', {
    method: 'PUT',
    body: JSON.stringify({ coach }),
  });

/**
 * 진행 중 감독 커리어의 기기 세이브. 같은 커리어 세이브가 있으면 이어 하고, 없거나 다른 커리어 것이면(다른 기기에서 시작 ·
 * 포기 뒤 새로 시작) 서버 시드로 처음부터 만든다.
 */
export function loadManagerState(active: ManagerCareer, name: string | null): ManagerState {
  const saved = migrateManagerSave(loadKey(MANAGER_SAVE_KEY));
  if (saved && saved.id === active.id) return saved;
  const s = newManagerCareer({
    id: active.id,
    careerId: active.careerId,
    seed: active.seed,
    origin: active.origin,
    name,
  });
  saveManagerState(s);
  return s;
}
export const saveManagerState = (s: ManagerState) => saveKey(MANAGER_SAVE_KEY, s);
export const clearManagerState = () => saveKey(MANAGER_SAVE_KEY, null);

/** 감독으로 바꾸기 전 확인 창 줄(잃는 것). */
export function startConfirmLines(c: ManagerCandidate): string[] {
  return [
    ...(c.inLineup ? [M.confirmLineup] : []),
    ...(c.listed ? [M.confirmListed] : []),
    ...(c.inLineup && c.cardValue ? [M.confirmValue({ value: fmtValue(c.cardValue) })] : []),
    M.confirmLocked,
    M.confirmAbandon,
  ];
}

/** T-11-443 '감독 카드로 확정' 확인 창에 보이는 줄(감독 칸에 앉힐 수 있다 · 되돌릴 수 없다). */
export const finishConfirmLines = (): string[] => [M.finishSeat, M.finishFinal];

// ───────── 진행 연출(선수 커리어의 경기 중계 · 변화 칩과 같은 방식) ─────────

const STAT_KEYS = ['fame', 'trust', 'morale', 'fans', 'control', 'adapt'] as const;
const STAT_LABEL = {
  fame: () => M.statFame,
  trust: () => M.statTrust,
  morale: () => M.statMorale,
  fans: () => M.statFans,
  control: () => M.statControl,
  adapt: () => M.statAdapt,
} as const;

export type ManagerStatKey = (typeof STAT_KEYS)[number];

/** T-11-329 상단 감독 상태 여섯 칸(이름 · 값). */
export const managerStats = (s: Omit<MgrSnapshot, 'mastery'>) =>
  STAT_KEYS.map((k) => ({ k, label: STAT_LABEL[k](), v: s[k] }));

/** T-11-329 두 상태 사이에 바뀐 칸과 그 차이(상단 칸 옆 +3 · −2 표시). */
export function statDelta(
  a: Omit<MgrSnapshot, 'mastery'>,
  b: Omit<MgrSnapshot, 'mastery'>,
): Partial<Record<ManagerStatKey, number>> {
  return Object.fromEntries(STAT_KEYS.filter((k) => b[k] !== a[k]).map((k) => [k, b[k] - a[k]]));
}

/** 두 상태 사이 변화 칩(0인 값은 뺀다). */
export function statChips(
  a: Omit<MgrSnapshot, 'mastery'>,
  b: Omit<MgrSnapshot, 'mastery'>,
): Chip[] {
  return STAT_KEYS.filter((k) => b[k] !== a[k]).map((k) => ({
    label: STAT_LABEL[k](),
    d: b[k] - a[k],
  }));
}

/** 결산 변화 칩(옛 세이브 시즌은 빈 목록). */
export const seasonChips = (h: MgrSeason): Chip[] =>
  h.start && h.end ? statChips(h.start, h.end) : [];

/** 이번 시즌에 오른 포메이션 숙련 한 줄(오르지 않았으면 null). */
export const masteryUpLine = (h: MgrSeason): string | null =>
  h.start && h.end && h.formation && h.start.mastery !== h.end.mastery
    ? M.masteryUp({ formation: h.formation, from: h.start.mastery, to: h.end.mastery })
    : null;

export type SeasonBadge = 'title' | 'cup' | 'promoted' | 'relegated' | 'sacked';
/** 결산 머리 배지(우승 · 컵 · 승격은 좋은 것, 강등 · 경질은 나쁜 것). */
export function seasonBadges(h: MgrSeason): { k: SeasonBadge; label: string; bad: boolean }[] {
  const out: { k: SeasonBadge; label: string; bad: boolean }[] = [];
  if (h.title) out.push({ k: 'title', label: M.badgeTitle, bad: false });
  if (h.cup) out.push({ k: 'cup', label: M.badgeCup, bad: false });
  if (h.promoted) out.push({ k: 'promoted', label: M.badgePromoted, bad: false });
  if (h.relegated) out.push({ k: 'relegated', label: M.badgeRelegated, bad: true });
  if (h.outcome === 'sacked') out.push({ k: 'sacked', label: M.badgeSacked, bad: true });
  return out;
}

/** 경기 중계 한 경기 간격(ms): 시즌 전체가 약 3.6초 안에 끝나게(선수 커리어 경기 중계와 같은 템포). */
export const liveStepMs = (matches: number) =>
  Math.max(70, Math.min(260, Math.round(3600 / Math.max(1, matches))));

/** 경기 중계 누적(승 · 무 · 패 · 승점). */
export function liveTally(rows: readonly { res: 'W' | 'D' | 'L' }[]) {
  const w = rows.filter((r) => r.res === 'W').length;
  const d = rows.filter((r) => r.res === 'D').length;
  return { w, d, l: rows.length - w - d, pts: w * 3 + d };
}

// ───────── T-11-329 선수 커리어와 같은 진행 화면(선택지 확률 · 성공/실패 · 시즌 단계 · 아래 고정 버튼) ─────────

/** 이벤트 선택지 오른쪽 확률 칸(선수 이벤트처럼 '50%', 실패할 수 없으면 '확정'). */
export const choiceOddsLabels = (id: string): string[] =>
  managerChoiceOdds(id).map((p) => (p === null ? M.oddsSure : `${Math.round(p * 100)}%`));

/** 답한 이벤트의 성공/실패(확정 선택 · 옛 세이브는 null). */
export const eventOutcome = (ev: MgrEvent): { label: string; ok: boolean } | null =>
  ev.ok === undefined ? null : { label: ev.ok ? M.outcomeOk : M.outcomeFail, ok: ev.ok };

const STEP_PHASES = ['offers', 'setup', 'transfer', 'event', 'result'] as const;

/** 이번 시즌 진행 단계(제의 → 준비 → 영입 → 이야기 → 결산). 커리어를 끝냈으면 null. */
export function managerSteps(s: Pick<ManagerState, 'phase'>) {
  const active = STEP_PHASES.indexOf(s.phase as (typeof STEP_PHASES)[number]);
  if (active < 0) return null;
  return {
    steps: [M.stepOffers, M.stepSetup, M.stepTransfer, M.stepEvent, M.stepResult],
    active,
    progress: (active + 1) / STEP_PHASES.length,
  };
}

export type ManagerBarAct =
  | 'manager-rest'
  | 'manager-season'
  | 'manager-next'
  | 'manager-result'
  | 'manager-continue'
  | 'manager-finish';

/**
 * 화면 아래 고정 버튼(선수 커리어의 '다음 →'처럼 스크롤하지 않고 누른다). 여럿 중 고르는 단계(제의 · 영입 · 이벤트
 * 선택지)와 경기 중계 중에는 없다. answered는 결과를 보여 주고 있는 이벤트가 있는지, live는 경기 중계 중인지.
 */
export function managerBar(
  s: ManagerState,
  o: { answered: boolean; live: boolean },
): { act: ManagerBarAct; label: string } | null {
  if (s.phase === 'offers')
    return s.offers.length || s.club ? null : { act: 'manager-rest', label: M.rest };
  if (s.phase === 'setup') return { act: 'manager-season', label: M.startSeason };
  if (s.phase === 'event') {
    if (o.answered) return { act: 'manager-next', label: M.next };
    return currentEvent(s) ? null : { act: 'manager-result', label: M.toResult };
  }
  if (s.phase === 'result') return o.live ? null : { act: 'manager-continue', label: M.nextSeason };
  if (s.phase === 'done') return { act: 'manager-finish', label: M.finish };
  return null;
}

/**
 * T-11-330 선수 플레이처럼 아래에서 올라오는 창으로 띄우는 단계(제의 · 영입 · 이벤트 · 경기 중계 · 결산)면 그 창 이름,
 * 화면에 그대로 두는 단계(시즌 준비 · 커리어 끝)면 null. live는 경기 중계 중인지.
 */
export function managerSheetLabel(s: ManagerState, live: boolean): string | null {
  const n = s.history.at(-1)?.n ?? s.season;
  if (s.phase === 'offers') return M.offersHeading;
  if (s.phase === 'transfer') return M.transferHeading;
  if (s.phase === 'event') return M.sheetEvent({ n: s.season + 1 });
  if (s.phase === 'result') return live ? M.liveEyebrow({ n }) : M.resultHeading({ n });
  return null;
}
