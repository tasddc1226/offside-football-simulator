# T-11-059: OFFSIDE 핵심 지표 수집 계약과 검증

기준 main `75a3d219` (2026-10-04). 웹 수집 구현을 검토하는 PR이며 운영 배포와 네이티브 통합은 별도다.
기존 [GA4 측정 계약](ga4-measurement-plan.md)의 이벤트는 유지하고 measurement_version=3을 추가한다.

## 플레이의 실제 단위

`packages/game/src/turn.ts:playPhase`는 프리시즌 훈련 또는 전반기/후반기의 리그 경기 묶음을
동기 처리한다. 개별 경기 화면은 이미 계산된 결과를 순서대로 보여 주는 연출이다.
새 `play_complete`는 리그 경기 묶음이 실제 엔진에서 정상 반환하고 `block.n > 0`인 때만 발생한다.
화면 표시 이름은 **전반기·후반기 진행 완료**로 쓴다. 선수의 출전 수가 0이어도 리그는 진행했으므로 포함한다.
프리시즌, 커리어 생성, 이벤트 선택, 이적 결정, 화면 열기, 단순 불러오기, 서버 업로드는 제외한다.
저장에 실패해도 엔진 완료 자체는 있었으므로 플레이는 집계하되 저장 위험을 별도로 보고한다.

기존 `first_action_complete`는 프리시즌 처리, `career_resume`은 관측 행동 간 30분 경계다.
둘 다 실제 경기 진행 완료, 다른 KST 날짜, D1/D7의 대체값으로 쓰지 않는다.
기존 `first_season_complete`는 선수당 이벤트이며 `career_start`는 생성이지 첫 플레이가 아니다.

## 정의와 분모·분자

관측 워터마크 T는 **이벤트 적재까지 끝난 시각**이다. 수집 시작 F 이전과 QA는 제외한다.
플랫폼별로 별도 집계하며 현재 구현의 식별 단위는 GA4 기기/브라우저 사용자다.
동일 사용자의 여러 선수를 더해 사용자 수를 늘리지 않는다. 사람 수라고 단정하지 않는다.

| 지표 | 분모 | 분자 / 시간창 | event mapping |
|---|---|---|---|
| 주간 재방문 플레이어 | 비율이 아닌 고유 사용자 수 | [T−168시간,T) 안에 서로 다른 KST 달력 날짜 2개 이상에서 완료한 사용자. 창 전체를 수집하지 못했으면 미집계 | `play_complete`의 사용자별 distinct KST 날짜 |
| 신규 방문→첫 플레이 | 첫 방문/앱 첫 실행 후 168시간 관측이 끝난 신규 사용자 | 첫 방문 후 168시간 안에 최초 플레이한 사용자 | 웹 `first_visit`, 앱 `first_open` → `player_first_play` |
| 첫 플레이 D1/D7 | 첫 플레이 날짜+1/+7 KST 날짜가 **끝난** 신규 관측 코호트 | 해당 KST 날짜에 실제 완료가 있는 사용자 | `player_first_play` → `play_complete`, 일별 Standard cohort |
| 첫 플레이 후 7일 첫 게임내 시즌 완료 | 최초 플레이 시각+168시간≤T인 신규 관측 코호트 | 그 시각부터 168시간 안에 게임내 첫 시즌 결산을 완료한 사용자 | `player_first_play` → `player_first_season` |
| 첫 은퇴 후 7일 새 커리어 시작 | 최초 관측 신규 사용자의 첫 은퇴 시각+168시간≤T | 첫 은퇴 뒤 168시간 안에 새 커리어를 생성한 사용자 | `player_first_retire` → `player_restart` |
| 진행/저장/불러오기 실패율 | 해당 종류·경로의 `game_operation` 결과 수(=종료한 시도 수) | `outcome=failed` 수 / 전체 결과 수 | operation, operation_source, outcome, failure_class |

