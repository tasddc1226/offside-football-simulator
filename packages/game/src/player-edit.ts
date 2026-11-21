// T-11-804 첫 시즌 선수 정보 고치기. 첫 시즌 기록이 생기기 전(career.length === 0, 은퇴 전)에는 이름 · 주발 · 체격을 무료로,
// 횟수 제한 없이 고친다. 이 기간에는 서버에 커리어 행이 없어(시즌 업로드는 career.push 뒤에만 나간다) 첫 업로드가 고친 값으로
// 처음 들어간다. RNG를 쓰지 않는다 — 골든 · 밸런스 시뮬레이터는 이 경로를 부르지 않는다.
//
// 체격은 만들 때 initSubs가 한 번 넣은 bodyMods 보정만 바꾼다. 옛 보정을 빼고 새 보정을 더한 뒤, initSubs처럼 기본 역할의
// OVR을 고치기 전 값으로 다시 맞춘다(표시 OVR은 그대로). 그래서 첫 경기 전에 고친 선수는 '처음부터 그 체격으로 만든 선수'와
// 세부 능력치가 0.1 안에서 같다 — 만들 때 W 키를 0.1로 반올림한 만큼만 다르다(player-edit.test.ts 동치 하네스). 첫 경기 뒤에는
// 같은 차이를 seasonStartSub에도 옮겨 첫 시즌 성장(growth)이 부풀지 않는다.
import { BODY_DEFAULT, bodyError, type Body } from '@offside/contracts/body';
import { PLAYER_NAME_MAX } from '@offside/contracts/content-filter';
import {
  ROLES,
  bodyMods,
  ovr,
  ovrRole,
  peakProfileOf,
  roleChoices,
  syncFace,
} from './attributes.js';
import { posLabel } from './data.js';
import { gTurnText as M } from './i18n/ko/gTurn.js';
import { tnBase as tn } from './i18n/names.js';
import { nationOf } from './nation.js';
import { clamp } from './rng.js';
import type { Foot, GameState } from './types.js';

export const FEET: readonly Foot[] = ['오른발', '왼발', '양발']; // i18n-ignore 저장값

/** 첫 시즌 고치기가 열려 있나. 첫 시즌 결산(career.push) 뒤나 은퇴 뒤에는 닫힌다. */
export const firstSeasonEditOpen = (s: Pick<GameState, 'career' | 'retired'>): boolean =>
  !s.retired && s.career.length === 0;

/**
 * 체격을 고칠 수 있나(체격 입력 기능 전에 만든 선수는 체격이 없어 처음 입력은 하지 않는다 — 결정 로그 T-10-096). 이벤트 · 이적
 * 선택을 기다리는 동안(pending)에도 막는다 — 체격은 세부 능력치 분포를 옮기므로, 선택지를 보고 성공 확률에 맞춰 체격을 바꾸는
 * 우회를 막는다(결정 로그 T-11-804).
 */
export const bodyEditable = (
  s: Pick<GameState, 'career' | 'retired' | 'body'> & { pending?: GameState['pending'] },
): boolean => firstSeasonEditOpen(s) && !!s.body && !s.pending;

/** 체격이 있는데 선택을 기다리는 중이라 지금만 못 고치나(화면 안내용). */
export const bodyWaiting = (
  s: Pick<GameState, 'career' | 'retired' | 'body'> & { pending?: GameState['pending'] },
): boolean => firstSeasonEditOpen(s) && !!s.body && !!s.pending;

export interface PlayerEdit {
  name?: string | undefined;
  foot?: Foot | undefined;
  body?: Body | undefined;
}

/** 고칠 수 없는 입력이면 그 이유(없으면 null). 이름 공개 · 금칙어 같은 화면 규칙은 app-core가 먼저 본다. */
export function playerEditError(
  s: GameState,
  e: PlayerEdit,
): 'closed' | 'name' | 'foot' | 'body' | null {
  if (!firstSeasonEditOpen(s)) return 'closed';
  if (e.name !== undefined) {
    const n = e.name.trim();
    if (!n || n.length > PLAYER_NAME_MAX) return 'name';
  }
  if (e.foot !== undefined && !FEET.includes(e.foot)) return 'foot';
  if (e.body !== undefined && (!bodyEditable(s) || bodyError(e.body) !== null)) return 'body';
  return null;
}

