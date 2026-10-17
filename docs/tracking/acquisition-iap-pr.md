# T-11-363: 광고 유입과 검증 IAP 거래 연결

웹에서 일반 App Store URL만 열어 소재 정보가 끊기고, 검증 거래 원장에 구매시각·통화·금액이 없는 문제를 보완한다. 허용 캠페인 링크, 계정 연결 별도 동의, 30일 first/last touch, 소모성·광고 제거 거래 정본, 구매·환불·신규 결제자·반복 거래·미귀속 집계를 추가한다. 기본 off이며 운영 설정·거래·배포는 변경하지 않았다.

소모성은 기존 지급 batch와 거래 PK로 한 번만 지급하고, 광고 제거는 originalTransactionId로 복원 중복을 막는다. 검증된 환불이 먼저 도착하면 marker를 읽어 소모성 지급을 막는다. 가격·통화·시각은 검증된 거래값만 사용하며 미확인 값은 NULL이다. 새 GA4/Meta/MMP 구매 이벤트는 보내지 않는다. 기존 광고 제거 권한은 유지한다.

오프라인 철회는 네트워크 전에 원래 프로필 대상을 저장한다. 대상 미확정 상태는 보존하고 다른 계정에 자동 적용하지 않는다. 분석 off여도 설정에서 재시도할 수 있다. 광고 제거 INSERT에서 현행 동의와 미삭제 프로필을 원자적으로 확인한다. 독립 리뷰에서 발견한 3개 경합 결함을 수정했고 재검토에서 추가 차단 결함은 발견되지 않았다.

**Draft 범위**: 현재 provider 일치, Safari 시스템 배너, 실제 StoreKit Sandbox와 실제 GA4 app stream 수집은 미검증이다. 전체 연동 완료·100% 추적·과거 91건 소급 귀속을 주장하지 않는다. 자세한 동의·집계·복구 기준은 [설계 기록](acquisition-iap-integration.md)에 있다.

## 최신 main과 migration

main `94c76a835b051e502b8ccafdbcefdd6b39762c09`를 읽기 전용 fetch로 반영했다. PR782의 출석 코드·라우트·삭제 경로·EXPECTED_TABLES를 보존했다. 0109 기준으로 0110을 새로 생성해 snapshot 부모 일치와 journal 108→109→110을 확인했다. schema 재생성 추가 변경 없음. Drizzle의 coalesce 식 인덱스 직렬화와 ADD COLUMN FK SET NULL SQL만 교정했다.

0110은 기능 off여도 환불 marker 경로에서 필요하므로 코드 배포 전 적용이 필수다. 이번 작업에서 migration을 운영 DB에 적용하지 않았다. 다른 PR772/774/775/782/784를 수정하지 않았다.

## 검증

- 최신 main 전체 API 직렬 실행: 104개 파일·976개 테스트 통과(1,291초). 작업자1, 파일 병렬 off, hook/test timeout90초. 이전 ECONNRESET/poisoned/timeout은 재현되지 않았다. 병렬도와 제한 시간을 함께 바꿨으므로 단일 원인은 확정하지 않는다.
- 최신 main: 공용828, contracts161, game453(1 skip), 모바일 설정8, SEO10, 웹83(네이티브 모의7 포함), 브라우저 최초 E2E14 통과. 최종 실행은 아래 실패 기록을 따른다. API·web·e2e·mobile 타입 검사, Svelte 오류0(기존경고5), 변경 ESLint·i18n·dependency 검사 통과. API 리뷰 회귀는 전체 실행에 포함됐다. 이후 서버 revision 추가분은 아래 관련 검사 결과를 별도로 따른다.
- 최신 main 활성화 합성 빌드144.65KB gzip/145KB 통과. 실제 Apple token 기본값은 비어 있다.
- 이전 API 병렬 실행은 Miniflare ECONNRESET/poisoned stub 후 중단. 이어진 이전 main 직렬 실행은 main 이동 확인으로 중단했다. 두 실행 모두 전체 통과로 보지 않는다.
- 실제 구매·StoreKit/GA4 실기기·운영 데이터 변경·배포·원격 CI는 미실행이다.

## 원격 게시와 활성화 조건

기존 CLI 읽기 확인: tasddc1226(keyring) 인증 정상, 대상 repo permissions는 admin/maintain/pull/push/triage=true이며 fetch가 성공했다. 앞선 제한 환경 연결 실패와 collaborator-permission 조회403으로 push 불가를 단정하지 않는다. 과거 실제 쓰기403의 정확한 동작 증거는 아직 미확인이다. 다른 설치/자격증명으로 우회하거나 재인증하지 않았다. 부모 최신 지시가 읽기 전용이므로 push/PR 생성은 미시도이며 원격 SHA/PR/CI는 없다.

활성화 전에는 현재 공식 provider 대조, 같은 pt를 웹/worker에 설정, 동의 on/off 실제 앱 스트림·StoreKit Sandbox·Safari 검증이 필요하다. 테스트 계정·실행 가능한 개발 앱·GA4 테스트 스트림 접근이 필요하다. 새 계정/OAuth 생성이나 운영 접근 확대는 별도 승인 범위다. 병합·운영 배포·새 바이너리 출시·Meta/MMP·ATT/스토어 신고 및 개인정보 전송 확장은 별도 승인 범위다.

pt=128166757은 사용자가 제공한 과거 공식 Threads 링크의 근거가 있으나 현재 provider 일치는 확인하지 못해 기본값을 설정하지 않았다. App Store Connect의 `offside_link_check` 캠페인명 입력은 자동 승인 검토가 외부 쓰기로 거절했다. 실행되지 않았으며 재시도하지 않았다. 현재 공식 링크 제공 또는 해당 동작의 별도 승인이 필요하다.

release-notes: none

기본 off인 기능의 활성화 전 사용자 안내는 `release-notes-drafts/acquisition-iap.json`에 보관한다.

모바일 비동기 동의 재검사와 모의 회귀도 독립 재검토 완료. 고유 결제자는 first-party 프로필 단위이며 서로 미연결된 계정을 같은 사람으로 추정하지 않는다.

최종 서버 revision: 철회는 최소 표식을 보관하고 먼저 발행된 오래된 grant(null/이전 revision)를 원자적으로 거절한다. 새 명시적 동의는 최신 revision을 읽어야 한다. marker는 계정 삭제까지 유지하며 UI ko/en/ja와 개인정보 안내에 반영했다. 0110을 0109 기준 재생성했고 drizzle 추가 변경 없음이다. 전체 976 이후 이 최종 패치의 관련 5파일 31개가 통과했다(전체 재실행과 구분). 실기기 목록 조회는 CoreSimulator 서비스 오류/지연으로 확정하지 못했으며 구매·로그인·앱 설치는 하지 않았다.

최종 E2E는 13개 통과, 기존 출석 창 ha-streak 접근성 1개 실패다(대비 4.12:1, 요구4.5:1). 동일 테스트 단독 재실행도 실패했다. HomeAttendance.svelte는 origin/main과 동일하며 변경하지 않았다. 이전 14개 통과와 혼동하지 않으며, 현재 브라우저 전체 green은 아니다. 원인 분리/별도 출석 접근성 수정은 남아 있다. 새 유입·철회 E2E 2개는 최종 실행에서도 통과했다.
