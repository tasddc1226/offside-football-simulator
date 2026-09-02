# Phase 0. 기술 기반과 데이터 계약

## 목표

게임 기능을 빠르게 붙이기 전에 결정론, 저장 안전성, 버전 경계를 실행 가능한 골격으로 만든다.

## 산출 플레이 상태

개발자는 익명 프로필을 만들고 빈 커리어를 생성·조회·삭제하며, 고정 fixture 시뮬레이션 결과를 DB에 저장하고 다시 읽을 수 있다.

## 시작 조건

[종이 프로토타입](../content/prototype/season-01-inside-forward.md)을 3회 이상 플레이하고 결과를 기록했다. 시즌당 결정 수와 소요 시간이 [시간 모델](../development/11-time-model-and-pacing.md)의 예산 안에 들어오거나, 예산을 수정한 근거가 있다.

## 포함 범위

- ADR-001~008은 [`docs/adr/`](../adr/README.md)에서 확정됐다. Phase 0은 그 결정을 실행한다. 도메인 가용성(ADR-006)과 Cloudflare·Google 계정 준비는 사용자 액션이다.
- 시각 디자인 토큰 파일과 폰트 로딩, 대비 자동 검사의 골격.
- `apps/web`, `apps/api`, `packages/domain`, `engine-client`, `content`, `contracts`, `ui`, `fixtures` 골격과 의존 방향 lint.
- D1 스키마: LocalProfile, Career, Snapshot, CommandLog, Idempotency, ServiceSeason. Drizzle migration.
- IndexedDB(Dexie) 스키마: Career 상태, Snapshot, CommandLog, Draft, 설정.
- 익명 프로필 쿠키와 `GET /profile`, health/readiness endpoint.
- Career 동기화 `PUT /careers/{id}`와 If-Match 409.
- ruleset/content pack loader와 checksum, 프로토타입 이벤트 10개의 팩 0.1.0.
- CI: lint, typecheck, unit·property, content validate, contract, migration. Pages·Workers preview 배포.
- requestId, 구조화 로그, 오류 봉투.

## 구현 순서

1. 저장소 패키지·의존 방향을 고정한다.
2. 순수 `simulate(input)` fixture와 state hash를 만든다.
3. 익명 프로필과 Career create/get 명령을 연결한다.
4. commandId 멱등성과 revision 충돌을 구현한다.
5. schema/ruleset/content pack 버전을 Snapshot에 기록한다.
6. preview/staging 배포와 migration test를 연결한다.

## API·데이터

- API-CAR-001~003의 빈 Career 변형.
- DATA-CAR-001, DATA-SVC-001, CareerSnapshot.
- 오류: `VALIDATION_FAILED`, `CAREER_NOT_OWNED`, `CAREER_REVISION_CONFLICT`.

## 완료 조건

- [ ] 같은 fixture 1,000회 실행의 state hash가 브라우저·Node·Workers에서 동일하다.
- [ ] 같은 commandId 100회 병렬 요청에도 로컬 Career와 서버 동기화 결과가 하나다.
- [ ] 잘못된 revision 동기화가 409로 거부된다.
- [ ] preview와 staging 배포 파이프라인이 PR과 main에서 자동으로 돈다.
- [ ] 최소 한 세대 이전 schema fixture를 migration 후 읽는다.
- [ ] production과 동일한 순서로 staging migration을 실행한다.
- [ ] 로그에 프로필 키·쿠키·선수명 원문이 남지 않는다.

## 제외

선수 생성 UI, 실제 OVR, 축구 시즌, 이벤트 콘텐츠, 로그인, 운영 CMS.

