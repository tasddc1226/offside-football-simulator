# T-11-363: 광고 유입과 검증 IAP 거래 연결

웹에서 일반 App Store URL만 열어 소재 정보가 끊기는 문제와, 검증 거래 원장에 통화·원시 가격·구매시각이 없는 문제를 보완합니다. 허용 캠페인으로 제한한 App Store 링크 함수, 기존 분석과 구분한 계정 연결 동의, 30일 first/last touch snapshot, 서버 거래 기준 중복 없는 구매·환불·미귀속 집계를 추가합니다. 기본은 off이며 운영 변수나 데이터는 변경하지 않았습니다.

**Draft 범위입니다.** Apple provider token 미검증, Safari 최초 HTML 배너 로컬 구현(실기기 미검증), 광고 제거 구매의 실제 StoreKit 실기기 미검증, 실제 GA4 app stream/StoreKit sandbox 수집 미검증입니다. 전체 IAP 연동 완료나 100% 추적을 주장하지 않습니다. 구현 세부사항·동의/계정 전환·집계 기준·승인 차단은 `acquisition-iap-integration.md`에 기록했습니다.

이번 실행은 push/PR 쓰기를 시도하지 않았습니다. 과거 쓰기403은 인계 내용이며 실제 실패 동작 증거는 아직 미확인입니다. collaborator-permission 조회403은 push 불가 증거가 아닙니다. 현재 gh auth status 확인 실패와 repository API 연결 실패로 권한을 판정할 수 없으며, 다른 설치·자격증명으로 우회하지 않았습니다. 최신 main에서 분리했고, PR 772/774/775는 변경하지 않았습니다. Migration은 PR782의 0109까지 피해 0110으로 분리했으며 최종 병합 전 최신 main 기준 재검증이 필요합니다.

운영 활성화 전 조건: 공식 pt 링크 검증, 비소모성 원장/계정 연결 실기기 검증, 실제 app-stream consent-on/off sandbox 검증, 최종 개인정보 안내·보존 처리량 검토. Meta App Events·MMP 활성화, 새 권한·ATT/스토어 신고·새 바이너리 출시, 병합·운영 배포는 별도 승인 범위입니다.

release-notes: none

기능은 기본 off이고 token 설정도 비어 있습니다. 실제 활성화 전 검토할 사용자 안내는 `release-notes-drafts/acquisition-iap.json`에 보관합니다.

## 로컬 검증

- 최신 main #774/776 반영 후 API·전체 migration·IAP·새 연결 테스트 26개 통과.
- 공용 캠페인·기존 analytics 테스트 21개, 웹 동의 전송 테스트 3개 통과.
- 설치 안내 E2E 5개, 새 320px 동의·게임 시작·App Store 새탭·철회 E2E 1개 통과(합성 pt=123456, 스텁 API, 외부 추적 요청 차단).
- API/web/contracts/app-core TypeScript 검사 통과, Svelte 오류 0개(기존 경고 5개).
- 검증용 활성화 빌드 성공, 초기 gzip 144.47KB / 145KB 예산.
- 변경 TS ESLint, lint:deps, lint:i18n, public-hygiene, git diff --check 통과. 최신 main 포함 재생성 후 drizzle generate 추가 변경 없음.
- 실기기 StoreKit Sandbox/GA4 실제 app stream, 유료 구매, 운영 데이터 변경, 운영 배포 및 원격 CI는 실행하지 않음.

## 추가 구현과 최종 검증

광고 제거 비소모성 거래 원장·네이티브 재전송, originalTransactionId 복원 중복 제거, Family Sharing 제외, 계정 없는 과거 복원의 미귀속, 환불 선도착 marker를 추가했다. 네이티브/서버 동의를 모두 검사하며 기존 광고 제거 권한은 유지한다. Safari 배너는 최초 HTML에서 캠페인을 넣고 캠페인별 private/no-store를 적용한다. pt=128166757은 사용자가 제공한 과거 공식 링크 근거로 보존했으며 현재 provider 일치는 아직 확인하지 못해 운영 기본값을 설정하지 않았다.