/**
 * 세부 능력치 한 벌(sub 또는 seasonStartSub)의 체격 보정을 old → next로 옮긴다. initSubs와 같은 순서(보정 → 기본 역할 W 키에
 * OVR 차이)를 따르고, 기본 역할 OVR은 옮기기 전과 같게 맞춘다.
 */
function moveBody(
  sub: Record<string, number>,
  m0: Record<string, number>,
  m1: Record<string, number>,
  W: Record<string, number>,
  role: string,
): Record<string, number> {
  const before = ovrRole({ sub }, role);
  const out: Record<string, number> = { ...sub };
  for (const k of new Set([...Object.keys(m0), ...Object.keys(m1)])) {
    if (out[k] === undefined) continue;
    out[k] = clamp(out[k] - (m0[k] ?? 0) + (m1[k] ?? 0), 5, 99);
  }
  // initSubs와 달리 0.1로 반올림하지 않는다 — 반올림하면 고칠 때마다 OVR 실수값이 ±0.05씩 흔들려 표시 OVR이 바뀔 수 있다.
  const d = before - ovrRole({ sub: out }, role);
  for (const k in W) if (out[k] !== undefined) out[k] = clamp(out[k] + d, 5, 99);
  return out;
}

/** 커리어 첫 소식(gameStart '… {이름}, 등번호 N번으로 축구 커리어를 시작합니다.')이 옛 이름 그대로면 새 이름으로 다시 쓴다. */
function startLine(s: GameState, name: string): string {
  return M.gameStart({
    nation: s.nation ? tn(nationOf(s).ko) : '',
    club: tn(s.club.name),
    pos: posLabel(s),
    name,
    number: s.number,
  });
}
function renameStartLog(s: GameState, prev: string) {
  // 소식은 새것이 앞이라 첫 소식은 맨 끝이다. 만들 때와 언어 · 구단이 달라 문장이 다르면 건드리지 않는다.
  const first = s.log[s.log.length - 1];
  if (first && first.text === startLine(s, prev)) first.text = startLine(s, s.name);
}

/**
 * 첫 시즌 선수 정보를 고친다. 바뀐 게 있으면 true(부른 쪽이 세이브를 쓴다). 고칠 수 없는 입력이면 아무것도 바꾸지 않고 false.
 */
export function editPlayerInfo(s: GameState, e: PlayerEdit): boolean {
  if (playerEditError(s, e)) return false;
  let changed = false;
  if (e.name !== undefined && e.name.trim() !== s.name) {
    const prev = s.name;
    s.name = e.name.trim();
    renameStartLog(s, prev);
    changed = true;
  }
  if (e.foot !== undefined && e.foot !== s.foot) {
    s.foot = e.foot;
    changed = true;
  }
  const old = s.body;
  if (e.body && old && (e.body.h !== old.h || e.body.w !== old.w)) {
    const next = { h: e.body.h, w: e.body.w };
    // 보정 기준은 만들 때 포지션(포지션은 커리어 중에 바뀌지 않는다). 역할은 initSubs가 쓴 기본 역할 — 타깃맨처럼 역할이 둘인
    // 유형도 sub를 보기 전의 첫 역할로 맞춘다(mainRole은 sub를 보고 높은 쪽을 고르므로 쓰지 않는다).
    const m0 = bodyMods({ pos: s.pos, body: old });
    const m1 = bodyMods({ pos: s.pos, body: next });
    const role = roleChoices(s)[0]!;
    const W = ROLES[role]!;
    s.sub = moveBody(s.sub, m0, m1, W, role);
    syncFace(s);
    s.seasonStartSub = moveBody(s.seasonStartSub, m0, m1, W, role);
    // 첫 시즌 시작 능력치 · 최고 기록은 만들 때 값이다(시즌 결산 전엔 바뀌지 않는다) — 고친 시작 분포로 다시 잰다.
    const start: GameState = { ...s, sub: s.seasonStartSub, attrs: { ...s.attrs } };
    syncFace(start);
    s.seasonStart = { ...start.attrs };
    s.peak = ovr(start);
    s.peakProfile = peakProfileOf(start);
    s.body = next;
    changed = true;
  }
  return changed;
}

/** 화면에 보일 체격(체격 입력 전 선수는 포지션 기본 체격). */
export const shownBody = (s: Pick<GameState, 'pos' | 'body'>): Body =>
  s.body ?? BODY_DEFAULT[s.pos];
