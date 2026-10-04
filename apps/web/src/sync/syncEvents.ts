// T-10-013. 업로드 큐(outbox, 지연 로드)가 UI에 알리는 이벤트 이름. 두 쪽이 서로를 import하지 않도록 따로 둔다.
/** 다른 프로필(계정) 소유 커리어라 서버가 거절한 항목들(detail: OutboxItem[]). */
export const OWNER_CONFLICT_EVENT = 'offside:owner-conflict';
/** T-10-076. 은퇴 업로드 응답의 영구결번 심사 결과(detail: RetiredNumberEvent). */
export const RETIRED_NUMBER_EVENT = 'offside:retired-number';