신규 방문→첫 플레이의 기간은 요청에 명시되지 않아 **7일 창을 준비값으로 명시**했다.
동일 세션 전환과 다르다. 기간을 바꾸면 같은 이름 아래 수치를 섞지 말고 이름과 집계 계약을 함께 바꾼다.
게임내 첫 시즌에는 고교 마지막 시즌이 포함된다. 서비스 시즌 1 또는 프로 첫 시즌을 의미하지 않는다.
사용자의 여러 커리어 중 처음 관측된 시즌 결산을 세므로 동일 선수의 완주율도 아니다.
비율 분모가 0이면 rate=null(미집계)이다. 미배포, 미관측, 미성숙 표본도 0%로 표시하지 않는다.

## 새 이벤트와 중복 억제

| 이벤트 | 발생 지점 / 규칙 |
|---|---|
| `play_complete` | 공용 game-actions.advance에서 playPhase 정상 반환. 선수별 cid/year/phase 최대 완료 경계는 로컬 분석 장부에만 보관. 같은/이전 구간 재호출·옛 백업 재진행 억제 |
| `player_first_play` | 해당 기기의 최초 관측 실제 경기 묶음. 새 생성부터 관측했고 이전 커리어/기존 분석 장부가 없을 때 cohort_origin=observed_new. 그 외 preexisting_or_unknown |
| `player_first_season` | 최초 플레이 이후 최초 시즌 결산. 여러 선수의 시즌 이벤트를 반복 성과로 세지 않음 |
| `player_first_retire` | 실제 은퇴 처리 중 해당 기기의 최초 관측 은퇴. 신규 여부를 cohort_origin으로 구분 |
| `player_restart` | 최초 관측 은퇴 뒤 첫 실제 새 커리어 생성. 단순 생성 화면 열기 제외 |
| `game_operation` | progress: playPhase 결과; save: saveGame 저장 반환; load/startup: 저장 읽기·파싱·마이그레이션 결과; load/backup: 백업 검증 실패 또는 최종 적용 결과 |

분석 장부는 게임 세이브/백업과 분리하고 최초 성과 표시는 만료시키지 않는다.
선수별 구간 경계는 최대 200개이며 이 범위를 넘은 오래된 선수의 구간은 재관측될 수 있다.
사용자 최초 milestone은 이 경우에도 유지되고 주간 사용자·날짜 집계는 중복 이벤트 수를 더하지 않는다.
웹의 새 milestone/완료 이벤트는 Web Locks로 같은 origin의 여러 탭을 직렬화한 뒤 장부를 다시 읽는다.
동일 탭도 순서를 유지한다. 구간 async 연출 중 중복 클릭은 공용 액션의 진행 중 guard로 막는다.
Web Locks 미지원/실패에서는 새 사용자 지표 수집을 생략한다. 기존 이벤트와 시도 결과는 별도다.
읽기 가능·쓰기 불가능 저장소는 메모리 경계를 유지하지만 재실행을 넘어선 중복 방지는 보장할 수 없다.
장부·쿠키 삭제, 동의 철회 후 재동의, 기기 교체에도 생애 최초를 보장할 수 없다.
태그에 넘기기 전에 표시하고 best-effort로 보내며 재전송 큐나 event_id에 의존하지 않는다.

### 실패 해석

- `progress_blocked`: playPhase가 예외로 정상 완료하지 못했다. 재개 가능 여부는 별도 확인 필요.
- `save_risk`: 쓰기 반환 false. 현재 메모리 진행이 저장되지 않을 위험이며 **데이터 손실 확정이 아니다**.
- `restore_unavailable`: 저장소 읽기/파싱/버전/마이그레이션 문제로 저장을 복원하지 못했다. 원문 저장은 보존한다.
- `invalid_backup`: 잘못된 입력/버전의 백업을 받지 않았다. 기존 세이브 손실이 아니다.
- `empty`: 저장된 현역 커리어가 없는 정상 시작. 실패율 분자에 넣지 않는다.
- `data_loss_status=unconfirmed`만 보낸다. 이용자 신고 또는 별도 증거 없이 데이터 손실 확정 수치를 만들지 않는다.

