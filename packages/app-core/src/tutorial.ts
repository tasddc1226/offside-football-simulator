// T-11-473 처음 온 기기의 첫 커리어 따라가기 안내(웹 Coachmark.svelte · 앱 components/Coachmark.tsx). 홈의 새 커리어 버튼부터
// 선수 만들기(포지션 · 주력 능력치 · 후보) → 첫 진행 → 첫 이벤트 → 첫 시즌 결산까지 화면의 한 곳을 비추고 말풍선을 띄운다.
// 단계마다 비출 자리(id)가 화면에 보일 때만 뜨고, 사용자가 다른 길로 앞 단계를 건너뛰면 지금 보이는 뒤 단계로 넘어간다.
// 기기에 커리어 · 명예의 전당 기록이 있으면(기존 이용자) 처음부터 끝난 것으로 둔다. 설정에서 다시 볼 수 있다.
// 화면 표시만 한다 — 게임 상태 · 세이브 · 난수 · 서버는 건드리지 않는다.
import { hasKey, loadKey, saveKey } from '@offside/game/storage';

/** 비출 자리. 웹은 [data-coach="<id>"], 앱은 useCoachTarget('<id>')로 등록한다. */
export type CoachId =
  | 'new'
  | 'pos'
  | 'focus'
  | 'candidates'
  | 'cands'
  | 'start'
  | 'go'
  | 'choice'
  | 'season'
  | 'retire';

export interface CoachStep {
  id: CoachId;
  /** 비출 자리. 마지막 은퇴 안내는 결산 카드를 그대로 비춘다. */
  target: CoachId;
  /** 'tap'이면 비춘 자리를 누를 때 넘어가고(다음 버튼 없음), 'next'면 말풍선의 다음 버튼으로 넘어간다. */
  advance: 'tap' | 'next';
}

export const COACH_STEPS: readonly CoachStep[] = [
  { id: 'new', target: 'new', advance: 'tap' },
  { id: 'pos', target: 'pos', advance: 'next' },
  { id: 'focus', target: 'focus', advance: 'next' },
  { id: 'candidates', target: 'candidates', advance: 'tap' },
  { id: 'cands', target: 'cands', advance: 'tap' },
  { id: 'start', target: 'start', advance: 'tap' },
  { id: 'go', target: 'go', advance: 'tap' },
  { id: 'choice', target: 'choice', advance: 'tap' },
  { id: 'season', target: 'season', advance: 'next' },
  { id: 'retire', target: 'season', advance: 'next' },
];

const KEY = 'ft_tutorial';
/**
 * 저장값: 다음에 보일 단계 번호, 끝났으면 -1. replay는 설정의 다시 보기로 연 안내라는 표시다(T-11-796). 옛 코드는 i만 읽고
 * 쓰므로 표시가 없는 값 · 표시를 지운 값과도 그대로 맞는다.
 */
type Saved = { i: number; replay?: true };
/** 이번 실행의 안내가 다시 보기인가. coachResume이 저장값에서 읽어 두고, 끝나면(coachDone) 지운다. */
let replaying = false;

/** 이 기기에서 커리어를 해 본 적이 있는지(진행 중 세이브 · 명예의 전당 · 옛 이름 키). 세이브를 파싱하지 않는다. */
export const playedBefore = (): boolean =>
  hasKey('ft_save') || hasKey('ft_hof') || hasKey('sl_save') || hasKey('sl_hof');

/**
 * 앱을 열 때 이어 볼 단계. 안내를 처음 판단하는 기기면 커리어를 해 본 적이 없을 때만 0부터 시작하고, 해 본 기기는 끝난 것으로
 * 적는다. 끝났거나 저장소에 적을 수 없으면(사생활 보호 모드 등 — 매번 처음부터 다시 뜨지 않게) null.
 */
export function coachResume(played: boolean = playedBefore()): number | null {
  const v = loadKey<Saved>(KEY);
  replaying = false;
  if (v && typeof v.i === 'number') {
    const on = v.i >= 0 && v.i < COACH_STEPS.length;
    replaying = on && v.replay === true;
    return on ? v.i : null;
  }
  const i = played ? -1 : 0;
  if (!saveKey(KEY, { i })) return null;
  return i < 0 ? null : i;
}

/** 단계 i까지 봤다 — 다음에 열면 i부터. 마지막을 넘기면 끝. 다시 보기 표시는 끝날 때까지 이어 적는다. */
export function coachAt(i: number): void {
  if (!(i >= 0 && i < COACH_STEPS.length)) return coachDone();
  saveKey(KEY, replaying ? { i, replay: true } : { i });
}

/** 건너뛰기 · 마지막 단계 뒤. 설정의 다시 보기 전까지 다시 뜨지 않는다. */
export function coachDone(): void {
  replaying = false;
  saveKey(KEY, { i: -1 });
}

/** 설정의 다시 보기 — 처음 단계부터. 저장소에 적지 못해도 이번 실행에서는 보인다. */
export function coachReplay(): number {
  replaying = true;
  saveKey(KEY, { i: 0, replay: true });
  return 0;
}

/**
 * T-11-796 지금 안내가 설정의 다시 보기로 연 것인가. 단계 계측(T-11-792)은 처음 온 기기의 안내만 재므로 부르는 쪽이 이 값으로
 * 거른다. 표시를 저장값에 함께 두어 새로고침 · 앱 재실행 뒤에 이어지는 다시 보기도, 커리어 기록이 없는 기기의 다시 보기도 가른다.
 */
export const coachReplaying = (): boolean => replaying;

/**
 * 지금 보일 단계. from부터 뒤로 비출 자리가 보이는 첫 단계를 고른다(사용자가 다른 길로 앞 단계를 지나쳤으면 따라간다).
 * 보이는 자리가 없으면 null — 그 화면에서는 말풍선을 띄우지 않고 기다린다.
 */
export function coachPick(from: number, visible: (id: CoachId) => boolean): number | null {
  for (let i = Math.max(0, from); i < COACH_STEPS.length; i++)
    if (visible(COACH_STEPS[i]!.target)) return i;
  return null;
}

/** 말풍선 위치. 비춘 자리 아래에 자리가 있으면 아래, 아니면 위. 가로는 화면 안으로 맞춘다(웹 · 앱 같은 계산). */
export function bubbleAt(
  rect: { x: number; y: number; w: number; h: number },
  view: { w: number; h: number },
  bubble: { w: number; h: number },
  gap = 12,
  margin = 16,
): { x: number; y: number; below: boolean } {
  const below =
    rect.y + rect.h + gap + bubble.h <= view.h - margin || rect.y - gap - bubble.h < margin;
  const y = below
    ? Math.min(rect.y + rect.h + gap, view.h - margin - bubble.h)
    : Math.max(margin, rect.y - gap - bubble.h);
  const x = Math.min(
    Math.max(margin, rect.x + rect.w / 2 - bubble.w / 2),
    Math.max(margin, view.w - margin - bubble.w),
  );
  return { x, y: Math.max(margin, y), below };
}
