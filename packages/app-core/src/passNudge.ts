/**
 * T-11-770c 은퇴 뒤 시즌 패스 안내(웹 · 앱 공용, 기획 T-11-747 R1). 패스가 없는 구단주가 이번 시즌 은퇴 5 · 9 · 15 · 25명을 넘기면
 * 은퇴 화면에 카드 하나를 보인다. 안내를 만들려고 서버를 부르지 않는다: 패스 화면을 열었을 때 받은 진행도를 기기에 적어 두고,
 * 은퇴 기록이 서버에 올라간 것이 확인될 때마다(outbox) 그 수만큼 더한다. 그래서 숫자는 어림이고, 카드에는 보상 수량을 적지
 * 않는다. 실제 진행도 · 보상은 카드를 눌러 연 패스 화면이 서버에서 다시 받는다.
 * 빈도: 한 번 보이면 7일 동안, 닫아도 7일 동안 다시 보이지 않고, 한 번 실행에 한 번만 보인다. 게임 세이브와 따로 둔다.
 */
import { loadKey, saveKey } from '@offside/game/storage';
import type { SeasonPassSeason } from '@offside/contracts';
import { passSaleSeason } from '@offside/contracts/season-pass';

export const PASS_NUDGE_KEY = 'ft_pass_nudge';
/** 이 은퇴 수를 처음 넘길 때 안내 후보가 된다(패스 5 · 7 · 9 · 11단계가 열리는 수). */
export const PASS_NUDGE_AT = [5, 9, 15, 25] as const;
const HIDE_MS = 7 * 86_400_000;

export type PassNudgeState = {
  v: 1;
  season: number;
  owned: boolean;
  /** 이번 시즌 35세 이상 은퇴 수(패스 화면에서 받은 값 + 그 뒤 올라간 은퇴). */
  progress: number;
  /** 넘긴 기준 가운데 가장 높은 것. 보였거나 없으면 null. */
  pending: number | null;
  /** 이 시각(ms) 전에는 보이지 않는다. */
  hideUntil: number;
};

/** 패스 화면이 받은 지금 시즌 상태를 적는다. 같은 시즌이면 숨김 기한과 남은 후보를 잇는다(패스를 샀으면 후보를 지운다). */
export function passNudgeSeen(prev: PassNudgeState | null, cur: SeasonPassSeason): PassNudgeState {
  const same = prev?.season === cur.season;
  return {
    v: 1,
    season: cur.season,
    owned: cur.owned,
    progress: cur.progress,
    pending: same && !cur.owned ? (prev?.pending ?? null) : null,
    hideUntil: same ? (prev?.hideUntil ?? 0) : 0,
  };
}

/** 서버에 올라간 35세 이상 은퇴 n건을 더한다. 여러 기준을 한 번에 넘기면 가장 높은 하나만 남긴다. 시즌이 바뀌었으면 버린다. */
export function passNudgeRetired(
  prev: PassNudgeState | null,
  n: number,
  season: number,
): PassNudgeState | null {
  if (!prev || prev.season !== season) return null;
  if (n <= 0 || prev.owned) return prev;
  const progress = prev.progress + n;
  const crossed = PASS_NUDGE_AT.filter((t) => prev.progress < t && t <= progress).at(-1);
  return { ...prev, progress, pending: crossed ?? prev.pending };
}

/** 지금 보일 기준(은퇴 수). 없으면 null. */
export const passNudgeDue = (s: PassNudgeState | null, now: number, season: number) =>
  s && s.season === season && !s.owned && s.pending !== null && now >= s.hideUntil
    ? s.pending
    : null;

/** 보였거나 닫았을 때: 7일 숨긴다. */
export const passNudgeShown = (s: PassNudgeState, now: number): PassNudgeState => ({
  ...s,
  pending: null,
  hideUntil: now + HIDE_MS,
});

// ───────── 기기 저장(웹 localStorage · 앱 기기 저장소) ─────────
const load = () => {
  const s = loadKey<PassNudgeState>(PASS_NUDGE_KEY);
  return s && s.v === 1 ? s : null;
};
let shownThisRun = false;
const listeners = new Set<() => void>();
/** 은퇴가 더해져 안내 후보가 생겼을 수 있을 때 부른다(은퇴 화면 카드가 다시 본다). */
export function onPassNudge(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** 패스 화면이 서버 응답을 받을 때마다. */
export function notePassSeen(cur: SeasonPassSeason | undefined): void {
  if (cur) saveKey(PASS_NUDGE_KEY, passNudgeSeen(load(), cur));
}
/** outbox가 은퇴 기록을 올린 뒤(35세 이상 n건). */
export function notePassRetired(n: number, now = new Date()): void {
  const prev = load();
  if (!prev) return;
  const next = passNudgeRetired(prev, n, passSaleSeason(now.toISOString()));
  if (next) saveKey(PASS_NUDGE_KEY, next);
  else saveKey(PASS_NUDGE_KEY, null);
  for (const fn of listeners) fn();
}
/** 은퇴 화면 카드가 보일지 묻는다. 보이면 그 자리에서 7일 숨김을 적는다(한 번 실행에 한 번). */
export function takePassNudge(now = new Date()): number | null {
  if (shownThisRun) return null;
  const s = load();
  const due = passNudgeDue(s, now.getTime(), passSaleSeason(now.toISOString()));
  if (due === null || !s) return null;
  shownThisRun = true;
  saveKey(PASS_NUDGE_KEY, passNudgeShown(s, now.getTime()));
  return due;
}
/** 로그아웃 · 계정 전환: 앞 계정의 진행도 · 안내 상태를 버린다. */
export function clearPassNudge(): void {
  if (load()) saveKey(PASS_NUDGE_KEY, null);
}
/** 테스트용. */
export function resetPassNudgeRun(): void {
  shownThisRun = false;
}