로드 경로의 startup/backup을 나눠 보며 백업 적용 후 실제 저장을 다시 읽는 startup 결과까지 합쳐
하나의 사용자 클릭 실패율로 이름 붙이지 않는다. 시도 결과에 도달하지 못한 프로세스 강제 종료/브라우저 크래시는
이벤트를 남길 수 없다. 모든 저수준 저장 키, HOF 쓰기, 화면 연출 실패를 포괄하는 크래시 모니터는 아니다.

## 동의·식별·QA·서버

동의 이전에는 태그/분석 장부/이벤트가 없고 거부를 우회하지 않는다. 동의 후 과거 플레이는 재생하지 않는다.
기존에 동의한 시작 시 저장 복원 결과만 짧은 초기화 큐로 전달하고 철회 때 큐·장부·대기 milestone을 폐기한다.
플레이·선수 ID는 로컬 중복 키에만 있고 전송하지 않는다. 이벤트에는 이름·이메일·채팅·토큰·세이브·예외 원문이 없다.
User-ID는 이번 코드에서도 보내지 않는다. 현재 정책/동의 및 기존 네이티브 PR의 범위를 유지한다.
**로그인 사용자도 현재는 기기 단위이며 다른 기기의 동일 계정과 통합되지 않는다.**
추후 User-ID를 연결한다면 로그인으로 확인된 내부 불투명 프로필 ID만 쓰고 게스트 프로필·이메일·닉네임은 쓰지 않는다.
현재 수치에 그 기능이 있는 것으로 해석하지 않는다. 서버 조회/인증 세션/계정 병합을 추가하지 않았다.

`test_marker=live|qa`는 명시적 빌드 설정이다. 테스트 측정 ID는 항상 qa,
운영 ID도 `VITE_GA4_TEST_MARKER=qa`를 명시하면 qa다. URL·선수 이름·일반인 식별로 QA를 추정하지 않는다.
표시 없는 과거 데이터는 새 지표 집계에서 제외한다. **과거 QA 기록이 소급 제외되었다는 뜻은 아니다.**
GA4 데이터 필터를 영구 제외로 활성화하거나 과거 데이터를 삭제하지 않았다.

기존 시즌·은퇴 outbox는 서버 기록 큐다. 5xx/429/네트워크는 보존·재시도, 401은 세션 재확인,
소유권 충돌/그 외 4xx는 충돌 처리·drop 경로가 있다. 플레이 성과는 엔진 완료에서만 측정하며
outbox 전송·복원·재시도에서 재발생하지 않는다. Workers/D1/폴링/분석 업로드 큐를 더하지 않았다.

## 플랫폼과 기존 PR

| 플랫폼 | 현재 main 및 PR coverage | 현재 GA4 스트림 |
|---|---|---|
| Web | 기존 동의 웹 태그 + 이번 version 3 준비 코드. 아직 배포되지 않아 신규 지표 운영 수신 미검증 | 15864666158 / G-BZPYZFDE9M, 최근48h트래픽 있음 |
| iOS | main의 analytics host는 no-op. 공용 인터페이스 준비만 됐고 SDK 수집 연결은 없음 | 15937134690, 최근48h수신없음 |
| Android | main의 analytics host는 no-op. 이번 작업에서 등록/네이티브실행하지 않음 | **16002705168**, 현재 존재, 최근48h수신없음 |

PR #411/#414는 확인 시 open/unmerged. #414는 #411을 포함하고 앱 1.1.0을 제안하지만
최신 main 앱은 1.0.2이며 최신 기록실·팀 편성·채팅·입력 기능을 포함한다.
이번 작업은 두 PR을 cherry-pick/merge하지 않고 Firebase 파일·EAS 환경·스토어 버전을 건드리지 않는다.
두 PR의 기존 tracker 공용화와 이번 별도 player-metrics/measurement 모듈은 후속 통합 시 검토해야 한다.
SDK가 연결돼도 version 3 이벤트 allowlist, consent, 장부 직렬화, QA marker를 연결·검증하기 전까지
네이티브 지표를 수집된 것으로 표시하면 안 된다. Xcode/Simulator/native analytics 실행 중단을 유지했다.

