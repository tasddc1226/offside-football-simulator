# API 불필요 조회 전수 조사 · 2026-10-20

## 범위와 재현 근거

최신 `origin/main` **c66b5911** 기반 `tasddc1226/api-query-audit` 전용 워크트리에서 웹(Svelte), 앱(Expo/React Native), 공용 API 클라이언트와 Hono→D1 경로를 조사했다. 운영 DB·설정·큐 쓰기 및 운영 배포는 수행하지 않는다.

[등록·호출 목록](api-query-audit-2026-10-20.inventory.json)은 TypeScript AST로 정적 추출한 기준선이다. API 42개 라우트 모듈과 `app.ts`의 등록 표현식 **192곳**(테스트 전용 1곳 포함), computed-method 등록 2곳(PUT/DELETE 좋아요), 공용 클라이언트·웹·앱의 네트워크/캐시/타이머 호출 **221곳·63파일**을 포함한다. 반복문으로 등록한 아이템 경로와 상수 경로는 표현식 그대로 남겼으므로 실제 엔드포인트 개수와 같지 않다. D1 저장소 53개 파일도 쿼리/반복 구조를 분류했다.

조사는 전 범위의 정적 구조 대조와 의심 경로의 호출 추적·실제 로컬 D1 검증을 결합했다. `auth`/`edge` 플래그는 해당 등록 본문에 직접 호출이 있는지일 뿐, 위임된 미들웨어·도우미의 최종 정책 판정이 아니다. 모든 API를 실제 운영 계정으로 호출하거나 모든 분기·기기에서 실행한 전수 동적 검증을 뜻하지 않는다. 관리자·결제·삭제·보상 경로를 조사 목적으로 운영에서 실행하지 않았다.

## 확인한 낭비와 개선

| 경로/계층                          | 변경 전                                                    | 변경 후                                                                                  | 보존 조건                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET `/v1/admin/cups`               | 대회 N개마다 상태·참가 집계 2N 문장/왕복                   | 상태·GROUP BY 집계 2문장을 한 batch로. 9개 대회 fixture의 관련 SQL 18→2, 왕복 18→1       | 목록 순서, 접수/예정/진행/완료 구분, 취소 참가 제외, 관리자 확인 유지. 일정·인증 조회는 별도                 |
| 카드 판매·감독 전향의 컵 참가 검사 | 활성 대회마다 쓰지 않는 전체 경기 목록까지 읽음            | 경기 목록 조회 N→0                                                                       | 같은 시즌 활성 참가·현재 선발 잠금은 유지                                                                    |
| 팀 명단 저장의 컵 검사             | 대회별 경기 목록과 동일 선발의 판매 여부를 반복 조회       | 모든 활성 대회의 목록 1회, 같은 선발의 판매 여부 최대 1회. 대회 2개 fixture에서 각각 2→1 | 두 번째 대회의 경기 잠금·최소 인원·구간 OVR·기존 오류 우선순위 유지. 경기 detail JSON 제외                   |
| GET `/v1/cups/:id/predictions`     | 캐시 적중에도 컵 전체 일정 1회 조회                        | 고정 대회 id는 검증·일정 조회를 cache loader 안으로 옮겨 warm hit D1 0회                 | 움직이는 `current`는 먼저 실제 대회를 해석하는 조회 유지. 없는 대회 404·실패 비캐시·투표 후 집계 무효화 유지 |
| PUT 경기 승부예측                  | 투표할 때마다 컵 홈·전체 대회 캐시까지 무효화              | 투표 집계만 기존대로 무효화, 변하지 않은 홈/대회 캐시 보존                               | 참가/취소·일정·팀명·계정 삭제·운영 변경의 기존 무효화 유지                                                   |
| HOF 목록의 소급 상태 확인          | 완료된 구단 id·커리어 가치·카드 가치 상태를 각각 3회 조회  | 키/커서 한 번 조회 후 요청 범위 안에서 전달, 완료 상태의 메타 SQL/왕복 3→1               | 미완료 페이지·진행 커서·버전·영구 저장·실패 전파 유지. 프로세스 전역 완료 플래그 없음                        |
| 공용 API 클라이언트                | 알림 읽음·기기 등록 같은 부가 저장도 전체 조회 캐시를 비움 | 알림은 `/v1/notifications`, 기기는 `/v1/push`만 무효화                                   | 실제 도메인 변경·인증/복구/로그아웃·알 수 없는 쓰기는 전체 무효화 유지. 실패 쓰기는 무효화하지 않음          |

