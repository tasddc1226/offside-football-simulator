// T-10-076 영구결번 심사 결과. 은퇴 업로드(outbox, 지연 로드) 응답이 이벤트로 오면 이 기기의 명예의 전당
// 기록(ft_hof)에 남기고, 은퇴 화면이 바로 다시 그리도록 반응형 맵에도 넣는다.
import type { RetiredNumberResult } from '@offside/contracts';
import type { RetiredNumberEvent } from '../game/outbox.js';
import { loadHOF, saveKey } from '../game/season.js';
import { RETIRED_NUMBER_EVENT } from '../game/syncEvents.js';

/** 커리어 id → 이번 접속에서 받은 심사 결과. */
export const rnResults = $state<Record<string, RetiredNumberResult | null>>({});

export function watchRetiredNumbers() {
  window.addEventListener(RETIRED_NUMBER_EVENT, (e) => {
    const { careerId, result } = (e as CustomEvent<RetiredNumberEvent>).detail;
    rnResults[careerId] = result;
    const hof = loadHOF();
    const h = hof.find((x) => x.id === careerId);
    if (!h) return;
    h.rn = result;
    saveKey('ft_hof', hof);
  });
}

/** 이 선수의 결과 — 이번 접속에서 받은 값이 먼저, 없으면 저장된 값. */
export const rnOf = (
  careerId: string | undefined,
  saved: RetiredNumberResult | null | undefined,
) => (careerId && careerId in rnResults ? rnResults[careerId] : saved);
