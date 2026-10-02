# 코드 퀄리티 정리 계획 (T-11-044, 2026-10-02)

2026-10-02 다섯 영역(안 쓰는 코드, 웹·앱 중복 로직, API 구조, 게임·app-core 복잡도, 큰 UI 컴포넌트·테스트)을
점검한 결과와 진행 상황. 원칙은 **동작을 바꾸지 않는 정리**다. 동작이 바뀌는 건 웹·앱이 이미 서로 다르게
동작하던 곳(drift)을 한쪽으로 맞출 때뿐이고, 그때는 커밋 메시지에 적는다.

## 출발점

- TS strict + `noUncheckedIndexedAccess`·`exactOptionalPropertyTypes`, `as any`·`@ts-ignore` 0건,
  eslint-disable 1건. 린트 소음은 없다. 문제는 구조(중복·큰 파일·테스트 공백)다.
- 테스트: api 46, game 31, app-core 26, contracts 9, web 11(+e2e). **모바일은 테스트 러너가 없다**.
- game의 보호망은 골든(고정 시드 32커리어) 하나뿐이라 도달하지 않는 분기(병역·국제대회·일부 이벤트)는 못 잡는다.

## 진행

| # | 묶음 | 상태 |
|---|---|---|
| 1 | 안 쓰는 코드·의존성 제거(영구결번 오픈 게이트, 토스 스키마, 죽은 repo 함수, Placeholder, 죽은 스크립트, devDeps 3개) | 완료 |
| 2 | 회원 판정 공용화 `app-core/account` — 웹이 애플 전용 계정을 게스트로 보던 drift 수정 | 완료 |
| 3 | 로그인 안내 문구 공용화 `app-core/loginText` — session 안내 drift 수정 | 완료 |
| 4 | API 공통 헬퍼: 속도 제한 `enforceLimit`, 오류 팩토리(`conflictError`·`rateLimited`), KST 시간 `time.ts`, 작은 우회(`auditLogStatement`, `clientIp`). 관리자 통계는 원본 D1이 필요해 `c.env.DB` 그대로 | 완료 |
| 5 | 공개 GET 12곳(+게시판별 목록)이 쿠키가 있어도 세션을 읽지 않고 쿠키를 내리지 않는지 표 기반 테스트 `routes/publicReads.test.ts` | 완료 |
| 6 | game 특성화 테스트 `characterize.test.ts`: 커리어 10개의 중간 상태 528개 + 변형(대표팀·병역 마감)에서 `simBlock`·`natWindow`·`rollEvent`·`endSeason`(seasonAwards·natSeasonEnd·milSeasonEnd)·시장 선택(병역 7종)·이벤트×선택지 `p` 격자(58개 중 53개 도달) 해시 고정 | 완료 |
| 7 | 웹·앱 중복 순수 로직 → app-core(+테스트 34개): 홈 라이브 피드 `homeLive`, 팀 라이브 재생 계획 `teamLive.playbackPlan`, 영구결번 벽 `retiredWall`, 국적 검색 `nationSearch`, 공유 링크 `shareLink`, 체격 보정 `create-view.bodyNote`. 동작 차이 없음 | 완료 |
| 8 | app-core 미테스트 핵심 특성화 테스트 88개: `teamOwner`(라인업 배치·후보 정렬·힌트), `navHistory`, `legendReport`, `news` | 완료 |
| 9 | game 큰 함수 분리: `simBlock`(출전·결과·평점·하이라이트·부상·구간 뒤), `endSeason`(클럽 월드컵·시즌 기록·한 해 넘기기), `market`(병역·고교·대학·프로 선반), `runTournament`(대진·병역 특례·명성 표), 가중 룰렛 3곳 → `rng.weightedIndex`. 골든·특성화 해시 그대로 | 완료 |
| 10 | 웹 `Team.svelte`(1135줄)를 앱처럼 하위 컴포넌트로 분리 | 예정 |

## 보류(결정 필요·범위 큼)

- 토스 잔재 컬럼 `toss_anon_key_hash`와 응답 `linked.toss` 제거 — 마이그레이션과 계약 변경이 필요하다.
- 운영 wrangler 변수 `WEB_APP_URL`·`GOOGLE_REDIRECT_URI`는 운영에서 안 읽히지만 배포 점검을 확인한 뒤 지운다.
- `hof`·`firsts`·`retired-numbers` 공개 경로에 남은 일회성 백필 확인 — 운영 `app_meta` 완료 표시를 읽기 전용으로 확인한 뒤 지운다.
- 팀 프로필·게시글 상세의 엣지 캐시(공용 부분/개인 부분 분리) — 웹·앱 계약 변경이라 별도 작업.
- 관리자 라우트 `adminOnly` 미들웨어, `ok()` 기본 Cache-Control `private, no-store` — 응답 헤더가 바뀌어 별도 검토.
- 모바일 테스트 러너(vitest node 환경) 도입 여부, `testID` 449개를 Maestro로 쓸지 지울지.
- 모바일 `ui/` 정리(`Seg`·`Field` 4중복, 글자 크기·그림자·애니메이션 래퍼).
