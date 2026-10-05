// ───────── 다른 계정 소유 커리어 처리 (웹·앱 공용, T-10-013 · 공용 T-11-005) ─────────
// 로그인 계정이 바뀐 뒤 이 기기의 진행 중 커리어를 이어 하면 서버가 시즌 업로드를 소유권 불일치(409)로 거절한다 —
// 조용히 버리지 않고 홈에서 고르게 한다: 지금 계정으로 이어서 기록(새 커리어 ID로 지난 시즌까지 다시 올린다) 또는
// 이 기기에만 두기.
import { loadKey, saveKey } from '@offside/game/season';
import type { GameState } from '@offside/game/types';
import type { PutCareerSeasonBody } from '@offside/contracts';
import type { OutboxItem } from './outbox.js';
import type { AppState } from './state.js';
import { ownerConflictText as L } from './i18n/ko/ownerConflict.js';

/** '이 기기에만 두기'를 고른 커리어 ID — 이 커리어는 다시 묻지 않는다. */
const SKIP_KEY = 'ft_conflict_skip';

export interface OwnerConflictHost {
  state: AppState;
  save(): void;
  toast(text: string): void;
  /** 새 커리어 ID로 지난 시즌을 모두 다시 큐에 넣는다(업로더 enqueueAllSeasons). */
  enqueueAllSeasons(s: GameState, eventsOf: (year: number) => PutCareerSeasonBody['events']): void;
}

export function createOwnerConflicts(host: OwnerConflictHost) {
  const { state } = host;

  /** 업로드 큐가 소유권 불일치로 돌려준 항목들. */
  function onOwnerConflict(items: OutboxItem[]) {
    const G = state.G;
    const cid = G && !G.retired ? G.cid : null;
    const active = items.filter((i) => i.kind === 'season' && i.careerId === cid);
    if (active.length < items.length) host.toast(L.otherAccount);
    if (!active.length || loadKey<string>(SKIP_KEY) === cid) return;
    state.ownerConflict = [...(state.ownerConflict ?? []), ...active];
    host.toast(L.recordedElsewhere);
  }

  /** 새 커리어 ID로 지금 계정에 처음부터 다시 기록한다(이미 다른 계정에 올라간 기록은 그대로 둔다). */
  function adoptCareer() {
    const G = state.G;
    const conflicts = state.ownerConflict;
    if (!G || !conflicts) return;
    const events = new Map(
      conflicts.flatMap((i) => (i.kind === 'season' ? [[i.year, i.body.events] as const] : [])),
    );
    G.cid = crypto.randomUUID();
    host.save();
    host.enqueueAllSeasons(G, (year) => events.get(year) ?? []);
    state.ownerConflict = null;
    host.toast(L.adopted);
  }

  function keepOnDevice() {
    if (state.G) saveKey(SKIP_KEY, state.G.cid);
    state.ownerConflict = null;
  }

  return { onOwnerConflict, adoptCareer, keepOnDevice };
}
