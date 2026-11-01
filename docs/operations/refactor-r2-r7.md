# R2–R7 리팩터링 검증 기록

기준 메인: `42f4f7a53b96ad4c198fb3a81fce387de5af5a31`.

## 고정 범위

- R2: 매출 재현 fixture. R3: SQL 읽기 어댑터와 순수 응답 조립 분리.
- R4: requireOwner만 공통 모듈로 추출. R5: 팀 저장 유스케이스 분리.
- R6: 순수 대회 리포트 변환만 분리. R7: 결산 실패 주입·재개 검증.
- 결산 단계 모듈 분리는 R7 이후 별도 PR이다. 이번에는 진행하지 않는다.
- 제품 가격·지표 정의·게임 규칙·세이브·DB 스키마·CI 범위·번들 예산을 유지한다.
- R7에서 발견한 같은 시각 재시도의 중복 지급만 실패 재현과 별도 수정으로 다룬다.

## 전후 비교 기준

| 대상        | 이전                                            | 이후                                                            | 검증                                                                      |
| ----------- | ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 매출        | SQL·광고 제거 fold·응답 변환이 한 함수          | revenueRead의 SQL, revenueView의 순수 조립, revenue의 기간 조율 | 분리 전 작성한 전체 응답·SQL 해시 스냅샷 유지, 10 statement/1 batch       |
| 구단주 권한 | 다른 14개 라우트가 ownerTeam 라우트에서 import  | middleware/requireOwner에서 import                              | Google/Apple 허용, 익명/삭제/미존재/무세션 거절, 오류 문구·코드와 조회 수 |
| 팀 저장     | HTTP 처리·검증·쓰기·캐시·응답을 라우트에서 조율 | saveOwnerTeam이 검증·쓰기, 라우트가 인증·입력·캐시·응답 담당    | 기존 구단·감독·컵 테스트, 저장 후 purge/업적 예약/응답 순서 보존          |
| 게임 리포트 | game-actions 내부에 순수 대회 변환 세 함수      | game-report 모듈                                                | 분리 전 스냅샷, 입력 불변/RNG 비소비, 상태 해시·호출 순서·중복 입력 guard |
| 시즌 결산   | 정상 완료·일부 재개 테스트                      | 7단계의 쓰기 전후·커서 저장 전후 실패와 실제 D1 batch 롤백 검사 | 무중단 결과와 전체 기록·보상·메타 대조 및 완료 후 재실행                  |

## 매출의 기존 의미와 한계

정산액이 아닌 정가 추정이다. total/allTime/daily.krw는 광고 제거를 제외하고 상세 목록에는 포함한다.
아이템·패스는 구매 원장을 사용하며 해당 스토어 알림은 중복 합산하지 않는다.
멤버십은 purchase/renewal/refund 알림을 사용하고 구매자 정보가 없어 buyers에 추가되지 않는다.
테스트 원장·알림은 제외한다. 미등록 상품은 건수에 포함되지만 가격은 0이다.
기간 밖 구매 후 기간 안 환불은 환불 지표에 포함되지만 기간 상품 목록에는 없을 수 있다.
아이템·패스 환불은 원래 구매일의 매출을 0으로 만든다. 멤버십·광고 제거 환불은 알림일 음수다.
광고 제거 환불은 원구매 가격이 아닌 환불 알림 시각의 정가다. 알림 기록 이전 판매는 복원하지 않는다.
최근 30건은 조회 기간과 무관한 전체 기간이며 동일 createdAt의 순서는 미정이다.
fixture는 모든 행을 비교하되 동률 행의 순서를 새 계약으로 만들지 않는다.
KPI는 기간과 지표 의미가 다르므로 SQL을 합치지 않는다.

## R7 실패 재현과 수정

`division: after-write`는 보상 batch 완료 직후 예외를 주입한다.
기존 구현은 같은 NOW로 재개할 때 granted_at이 같은 휘장을 다시 읽어 6장을 12장으로 지급했다.
수정은 같은 2-statement batch 안에서 휘장 없는 구단주에게 먼저 지급하고 휘장을 넣는다.
휘장 유무로 중복을 차단하고 두 쓰기는 함께 롤백된다([D1 batch 계약](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)). 지급량·자격·메타 키는 그대로다.
실패 주입은 테스트용 D1 경계에서 수행하며 운영 코드에 테스트 hook을 추가하지 않는다.