새 조건에 맞는 인덱스는 기존 `cup_state` PK, `cup_entries`의 cup_id 선두 키, `cup_matches_cup_round_slot_unique`, `market_listings_open_card_unique`, `app_meta` PK를 활용한다. 새 정렬/필터 API나 마이그레이션을 추가하지 않는다. 다수 대회 id는 JSON 배열 한 바인딩으로 넘겨 D1 바인딩 수가 대회 수에 비례하지 않게 했다.

## 유지해야 하는 조회와 남은 측정

- **공개 읽기**: HOF·최초 기록·결번·팀/업적 랭킹·컵 홈·게시판 첫 페이지·시세 차트·밸런스·시즌 게이지·서버 상태는 기존 edge 캐시와 TTL/쓰기 무효화를 유지한다. 공개 경로의 세션 조회 금지 회귀 검증도 유지한다.
- **개인화**: 팀 프로필의 좋아요/친구/내 팀, 게시글·댓글의 차단/신고/삭제 자격, 구단주 mine, 계정/아이템/보상은 권한·세션 확인이 필요하다. 사용자 응답을 공용 캐시에 담지 않는다. 세션 조회는 이미 요청당 메모하며 프로필 삭제 여부를 JOIN으로 확인한다.
- **신선도**: 상대 추첨·컵 참가 가능 여부·프로필 갱신·댓글/상세 수동 새로고침은 원래 갱신 동작을 유지한다. 호출 지점에 캐시가 없다는 이유만으로 TTL을 추가하지 않는다. 계정별 상세의 진입 빈도/반복 요청은 운영 화면별 요청 추적으로 추가 측정할 수 있다.
- **원자성**: 출석 CAS 재시도, 라이브 경기 moment 충돌 재시도, 결제 원장·멱등성·보상 트랜잭션, 친구 코드 충돌 재시도, 백업/보관의 페이지 루프는 필수 작업이다. 루프 안 await라는 이유로 제거하거나 무제한 병렬화하지 않는다.
- **N+1 분류**: 친구/경기/댓글의 선수·이름·티어는 기존 IN/청크/집계 조회를 유지한다. 제한된 IN 청크는 D1 바인딩 상한 보호다. 관리자 일괄 소급·운영 점검 루프는 일반 사용자 목록 N+1과 구분한다.
- **클라이언트**: 같은 GET은 기존 `cachedGet`의 진행 중 요청 병합·언어별 키·실패 비캐시를 유지한다. 홈 라이브/전광판의 가시성 검사·주기 캐시, 앱 활성 상태, socket heartbeat는 실시간 기능 계약이다. 화면을 열지 않은 상태의 호출은 mount/활성 조건과 대조했으며 이 변경에서 새 polling이나 선조회를 추가하지 않는다.
- **직접 fetch 예외**: 오류 보고(keepalive·인증 제외), 동의 기록, SSR 공개 뉴스/HOF, OG 폰트, 버전 확인은 각 호스트·브라우저 정책이 있는 별도 경로다. 공용 `apiFetch`로 일괄 바꾸지 않는다.

전체 API의 운영 빈도·D1 CPU·왕복 지연·월 비용을 새로 계측한 것은 아니다. 위 값은 동일 fixture의 SQL·요청 수 감소이며 실제 평균 응답시간이나 월 청구 절감율로 변환하지 않는다. DB 연결 장애 자체가 없어지거나 불필요 쿼리가 영구히 0개라는 주장을 하지 않는다.

## 검증·롤백·배포 경계

- 새 회귀 테스트는 실제 로컬 D1에서 관리자 집계 결과/쿼리 수, 두 대회 잠금, 불필요 경기 조회 없음, 예측 캐시 hit/투표 purge를 검증한다. 소급 메타 테스트는 완료/마커 제거/재완료를 검증한다.
- 공용 클라이언트 테스트는 같은 HOF·자금 캐시를 부가 저장 전후에 읽어 요청 1회 유지를 확인하고, 변경된 namespace만 2회 읽는지 확인한다. 인증·도메인 쓰기는 기존 전체 무효화를 별도로 검증한다.
- API/app-core 타입·린트, deps/i18n, 웹 빌드·번들 예산을 확인한다. 공용 API 변경이므로 PR의 전체 웹 E2E·별도 동의 분석·API 3개 shard 등 필수 CI 판정을 따른다. 로컬 E2E를 중복 실행하지 않는다.
- 화면·문구·저장 형식·공개 응답 스키마·과금/보상 규칙은 변경하지 않는다. 앱 실기기 네트워크 확인과 운영 트래픽의 전후 수치는 미검증이다.
- 기능 추가 없는 쿼리·캐시 리팩터링과 조사 문서이므로 `release-notes: none`. 운영 배포·메인 머지는 별도 지시 전 수행하지 않는다.
- 문제가 확인되면 이 PR 코드만 되돌린다. 스키마 변경이 없어 데이터 역마이그레이션은 없고, 정책/저장 데이터/큐를 변경하지 않았다.