## GA4 UI와 정확 집계 경계

[공식 코호트 문서](https://support.google.com/analytics/answer/9670133?hl=en)는
특정 이벤트를 inclusion/return으로 쓸 수 있고, daily는 속성 시간대 자정~자정이라고 설명한다.
코호트는 기기 데이터 기준이고 User-ID는 고려하지 않는다. 따라서 Web Locks/로컬 장부가
유지되는 기기 단위에서는 player_first_play→play_complete의 Standard daily D1/D7을 읽을 수 있지만,
성숙 날짜를 제외하고 가중 합산할 때 분자/분모를 같이 써야 한다.

정확한 최근168시간의 서로다른2일, 첫 행동에서168시간 창, 사용자별최초·성숙분모 조합을
GA4 일반 활성/재방문 사용자 또는 이벤트 수 비율로 대체하지 않는다.
집계 보고서 CSV는 사용자별 원시 이벤트가 아니므로 distinct 날짜·정확한 경과시간을 복구할 수 없다.
완전한 이벤트 수준 자료가 있는 경우에만 `tooling/scripts/core-metrics.mjs`의 순수 오프라인 집계 함수를 쓴다.
현재 원시 자료 연결은 만들지 않았다. BigQuery 유료연결/계약/자격증명/권한확장도 없다.

원시 입력 계약: `events[]`에 timestamp_ms(밀리초), event_name, platform(web/iOS/Android),
user_pseudo_id, 허용된 user_id(있을 때만), test_marker, measurement_version, cohort_origin,
operation, operation_source, outcome, failure_class. `availableFrom`, `coveredUntil`, `platforms`를
명시하고 수집시작부터 워터마크까지 빠짐없는 자료를 제공한다. 샘플/탐색집계자료는 넣지 않는다.
출력은 집계 수치만이며 원문 ID를 반환하지 않는다. 현재 웹에는 user_id가 없어 pseudo_id만 사용한다.

## 실제 설정 기록

운영 계정 410005712 / 속성 556515567에 기존 로그인 계정으로 접근했다.
웹 향상된 측정 switch aria-checked=false, 연결된 사이트 태그 0개를 확인했다.
스트림과 수신 상태는 위 표의 실제 UI 관측값이다. 과거 문서의 Android 미등록을 현재 사실로 재사용하지 않았다.

맞춤 측정기준 전: 이벤트9/50, 사용자0/25, 상품0/10, 맞춤측정항목0/50, 계산항목0/5.
기존9: balance_version, career_origin, completed_seasons_bucket, milestone_seasons,
player_trait, position, position_changed, start_context, trait_changed.
추가6: test_marker, cohort_origin, operation, outcome, failure_class, operation_source.
설정 후 목록 **15개**를 실제 UI에서 확인했다. 기존 항목/설명/범위는 보존했다.
play_unit(현재상수), 날짜, identity_scope, 사용자/선수 ID 차원 및 새 측정항목은 만들지 않았다.

속성 보고 시간대는 `(GMT+09:00) 대한민국 시간`, 이벤트/사용자 데이터 보관은 각각 **2개월**이다.
기존 Internal Traffic 제외 필터는 **테스트** 상태다. 시간대·보관·필터를 변경하지 않았다.
기존 주요 이벤트7개: app_store_subscription_convert, app_store_subscription_renew,
career_retire, career_start, first_open, in_app_purchase, purchase. 모두 보존했다.
최근 활동12개는 career_progress_milestone, career_resume, career_retire, career_share_click,
career_share_copy_success, career_start, first_action_complete, first_season_complete,
first_visit, page_view, session_start, user_engagement이며 UI는 웹 스트림을 표시했다.
새 v3 이벤트는 목록에 없었다. 주요 이벤트 지정만으로 첫 사용자·성숙 코호트·7일 전환이
계산되지 않으므로 이번에는 새 key event를 만들지 않았다.

### 완성한 개인 수집 점검 탐색과 정확 지표의 경계

개인 탐색 `OFFSIDE v3 수집 확인 · 미배포 미집계`를 새로 생성하고 다음 설정의 적용을 실제 UI로 확인했다.
개인 탐색 링크는 공개 저장소에 싣지 않는다. 새 맞춤 측정기준은 중복 생성하지 않았다.

- 탭 이름: `v3 수집 확인 · 전반기/후반기`
- 행: 이벤트 이름, 열: 플랫폼, 값: 이벤트 수. 기간: 지난28일(자동 날짜 갱신).
- 필터: `test_marker` **다음과 정확하게 일치** `live`
- 필터: 이벤트 이름 **다음 정규 표현식과 일치함**
  `^(play_complete|player_first_play|player_first_season|player_first_retire|player_restart|game_operation)$`

UI의 합계0 및 '사용 가능한 데이터가 없습니다'는 미배포·미집계 상태다. 운영 KPI가0이라는 뜻은 아니다.
이 탐색은 수집 점검 표이며 6개 지표의 정확한 코호트 대시보드라고 주장하지 않는다.
measurement_version은 별도 차원으로 만들지 않았으므로 이후 같은 이벤트명이 다른 계약으로 재사용되면
이 표만으로 버전을 구분할 수 없다. 정확 원시 집계는 version=3까지 제한한다.

**개인 탐색으로 유지했다.** 속성 전체 사용자 공유나 계정 권한 확장은 하지 않았다.
해당 개인 탐색에 접근 가능한 계정에서만 볼 수 있으며 공유 보고서라고 표시하지 않는다.

D1/D7은 **미설정**이다. 새 동질 집단 탭의 포함 기준에 `player_first_play`를 입력했을 때
실제 UI가 '검색결과 없음'을 반환했고 Enter/Tab 뒤에도 '첫 번째 터치(획득일)'로 돌아갔다.
미수신 이벤트를 이 입력창에 자유 문자열로 지정할 수 있다고 가정하지 않는다.
기본 방문→이벤트 코호트는 실제 플레이 유지율이 아니므로 방금 만든 기본 탭을 제거했다.
일반 코호트·career_resume·활성 사용자를 대체 지표로 공유하지 않았다.

수집 후 D1/D7 후보 구성은 inclusion=player_first_play, return=play_complete,
granularity=daily, calculation=standard, 신규 observed_new·live·각 플랫폼 제한이다.
해당 필터/이벤트 선택을 실제 UI로 검증해야 한다. D1은첫날+1 KST날짜가끝난 행,
D7은+7날짜가끝난 행만 분모·분자를 추출한다. GA4 코호트는 기기 기준이다.
최근168시간 distinct2일과 정확한168시간 성숙 전환은 위 구성으로도 완성됐다고 취급하지 않는다.

### 배포 승인 후 확인할 항목

1. 코드 검토·검사 완료와 별도 배포 승인을 받은 뒤 수집시작 F와 첫 수신 시각을 기록한다.
   이 작업은 배포 권한이 아니다. 운영 QA 선수 생성·이벤트 주입으로 수신을 만들지 않는다.
2. 자연 발생 운영 트래픽을 읽어 새6개 이벤트, web 플랫폼, version3, live marker,
   observed_new/unknown 구분을 확인한다. 자동 first_visit에도 version/marker가 전달되는지 확인한다.
   로컬 스텁 테스트는 GA4 서버의 실제 자동 이벤트 수신을 검증한 것이 아니다.
3. 진행 이벤트가 프리시즌/단순 복원에서 나오지 않고 실제 league_half 완료에서 나오는지,
   game_operation의 operation/source/outcome/failure_class 값이 계약대로 수신되는지 확인한다.
   실패 점검 표가 필요하면 game_operation으로 제한하고 operation·operation_source·outcome·failure_class별
   이벤트 수를 비교한다. 실패율은 같은 플랫폼/종류/경로의 실패 수÷전체 결과 수이며 데이터 손실 확정으로 이름 붙이지 않는다.
4. 신규 이벤트가 코호트 선택 목록에 나타난 뒤 위 D1/D7을 구성하고 KST 및 종료된 날짜만 검증한다.
   UI가 live/observed_new/플랫폼 제한을 표현하지 못하면 정확한 원시 집계 필요로 남긴다.
5. 정확한 원시 자료 확보는 별도 결정 사항이다. 집계 CSV를 원시 이벤트로 취급하지 않는다.
   워터마크 T와 F, 완전한 수집 coverage 및 성숙 분모를 확인하고 오프라인 집계 함수를 사용한다.
6. iOS/Android는 SDK·동의·v3 매핑·직렬화·명시적 QA marker가 연결되기 전까지 미수집으로 유지한다.
   기존 네이티브 실행 중단은 별도 재개 승인 없이 해제하지 않는다.

## 검증과 남은 경계

고정 lockfile로 설치한 Node 22 환경에서 최신 main에 적용한 최종 변경을 검증했다.
전체 lint·의존성·format·7개 패키지 typecheck, 웹/API build, 마이그레이션 무변경 검사,
공개 저장소 위생 검사를 통과했다. Svelte 오류 0·기존 경고 1이며 웹 초기 gzip은 122.21KB(예산 138KB)다.

- app-core 전체 301/301, game 전체 199/199, web 57/57, contracts 99/99, tooling 34/34 통과.
- CI 스크립트 테스트 14/14 통과.
- 로컬 분석 E2E 10/10 통과: 동의/거부/탭 간 철회, 이름·URL 비노출, 자연 진행,
  최초 플레이/시즌 1회, 새로고침 중복 억제, QA marker, 두 탭의 동일 구간 완료와 연속 클릭 중복 억제.
- GA 태그와 API를 스텁한 QA 빌드만 사용했다. 운영 게임/스트림에 테스트 이벤트를 보내지 않았다.

전체 병렬 단위 검사에서는 기존 upload 시뮬레이션 하나가 5초 제한에 걸렸다.
app-core와 game을 각각 최대 2 worker로 재실행해 전체 통과했다. API 전체는 354 통과·69 실패이며
로컬 workerd의 `listen EADDRNOTAVAIL: address not available 127.0.0.1`, `fetch failed`,
D1 쿼리/초기화 실패와 시간 초과를 관측했다. API 코드는 변경하지 않았고 네트워크/보안 설정도 바꾸지 않았다.
이 로컬 결과를 전체 체인 성공으로 표시하지 않는다. 원격 PR CI 결과는 PR에서 별도로 확인한다.

여러 선수·새로고침·옛 백업·저장 쓰기 실패·태그 실패·outbox 재시도 경계를 단위 테스트로 확인한다.
Web Locks와 진행 중 guard는 여러 탭과 연타의 중복 성과를 억제한다.
저장소 삭제/쓰기를 차단한 뒤 브라우저 재실행, 200개 경계를 넘은 오래된 커리어와 기기 이동은
생애 최초와 구간 중복 방지를 보장하지 않는다. 수집은 best-effort이며 전송 성공을 보장하지 않는다.

운영 이벤트 수신, 성숙 D1/D7/7일 코호트 수치, 네이티브 실행·SDK 연결은 미검증이다.
정확 집계용 원시 자료 연결도 없다. 수집 동의자와 기기 식별의 편향을 포함하며 전체 이용자 또는
로그인 사람 수로 일반화하지 않는다. 후속 단계는 코드 검토, 별도 네이티브 통합,
별도 승인한 배포, 자연 발생 이벤트의 읽기 확인과 관측 기간 완료 후 지표 확인이다.
