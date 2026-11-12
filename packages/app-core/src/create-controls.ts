import {
  DETAILS_OF,
  DPOS,
  FOCUS_PICK,
  defaultFocus,
  type AttrKey,
  type DetailPos,
  type Pos,
} from '@offside/game/data';
import type { AppState } from './state.js';

type FormDraft = Pick<AppState['C'], 'pos' | 'dpos' | 'focus'>;

/** Input policy only. Candidate seeds, draft persistence and motion stay in their existing owners. */
export function pickCreateDetail(draft: FormDraft, detail: DetailPos) {
  draft.dpos = detail;
  draft.focus = [...DPOS[detail].focus];
}
export function setCreatePosition(draft: FormDraft, pos: Pos, detailOpen: boolean) {
  draft.pos = pos;
  if (detailOpen) pickCreateDetail(draft, DETAILS_OF[pos][0]!);
  else draft.focus = defaultFocus(pos);
}
export function toggleCreateFocus(draft: FormDraft, attr: AttrKey) {
  const current = draft.focus;
  draft.focus = current.includes(attr)
    ? current.filter((a) => a !== attr)
    : [...current, attr].slice(-FOCUS_PICK);
}
