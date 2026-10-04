// 업로드 큐(웹·앱 공용 @offside/app-core/outbox, T-11-002)의 소유권 충돌·영구결번 결과를 window 이벤트로 알린다
// (syncEvents.ts). 서버 주소·인증은 api/setup.ts가 넣는다. helpers.ts 등이 동적 import로만 불러 메인 청크와 분리한다.
import {
  configureOutbox,
  type OutboxItem,
  type RetiredNumberEvent,
} from '@offside/app-core/outbox';
import { OWNER_CONFLICT_EVENT, RETIRED_NUMBER_EVENT } from './syncEvents.js';

export * from '@offside/app-core/outbox';

const emit = <T>(type: string, detail: T) =>
  globalThis.dispatchEvent?.(new CustomEvent(type, { detail }));

configureOutbox({
  onConflict: (items) => emit<OutboxItem[]>(OWNER_CONFLICT_EVENT, items),
  onRetiredNumber: (ev) => emit<RetiredNumberEvent>(RETIRED_NUMBER_EVENT, ev),
});
