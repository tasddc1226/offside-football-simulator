# T-11-363: 광고 유입과 검증 IAP 거래 연결

웹에서 일반 App Store URL만 열어 소재 정보가 끊기고, 검증 거래 원장에 구매시각·통화·금액이 없는 문제를 보완한다. 허용 캠페인 링크, 계정 연결 별도 동의, 30일 first/last touch, 소모성·광고 제거 거래 정본, 구매·환불·신규 결제자·반복 거래·미귀속 집계를 추가한다. 기본 off이며 운영 설정·거래·배포는 변경하지 않았다.

소모성은 기존 지급 batch와 거래 PK로 한 번만 지급하고, 광고 제거는 originalTransactionId로 복원 중복을 막는다. 검증된 환불이 먼저 도착하면 marker를 읽어 소모성 지급을 막는다. 가격·통화·시각은 검증된 거래값만 사용하며 미확인 값은 NULL이다. 새 GA4/Meta/MMP 구매 이벤트는 보내지 않는다. 기존 광고 제거 권한은 유지한다.

오프라인 철회는 네트워크 전에 원래 프로필 대상을 저장한다. 대상 미확정 상태는 보존하고 다른 계정에 자동 적용하지 않는다. 분석 off여도 설정에서 재시도할 수 있다. 광고 제거 INSERT에서 현행 동의와 미삭제 프로필을 원자적으로 확인한다. 독립 리뷰에서 발견한 3개 경합 결함을 수정했고 재검토에서 추가 차단 결함은 발견되지 않았다.

**Draft 범위**: 현재 공식 provider128166757 일치는 2026-10-18T02:34:09.001Z에 확인했다(설계 기록의 현재 검증 상태 참고). 운영 기본값/변수는 설정하지 않았다. Safari 시스템 배너, 실제 StoreKit Sandbox와 실제 GA4 app stream 수집은 미검증이다. 전체 연동 완료·100% 추적·과거 91건 소급 귀속을 주장하지 않는다. 자세한 동의·집계·복구 기준은 [설계 기록](acquisition-iap-integration.md)에 있다.

## 최신 main과 migration

