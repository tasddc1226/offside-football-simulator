// T-11-804 첫 시즌 선수 정보 고치기(웹 PlayerEditSheet.svelte · 앱 PlayerEditSheet.tsx가 같이 쓴다). 규칙은 game player-edit.ts,
// 여기는 입력 검사 문구 · 미리보기 · 기기 이름표(ft_names) 맞추기만 한다. 서버를 부르지 않는다 — 첫 시즌 결산 전에는 서버에
// 커리어 행이 없고, 첫 시즌 업로드가 고친 값으로 처음 들어간다.
import { BODY_LIMITS, bmiOf, bodyError, type Body } from '@offside/contracts/body';
import { PLAYER_NAME_MAX, toPublicName } from '@offside/contracts/content-filter';
import { SUBS, ovr } from '@offside/game/attributes';
import { CAREER_NAMES_KEY } from '@offside/game/hof-store';
import {
  FEET,
  bodyEditable,
  bodyWaiting,
  editPlayerInfo,
  firstSeasonEditOpen,
  shownBody,
  type PlayerEdit,
} from '@offside/game/player-edit';
import { loadKey, saveKey } from '@offside/game/storage';
import type { Foot, GameState } from '@offside/game/types';
import { playerEditText as L } from './i18n/ko/playerEdit';

export { FEET, PLAYER_NAME_MAX, bodyEditable, bodyWaiting, firstSeasonEditOpen, shownBody };

export interface PlayerEditInput {
  name: string;
  /** 입력 칸 그대로(비우면 null). */
  h: number | null;
  w: number | null;
  foot: Foot;
}

/** 시트를 열 때 채울 처음 값. */
export const playerEditInput = (s: GameState): PlayerEditInput => {
  const b = shownBody(s);
  return { name: s.name, h: b.h, w: b.w, foot: s.foot };
};

/** 체격 입력 오류 문구(없으면 null). 계약 bodyError와 같은 범위를 쓰고, 문구만 화면 사전에서 가져온다. */
export function bodyMessage(b: { h: number | null; w: number | null }): string | null {
  const { height: H, weight: W, bmi: B } = BODY_LIMITS;
  if (b.h == null || !Number.isInteger(b.h) || b.h < H.min || b.h > H.max)
    return L.heightRange({ min: H.min, max: H.max });
  if (b.w == null || !Number.isInteger(b.w) || b.w < W.min || b.w > W.max)
    return L.weightRange({ min: W.min, max: W.max });
  const body = { h: b.h, w: b.w };
  if (bodyError(body) === null) return null;
  return bmiOf(body) < B.min ? L.tooLight : L.tooHeavy;
}

export type PlayerEditDraft =
  | { ok: true; edit: PlayerEdit; changed: boolean }
  | { ok: false; field: 'name' | 'body' | 'closed'; message: string };

/**
 * 입력을 고칠 내용으로 다듬는다. 이름은 이름 변경권과 같은 규칙(빈 이름 · 길이 · 링크 · 욕설 · 기호)을 지키되, 지금 이름과
 * 같으면 그대로 둔다(만들 때 고른 이름은 다시 검사하지 않는다).
 */
export function playerEditDraft(s: GameState, input: PlayerEditInput): PlayerEditDraft {
  if (!firstSeasonEditOpen(s)) return { ok: false, field: 'closed', message: L.closed };
  const edit: PlayerEdit = {};
  const name = input.name.trim();
  if (name !== s.name) {
    if (!name) return { ok: false, field: 'name', message: L.nameEmpty };
    if (name.length > PLAYER_NAME_MAX || !toPublicName(name))
      return { ok: false, field: 'name', message: L.nameInvalid };
    edit.name = name;
  }
  if (input.foot !== s.foot && FEET.includes(input.foot)) edit.foot = input.foot;
  if (bodyEditable(s)) {
    const msg = bodyMessage(input);
    if (msg) return { ok: false, field: 'body', message: msg };
    const b = { h: input.h!, w: input.w! };
    if (b.h !== s.body!.h || b.w !== s.body!.w) edit.body = b;
  }
  return { ok: true, edit, changed: Object.keys(edit).length > 0 };
}

export interface BodyPreview {
  /** 바뀌는 세부 능력치("헤딩 +1.5"), 변화가 큰 순으로 최대 6개. */
  rows: { key: string; label: string; delta: number; text: string }[];
  /** 지금 OVR과 고친 뒤 OVR. 타깃맨처럼 두 역할 중 높은 쪽으로 재는 선수만 다를 수 있다. */
  ovr: { from: number; to: number };
}

/** 체격을 body로 고치면 세부 능력치가 어떻게 바뀌는지(세이브는 건드리지 않는다). 고칠 수 없으면 null. */
export function bodyPreview(s: GameState, body: Body): BodyPreview | null {
  if (!bodyEditable(s) || bodyError(body) !== null) return null;
  // editPlayerInfo는 sub · seasonStartSub · seasonStart · peakProfile을 새 객체로 바꾸고 attrs만 제자리에서 고친다. 얕은 복사에
  // attrs만 따로 복사하면 세이브를 건드리지 않는다(웹 $state 프록시는 structuredClone이 되지 않는다).
  const next: GameState = { ...s, attrs: { ...s.attrs } };
  editPlayerInfo(next, { body });
  const rows = Object.keys(s.sub)
    .map((key) => ({
      key,
      delta: Math.round(((next.sub[key] ?? 0) - (s.sub[key] ?? 0)) * 10) / 10,
    }))
    .filter((r) => r.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.key.localeCompare(b.key))
    .slice(0, 6)
    .map((r) => ({
      ...r,
      label: SUBS[r.key] ?? r.key,
      text: `${SUBS[r.key] ?? r.key} ${r.delta > 0 ? '+' : '−'}${Math.abs(r.delta).toFixed(1)}`,
    }));
  return { rows, ovr: { from: ovr(s), to: ovr(next) } };
}

/**
 * 고친 내용을 세이브에 넣는다. 바뀌었으면 true(부른 쪽이 세이브를 쓴다). 이름을 바꿨으면 이 기기 이름표(ft_names)도 맞춘다.
 * 첫 시즌 결산 전이라 명예의 전당(ft_hof)에는 아직 이 선수가 없다.
 */
export function applyPlayerEdit(s: GameState, edit: PlayerEdit): boolean {
  if (!editPlayerInfo(s, edit)) return false;
  if (edit.name !== undefined) {
    const names = loadKey<Record<string, string>>(CAREER_NAMES_KEY);
    if (names && s.cid in names) saveKey(CAREER_NAMES_KEY, { ...names, [s.cid]: s.name });
  }
  return true;
}