최신 main 14d35d31 포함 후 공용 코드 820개, contracts 154개, 게임 453개(1개 skip), 모바일 설정 8개, SEO 10개, 웹 전체 76개, 설치·320px E2E 6개 통과. API 결제·동의·서명·migration 관련 28개 통과 및 마지막 광고 제거 변경 2개 재확인 통과. 타입 검사 API·mobile·web, 변경 TS ESLint, i18n·dependency 검사 통과. API 전체(103개 파일 대상) 병렬 실행은 Miniflare ECONNRESET/poisoned stub 오류가 관측되어 중단했고 전체 통과가 아니다. 전체 API 회귀 gate는 미완료다. 원격 CI는 없다.

0110에는 새 표와 기존 iap_purchases 필드·인덱스가 함께 들어 있다. 기능 off여도 환불 marker 경로가 이 스키마를 사용하므로 코드 배포 전에 migration 적용이 필수다. 현재 코드·설정의 운영 반영은 하지 않았다. 실제 StoreKit Sandbox·현재 provider 대조·Safari 실기기·GA4 app stream 확인과 운영 활성화/새 바이너리 승인이 남아 있다.

### PR782 충돌 재검증

2026-10-17 읽기 확인: 최신 main은 14d35d31이다. PR782(head b999bdd8)는 열림/미병합이며 0109_owner_attendance, journal idx109, meta/0109_snapshot.json을 추가한다. PR772는 현재 closed/미병합으로 확인됐다. 기존 "여전히 열림" 기록보다 이 상태가 최신이다. 다른 PR은 수정하지 않았다.

우리 migration을 0110_acquisition_iap.sql, journal idx110, meta/0110_snapshot.json으로 옮겼다. 현재 main 기준 drizzle generate 추가 변경 없음이며 번호·파일명은 PR782와 겹치지 않는다. 아직 PR782가 main에 없으므로 0110 snapshot은 현재 main 0108을 부모로 가진다. **PR782가 먼저 병합되면 반드시 최신 main을 반영해 0110 snapshot/journal을 다시 생성하고 전체 schema drift·migration·번들을 재검증해야 한다.** 파일 번호 변경만으로 미래 snapshot 병합까지 완료됐다고 보지 않는다. 이 조건을 충족하기 전 운영 배포하지 않는다.

PR782 DDL을 끼워 넣은 main+0110 SQLite smoke 및 현재 main+0110 D1 migration 테스트 7개도 통과했다. 이 검증은 PR782 코드의 병합 승인이나 최종 snapshot 재생성을 대체하지 않는다.

리뷰 수정: 오프라인 철회는 네트워크보다 먼저 원래 프로필 대상을 영속화한다. 프로필을 한 번도 확인하지 못한 철회는 `unresolved`로 남겨 다른 계정에 자동 적용하지 않으며 원래 계정에서 명시적 재시도가 필요하다. 광고 제거 INSERT에서 현행 동의/미삭제 프로필을 원자적으로 재검사하고, 소모성 환불 선도착 marker는 구매 원장에 즉시 반영해 아이템 지급을 막는다.

독립 리뷰의 3개 결함(오프라인 철회 유실, 철회/삭제 중 광고 제거 기록 재생성, 소모성 환불 선도착 후 지급)을 수정하고 읽기 재검토를 마쳤다. 웹 전체 78개와 브라우저 E2E 7개 통과, 분석 off 철회 복구 UI 및 원래 계정 안내 포함. 합성 설정 활성화 빌드 144.53KB gzip / 145KB 통과. 전체 API는 maxWorkers=1, fileParallelism=false, hook/test timeout 90초로 직렬 재실행 중이며 최종 결과는 아래 기록으로 확정한다. 이전 병렬 중단의 단정적인 코드 결함/권한 결론은 내리지 않는다.