## 로컬 재현 결과

기준선 코드에 새 회귀 테스트만 적용했을 때 API 4개가 실패했다: 9개 대회의 상태/참가 SQL 18개, 판매 검사 2회 동안 불필요 경기 SQL 4개, 명단 검사 경기 SQL 2개, warm 예측 조회의 컵 일정 SQL 1개를 확인했다. 공용 클라이언트도 부가 저장 5종의 캐시 보존 검증이 모두 실패했다(17개 중 5개).

개선 후 해당 API 4개와 클라이언트 17개가 통과했다. 기존 컵 API·구간·운영 목록·캐시 미들웨어 포함 37개도 통과했다. 처음 구현 중 JSON subquery 괄호를 빠뜨린 SQL 오류를 로컬에서 발견해 고쳤으며, 그 수정 전 테스트 실행의 실패 결과를 통과 근거에 섞지 않았다.

웹 빌드·초기 번들 예산 검사 통과(138.71KiB gzip / 145KiB 예산), API/app-core 타입·린트·deps/i18n 통과. 이후 공개 GET의 세션 금지·승부예측·소급 상태·전체 PR CI 결과를 PR에 추가한다.

## 등록 모듈별 조사 목록

아래의 개수는 정적 등록 표현식 수이며 동적 아이템/좋아요 확장은 별도다. 전체 메서드·경로·위임 함수는 inventory JSON에 있다.

| 파일                                         | 등록 표현식 |
| -------------------------------------------- | ----------: |
| `apps/api/src/app.ts`                        |           2 |
| `apps/api/src/routes/acquisition.ts`         |           3 |
| `apps/api/src/routes/admin.ts`               |          16 |
| `apps/api/src/routes/adminCupPredictions.ts` |           3 |
| `apps/api/src/routes/adminCups.ts`           |           5 |
| `apps/api/src/routes/appAuth.ts`             |           4 |
| `apps/api/src/routes/appVersion.ts`          |           1 |
| `apps/api/src/routes/appleWebAuth.ts`        |           3 |
| `apps/api/src/routes/attendance.ts`          |           2 |
| `apps/api/src/routes/auth.ts`                |           4 |
| `apps/api/src/routes/balance.ts`             |           7 |
| `apps/api/src/routes/boards.ts`              |          15 |
| `apps/api/src/routes/careerActivity.ts`      |           1 |
| `apps/api/src/routes/careers.ts`             |           8 |
| `apps/api/src/routes/chat.ts`                |          10 |
| `apps/api/src/routes/clientErrors.ts`        |           1 |
| `apps/api/src/routes/clubCustom.ts`          |           2 |
| `apps/api/src/routes/clubStrength.ts`        |           2 |
| `apps/api/src/routes/cup.ts`                 |          14 |
| `apps/api/src/routes/cupPredictions.ts`      |           3 |
| `apps/api/src/routes/firsts.ts`              |           1 |
| `apps/api/src/routes/friends.ts`             |           6 |
| `apps/api/src/routes/hof.ts`                 |           2 |
| `apps/api/src/routes/iap.ts`                 |           4 |
| `apps/api/src/routes/live.ts`                |           1 |
| `apps/api/src/routes/managers.ts`            |           5 |
| `apps/api/src/routes/market.ts`              |          11 |
| `apps/api/src/routes/notifications.ts`       |           5 |
| `apps/api/src/routes/ownerProfile.ts`        |           5 |
| `apps/api/src/routes/ownerSummary.ts`        |           2 |
| `apps/api/src/routes/ownerTeam.ts`           |          12 |
| `apps/api/src/routes/profile.ts`             |           8 |
| `apps/api/src/routes/push.ts`                |           5 |
| `apps/api/src/routes/releaseNotes.ts`        |           1 |
| `apps/api/src/routes/reports.ts`             |           1 |
| `apps/api/src/routes/retiredNumbers.ts`      |           4 |
| `apps/api/src/routes/seasonGauge.ts`         |           1 |
| `apps/api/src/routes/seasonRecap.ts`         |           2 |
| `apps/api/src/routes/serverStatus.ts`        |           1 |
| `apps/api/src/routes/teamComments.ts`        |           2 |
| `apps/api/src/routes/teams.ts`               |           5 |
| `apps/api/src/routes/ticker.ts`              |           1 |
| `apps/api/src/routes/translate.ts`           |           1 |
