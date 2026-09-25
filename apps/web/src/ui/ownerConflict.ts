// T-10-013. 다른 계정 소유 커리어 처리. 로그인 계정이 바뀐 뒤 이 기기의 진행 중 커리어를 이어 하면 서버가
// 시즌 업로드를 소유권 불일치(409)로 거절한다 — 조용히 버리지 않고 홈에서 고르게 한다:
// 지금 계정으로 이어서 기록(새 커리어 ID로 지난 시즌까지 다시 올린다) 또는 이 기기에만 두기.
import type { OutboxItem } from '../game/outbox.js';
import { loadKey, saveKey } from '../game/season.js';
import { OWNER_CONFLICT_EVENT } from '../game/syncEvents.js';
import { appState } from './state.svelte.js';
import { save, seasonBody, toast } from './helpers.js';

/** '이 기기에만 두기'를 고른 커리어 ID — 이 커리어는 다시 묻지 않는다. */
const SKIP_KEY = 'ft_conflict_skip';

export function watchOwnerConflicts() {
  window.addEventListener(OWNER_CONFLICT_EVENT, (e) => {
    const items = (e as CustomEvent<OutboxItem[]>).detail;
    const G = appState.G;
    const cid = G && !G.retired ? G.cid : null;
    const active = items.filter((i) => i.kind === 'season' && i.careerId === cid);
    if (active.length < items.length) toast('다른 계정의 선수라 서버에 반영하지 못했어요. 그 계정으로 로그인하면 반영돼요.');
    if (!active.length || loadKey<string>(SKIP_KEY) === cid) return;
    appState.ownerConflict = [...(appState.ownerConflict ?? []), ...active];
    toast('이 커리어는 다른 계정에 기록돼 있어요. 홈에서 확인해 주세요.');
  });
}

/** 새 커리어 ID로 지금 계정에 처음부터 다시 기록한다(이미 다른 계정에 올라간 기록은 그대로 둔다). */
export function adoptCareer() {
  const G = appState.G;
  const conflicts = appState.ownerConflict;
  if (!G || !conflicts) return;
  const events = new Map(conflicts.flatMap((i) => (i.kind === 'season' ? [[i.year, i.body.events] as const] : [])));
  G.cid = crypto.randomUUID();
  save();
  void import('../game/outbox.js').then((m) => {
    for (const rec of G.career) m.enqueueSeason(G.cid, rec.year, seasonBody(m, G, rec, events.get(rec.year) ?? []));
  });
  appState.ownerConflict = null;
  toast('지금 계정으로 이어서 기록할게요.');
}

export function keepOnDevice() {
  if (appState.G) saveKey(SKIP_KEY, appState.G.cid);
  appState.ownerConflict = null;
}