main `852ba64519ae2f0af81d00ebe1d4b28d6b038a1d`(#792)까지 반영했다. 보드 양쪽 행과 경기 리포트·출석·이름변경·일일 점검 코드를 보존했다. #792는 migration/schema 변경이 없으며 0111 snapshot 부모0110과 journal109→110→111을 다시 확인했다. 자동 병합된 SEO는 기존 acquisition 개인정보 본문이 이전 head와 정확히 같고, 나머지 내용이 #792 main과 같음을 확인했다. 기존 Drizzle coalesce 인덱스와 SET NULL SQL 교정은 유지한다.

0111은 기능 off여도 환불 marker 경로에서 필요하므로 코드 배포 전 적용이 필수다. 이번 작업에서 migration을 운영 DB에 적용하지 않았다. 다른 PR772/774/775/782/784를 수정하지 않았다.

## 검증

- 최신 main 전체 API 직렬 실행: 104개 파일·976개 테스트 통과(1,291초). 작업자1, 파일 병렬 off, hook/test timeout90초. 이전 ECONNRESET/poisoned/timeout은 재현되지 않았다. 병렬도와 제한 시간을 함께 바꿨으므로 단일 원인은 확정하지 않는다.
- 최신 main: 공용828, contracts161, game453(1 skip), 모바일 설정8, SEO10, 웹91(네이티브 모의15 포함), 브라우저 최초 E2E14 통과. 이후 main #786 반영 후 최종 E2E도14개 통과했다. API·web·e2e·mobile 타입 검사, Svelte 오류0(기존경고5), 변경 ESLint·i18n·dependency 검사 통과. API 리뷰 회귀는 전체 실행에 포함됐다. 이후 서버 revision 추가분은 아래 관련 검사 결과를 별도로 따른다.
- 최신 main 활성화 합성 빌드144.67KB gzip/145KB 통과. 실제 Apple token 기본값은 비어 있다.
- 이전 API 병렬 실행은 Miniflare ECONNRESET/poisoned stub 후 중단. 이어진 이전 main 직렬 실행은 main 이동 확인으로 중단했다. 두 실행 모두 전체 통과로 보지 않는다.
- 실제 구매·StoreKit/GA4 실기기·운영 데이터 변경·배포는 미실행이다. PR #787 a4be97bc의 CI 39047090122 및 guard 39047101485는 통과했고 main 배포 작업은 skipped다. 이후 변경은 새 head CI로 확인한다.
- main #786 병합 후 API 관련 6파일37개, 최종 expected-profile guard/IAP 2파일18개, 웹91개·SEO10개·모바일 타입/ESLint/i18n 통과. 전체 API976개는 이전 main94c 검사이며 이후 패치 전체 재실행을 뜻하지 않는다.

## 원격 게시와 활성화 조건

기존 CLI 읽기 확인: tasddc1226(keyring) 인증 정상, 대상 repo permissions는 admin/maintain/pull/push/triage=true이며 fetch가 성공했다. 앞선 제한 환경 연결 실패와 collaborator-permission 조회403으로 push 불가를 단정하지 않는다. 과거 실제 쓰기403의 정확한 동작 증거는 아직 미확인이다. 다른 설치/자격증명으로 우회하거나 재인증하지 않았다. 진단용 읽기 전용 제한은 해제됐다. 게시 범위는 기존 동일 인증·동일 원격·독립 브랜치의 non-force push와 draft PR 생성이다. 병합·배포·권한 확대는 승인 범위가 아니다.

활성화 전에는 현재 공식 provider 대조, 같은 pt를 웹/worker에 설정, 동의 on/off 실제 앱 스트림·StoreKit Sandbox·Safari 검증이 필요하다. 테스트 계정·실행 가능한 개발 앱·GA4 테스트 스트림 접근이 필요하다. 새 계정/OAuth 생성이나 운영 접근 확대는 별도 승인 범위다. 병합·운영 배포·새 바이너리 출시·Meta/MMP·ATT/스토어 신고 및 개인정보 전송 확장은 별도 승인 범위다.

pt=128166757은 사용자가 제공한 과거 공식 Threads 링크의 근거가 있으나 현재 provider 일치는 확인하지 못해 기본값을 설정하지 않았다. App Store Connect의 `offside_link_check` 캠페인명 입력은 자동 승인 검토가 외부 쓰기로 거절했다. 실행되지 않았으며 재시도하지 않았다. 현재 공식 링크 제공 또는 해당 동작의 별도 승인이 필요하다.

release-notes: none

기본 off인 기능의 활성화 전 사용자 안내는 `release-notes-drafts/acquisition-iap.json`에 보관한다.

모바일 비동기 동의 재검사와 모의 회귀도 독립 재검토 완료. 고유 결제자는 first-party 프로필 단위이며 서로 미연결된 계정을 같은 사람으로 추정하지 않는다.

최종 서버 revision: 철회는 최소 표식을 보관하고 먼저 발행된 오래된 grant(null/이전 revision)를 원자적으로 거절한다. 새 명시적 동의는 최신 revision을 읽어야 한다. marker는 계정 삭제까지 유지하며 UI ko/en/ja와 개인정보 안내에 반영했다. 0111을 0109 기준 재생성했고 drizzle 추가 변경 없음이다. 전체 976 이후 이 최종 패치의 관련 5파일 31개가 통과했다(전체 재실행과 구분). 실기기 목록 조회는 CoreSimulator 서비스 오류/지연으로 확정하지 못했으며 구매·로그인·앱 설치는 하지 않았다.

최신 main #786 반영 후 최종 E2E는14개 모두 통과했다. 이전 main94c 실행은13개 통과, 출석 창 ha-streak 대비 실패(4.12:1/요구4.5:1)였으나 #786의 출석 UI를 그대로 반영한 뒤 재현되지 않았다. 출석 기능은 임의 수정하지 않았다. 새 유입·철회 E2E2개도 통과했다.

게시 전 열린 PR 대조에서 #785/#781/#780/#779/#777이 각각 0110 SQL·snapshot·journal을 사용함을 확인해 우리 migration을 독립 0111로 이동했다. 현재 main은0109까지이므로 0111의 부모는0109이며 journal108→109→111이다. 해당 PR 중 하나가 먼저 병합되면 최신main 반영 후 0111 snapshot/journal 재생성·drift·migration 재검증을 반드시 수행한다. 번호 회피만으로 미래 snapshot 병합이 완료된 것은 아니다. 다른 PR을 수정하지 않았다.

Android 승인 지연 P1 수정: 선택적 기록 요청의 실패·hang·409와 finishTransaction을 분리했다. 동의된 프로필의 토큰은 최대16건·논리7일 MMKV 대기열로 재전송하며 계정 변경/동의 철회 시 즉시 삭제한다. native 승인은 분석 off에서도 재시도하고 가격 조회 실패·hang에도 진행한다. 서버는 업로드 expected profile을 대조한다. 독립 재검토에서 추가 차단 문제 없음(리뷰어는 테스트 미실행). 실제 native 검증은 여전히 미완료다.

최신 migration 재생성: 게시 중 main be92d4d1(#785)이0110을 추가하여 다시 병합했다. 0111을 병합 schema에서 재생성했고 snapshot 부모0110, journal109→110→111 및 career_renames 보존을 확인했다. Drizzle 재실행 추가 변경 없음. 생성기의 알려진 coalesce 인덱스·ON DELETE SET NULL SQL 교정만 재적용했으며 운영 DB 적용은 하지 않았다. 앞선0109 부모 기록은 당시 검사 이력이다.


2026-10-18 후속: main319aa9b5(#778) 반영·보드 양쪽 행 보존. staging/production의 신규 공개 설정 전달과 deploy 전 검증을 연결했다. 기본false/0/빈provider, worker별 명시적 var 전달, provider 일치·플래그 검증, 배포 모의검사 포함. 운영 환경 변수 변경·병합·배포는 실행하지 않았다. 별도 릴리스 노트 없이 공식 release-notes:none 면제를 유지한다. Apple 폼은 승인 후에도 authResult=FAILED 로그인 화면에 막혀 도달하지 못했으며 입력/생성을 시도하지 않았다. 기존 계정 로그인 복구가 필요하다.

CI39087673328이 head7fc5fee8에서 전체 성공한 뒤 main7297a213(#790)이 추가되어 보드를 다시 양쪽 행 보존으로 병합했다. migration은0110 그대로이며 일일 실행/이상기록 코드를 보존했다. 새 merge head는 별도 CI로 확인한다.


## #792 병합 검증과 번들 차단

#792는 migration/schema를 변경하지 않았다. 보드 양쪽 행을 보존했고 SEO의 기존 acquisition 개인정보 본문은 이전 head와, 나머지 SEO는 #792 main과 정확히 일치한다. 관련 API65개·공용 모델23개·게임 리포트3개·SEO10개가 로컬 통과했다. 브라우저 회귀30개는 별도 결과를 따른다.

운영 모양의 합성 활성화 빌드는145.21KB gzip으로 기존145KB 예산을 초과한다. 예산·검사를 완화하지 않는다. 우리 UI/캠페인 모듈 분리와 중복 처리 축소는 예산을 해결하지 못해 모두 원복했다. 최종 구현에는 효과 없는 최적화가 남아 있지 않다. 경기 리포트 등 관련 없는 기능도 수정하지 않았다. 이 빌드 차단은 별도 초기 번들 최적화 또는 예산 결정이 필요하다. 원격 CI는 새 merge head로 확인한다. 운영 설정·배포·실제 결제는 실행하지 않았다.
