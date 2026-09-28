// T-10-076 영구결번 심사 결과. 은퇴 업로드(outbox, 지연 로드) 응답이 이벤트로 오면 이 기기의 명예의 전당
// 기록(ft_hof)에 남기고, 은퇴 화면이 바로 다시 그리도록 반응형 맵에도 넣는다.
import type {
  LiveRetiredNumber,
  RetiredNumberResult,
  RetiredNumbersResponse,
} from '@offside/contracts';
import { onLive } from '../api/liveSocket.js';
import type { RetiredNumberEvent } from '../game/outbox.js';
import { loadHOF, saveKey } from '../game/season.js';
import { RETIRED_NUMBER_EVENT } from '../game/syncEvents.js';

/** 커리어 id → 이번 접속에서 받은 심사 결과. */
export const rnResults = $state<Record<string, RetiredNumberResult | null>>({});

export function watchRetiredNumbers() {
  window.addEventListener(RETIRED_NUMBER_EVENT, (e) => {
    const { careerId, result } = (e as CustomEvent<RetiredNumberEvent>).detail;
    recordRn(careerId, result);
  });
}

/** 심사 결과를 반응형 맵과 이 기기의 은퇴 기록에 남긴다. */
export function recordRn(careerId: string, result: RetiredNumberResult | null) {
  rnResults[careerId] = result;
  const hof = loadHOF();
  const h = hof.find((x) => x.id === careerId);
  if (!h) return;
  h.rn = result;
  saveKey('ft_hof', hof);
}

/** 서버 결번 목록의 내 선수 결번을 이 기기 기록에 채운다(배포 전 은퇴를 소급해 받은 결번은 기기에 없다). */
export function fillGranted(items: RetiredNumbersResponse['items']) {
  const hof = loadHOF();
  const mine = new Map(hof.flatMap((h) => (h.id && h.rn?.kind !== 'granted' ? [[h.id, h]] : [])));
  let changed = false;
  for (const { careerId, clubId, club, number, seq } of items) {
    const h = mine.get(careerId);
    if (!h) continue;
    h.rn = rnResults[careerId] = { kind: 'granted', clubId, club, number, seq };
    changed = true;
  }
  if (changed) saveKey('ft_hof', hof);
}

/** 이 선수의 결과 — 이번 접속에서 받은 값이 먼저, 없으면 저장된 값. */
export const rnOf = (
  careerId: string | undefined,
  saved: RetiredNumberResult | null | undefined,
) => (careerId && careerId in rnResults ? rnResults[careerId] : saved);

/** 앱을 열어 둔 모두에게 띄울, 방금 서버 어딘가에서 확정된 영구결번(RetiredNumberAlert.svelte). */
export const rnAlert = $state<{ item: LiveRetiredNumber | null }>({ item: null });

/** 홈 라이브 소켓으로 영구결번 소식을 듣는다(어느 화면에서나). 내 선수는 은퇴 화면 세리머니로 이미 봤다. */
export function watchRetiredNumberAlerts() {
  onLive((p) => {
    if (p.type !== 'retiredNumber') return;
    if (loadHOF().some((h) => h.id === p.item.careerId)) return;
    rnAlert.item = p.item;
  });
}