## 번역 기준선 이동

기존 한국어 18개 덩어리만 파일 이동에 맞춰 재배치한다(ownerTeam에서 13개, game-actions에서 5개).
총 허용량과 다른 파일의 기준선은 변하지 않는다. 문구·번역·저장 식별자는 변경하지 않는다.
새 파일에 대한 광범위한 검사 제외나 CI 범위 축소는 추가하지 않는다.

## 재현 명령

```sh
pnpm --filter @offside/api exec vitest run src/db/repos/revenue.test.ts src/routes/admin.test.ts
pnpm --filter @offside/api exec vitest run src/middleware/requireOwner.test.ts src/routes/ownerTeam.test.ts src/routes/managers.test.ts src/routes/cup.test.ts --maxWorkers=2
pnpm --filter @offside/app-core exec vitest run src/game-report.test.ts src/game-mid-guide.test.ts src/keyMomentPref.test.ts src/early-renewal.test.ts
pnpm --filter @offside/api exec vitest run src/team/seasonCloseRecovery.test.ts src/team/seasonClose.test.ts --maxWorkers=2
```

검증 결과와 CI 링크는 PR 및 최종 비교 보고서에 기록한다. 로컬 D1·Hermes 런타임 검사는 운영 데이터와 실기기 검증을 대신하지 않는다.

## 로컬 검증 결과

- 매출: 분리 전후 16개 통과. 신규 fixture 4개 전체 응답·SQL 해시 변경 0, 10 statement/1 batch 유지.
- 공통 권한 6개, 구단 경로 분리 전후 각각 59개, 감독·컵 27개 통과.
- 권한 소비 경로와 매출·구단·결제 회귀: 16파일/217개 통과.
- 결산: 7단계 × 4개 실패 지점 + 2개 실제 batch 롤백, 기존 5개 포함 35개 통과.
- 같은 시각 재시도에 신규 자격 팀이 섞이는 동시 실행도 기존 지급은 보존하고 신규 보상만 1회 지급.
- 앱 코어 전체 138파일/1,343개 통과. 게임 55파일/573개 통과, 기존 2개 skip 유지, golden 갱신 없음.
- 전체 lint/typecheck와 dependency/i18n/format 검사 통과. 웹 기본 설정 번들 146.80KB, 운영 설정·CI 7자리 버전 번들 146.97KB/147KB 통과.
- iOS·Android 전체 Expo export가 Hermes 바이트코드로 성공했다.
- iOS/Android Expo Babel 변환 후 Hermes 런타임의 새 리포트 변환·옛 저장 필드 누락 probe 통과.
- 초기 직접 Vite 번들 probe는 Babel 변환 없는 반복문 closure 때문에 기존 사전 getter 실행이 실패했다. 앱과 같은 Expo Babel 설정을 거친 두 플랫폼 probe로 보정했다. 이 때문에 제품 코드를 바꾸지 않았다.
- 초기 테스트 fixture의 잘못된 설정/Best XI 열, D1 대량 bind 한도, 업적 재계산이 필요 없는 fixture는 수정했다. 제품 실패와 구분한다.

운영 데이터·실기기 화면/OTA 적용·운영 성능은 이번 로컬 검증 범위 밖이다. 운영 배포는 수행하지 않는다.

최초 PR CI의 운영 설정 번들은 147.00KB로 반올림되지만 바이트 기준 한도를 초과했다.
새 리포트 모듈의 import를 기존 national/clubs 의존 위치·순서에 맞춰 첫 화면 청크 순서를 보존했고,
순수 변환 함수 본문은 그대로 유지했다. 같은 운영 설정과 CI 7자리 버전 재검증은 146.97KB다.
예산·검사 대상·지연 로딩 경계는 바꾸지 않았다.
