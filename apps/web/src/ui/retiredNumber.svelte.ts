// T-10-076 영구결번 심사 결과. 기록·조회는 app-core/retiredNumber가 맡고, 웹은 상태를 $state로 감싸고 업로드 큐
// (outbox, 지연 로드)의 이벤트를 받아 넘긴다.
import type { RetiredNumberResult } from '@offside/contracts';
import { createRetiredNumbers, type RnAlert, type RnMisses } from '@offside/app-core/retiredNumber';
import type { RetiredNumberEvent } from '../sync/outbox.js';
import { picked } from './titles/legendTitle.svelte.js';
import { RETIRED_NUMBER_EVENT } from '../sync/syncEvents.js';

/** 커리어 id → 이번 접속에서 받은 심사 결과. */
export const rnResults = $state<Record<string, RetiredNumberResult | null>>({});
/** 앱을 열어 둔 모두에게 띄울, 방금 서버 어딘가에서 확정된 영구결번(RetiredNumberAlert.svelte). */
export const rnAlert = $state<RnAlert>({ item: null });
/** T-11-180 커리어 id → 결번을 못 받은 이유. */
export const rnMisses = $state<RnMisses>({});

export const { recordRn, fillGranted, rnOf, watchRetiredNumberAlerts } = createRetiredNumbers(
  rnResults,
  rnAlert,
  (id, title) => {
    picked[id] = title;
  },
  rnMisses,
);

export function watchRetiredNumbers() {
  window.addEventListener(RETIRED_NUMBER_EVENT, (e) => {
    const { careerId, result, serviceSeason, title, miss } = (e as CustomEvent<RetiredNumberEvent>)
      .detail;
    recordRn(careerId, result, serviceSeason, title, miss);
  });
}
