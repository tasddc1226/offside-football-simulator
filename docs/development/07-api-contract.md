# 07. API 계약

## 범위

시뮬레이션은 브라우저 엔진이 실행하므로([ADR-003](../adr/ADR-003-simulation-location.md)) 서버 API는 명령 실행이 아니라 **프로필·인증·동기화·보관·서비스 시즌**을 다룬다. 이벤트 해결, 시즌 진행, 계약 확정 같은 명령은 `packages/engine-client`의 로컬 명령 계약이며 이 문서의 끝에 요약한다.

## 공통 규칙

- Base path: `https://api.<domain>/v1`.
- 상태 변경은 `Idempotency-Key`를 요구한다. Career 동기화는 추가로 `If-Match: <careerRevision>`을 요구한다.
- 시간은 ISO 8601 UTC, 금액은 통화 코드와 정수 최소 단위로 전달한다.
- 모든 응답은 `requestId`를 포함한다.
- 목록은 안정적인 cursor pagination을 사용한다.
- 인증은 세션이다. web 채널은 쿠키, toss 채널은 `Authorization: Bearer <sessionToken>`. 미들웨어는 헤더를 먼저 보고 없으면 쿠키를 본다. `Origin` 검사와 `SameSite=Lax`로 CSRF를 막는다.
- CORS 허용 origin은 우리 도메인과 [ADR-007](../adr/ADR-007-hosting-and-infra.md)의 앱인토스 origin 4종이다. `Authorization` 헤더와 `If-Match`, `Idempotency-Key`, `Content-Type`을 `Access-Control-Allow-Headers`에 포함하고, `X-Request-Id`를 `Access-Control-Expose-Headers`에 포함한다.
- 요청 본문 상한 1MB. Snapshot은 압축 전 256KB 권장 상한.

## 응답 봉투

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "careerRevision": 12,
    "rulesetVersion": "1.0.0"
  }
}
```

오류:

```json
{
  "error": {
    "code": "CAREER_REVISION_CONFLICT",
    "message": "다른 기기에서 커리어가 먼저 진행되었습니다.",
    "retryable": false,
    "details": { "serverRevision": 13, "serverSnapshotUrl": "/v1/careers/car_1" }
  },
  "meta": { "requestId": "req_..." }
}
```

## 프로필·인증 API

| ID | Method / Path | 목적 |
|---|---|---|
| API-PRO-001 | `GET /profile` | 현재 익명 프로필, 설정, 연결 상태. 쿠키가 없으면 새 프로필을 만들어 발급 |
| API-PRO-002 | `PATCH /profile/settings` | 접근성·테마·기본 시뮬레이션 모드 저장 |
| API-PRO-003 | `POST /profile/recovery-code` | 복구 코드 발급·재발급. 원문은 응답에 한 번만 포함 |
| API-PRO-004 | `POST /profile/recover` | 복구 코드로 다른 브라우저에서 프로필 연결 |
| API-PRO-005 | `POST /profile/delete` | 프로필과 연결 데이터 삭제(2단계 확인 토큰) |
| API-AUTH-001 | `GET /auth/google/start` | Google OIDC 시작. PKCE·state 발급 후 리다이렉트 |
| API-AUTH-002 | `GET /auth/google/callback` | 콜백. 연결 또는 병합 필요 판정 |
| API-AUTH-003 | `POST /auth/merge` | 병합 선택 확정(`MOVE_TO_LINKED` 또는 `KEEP_LINKED_ONLY`) |
| API-AUTH-004 | `POST /auth/logout` | 세션 무효화. 로컬 데이터는 유지 |
| API-AUTH-005 | `POST /auth/toss/session` | 본문 `{ anonKey }`. 서버가 앱인토스 식별키 검증 API(mTLS)로 확인하고 연결된 프로필의 Bearer 세션을 발급. 처음 보는 키면 프로필을 만든다. `TOSS_KEY_INVALID`(401) |
| API-AUTH-006 | `POST /auth/google/unlink` | Google 연결 해제. `google_sub`·`email`·`linked_at`을 비운다. 204. (2026-09-02 D-21 추가) |

- 복구 코드와 로그인 시도는 rate limit과 실패 횟수 제한을 둔다.
- 병합 규칙은 [ADR-008](../adr/ADR-008-auth-and-account-merge.md)을 따른다.

## 커리어 동기화 API

| ID | Method / Path | 목적 |
|---|---|---|
| API-CAR-001 | `GET /careers` | 내 커리어 요약 목록(상태, revision, 마지막 동기화, 서비스 시즌) |
| API-CAR-002 | `GET /careers/{id}` | 최신 Snapshot과 `since` 이후 명령 로그 |
| API-CAR-003 | `PUT /careers/{id}` | Snapshot + 명령 로그 동기화. `If-Match` 불일치 시 409 |
| API-CAR-004 | `POST /careers/{id}/archive` | 은퇴 Archive 확정. 이후 PUT 거부 |
| API-CAR-005 | `DELETE /careers/{id}` | 커리어 삭제. Archive는 별도 삭제 |
| API-VER-001 | `POST /careers/{id}/verify` | 명령 로그 리플레이로 state hash 검증. 결과를 `verificationStatus`에 기록 |

`PUT /careers/{id}` 본문:

```json
{
  "baseRevision": 12,
  "snapshot": { "revision": 15, "checkpoint": "STEP_BOUNDARY", "state": "...", "stateHash": "..." },
  "commands": [
    { "revision": 13, "commandId": "cmd_...", "commandType": "RESOLVE_EVENT", "payload": {}, "resultHash": "..." }
  ],
  "createdServiceSeasonId": "svc_kickoff",
  "rulesetVersion": "1.0.0",
  "contentPackVersion": "0.1.0"
}
```

- 서버는 `baseRevision == serverRevision`이고 `commands`가 연속 revision이면 저장하고 새 revision을 돌려준다.
- 첫 동기화는 `baseRevision: 0`이며 세 버전 필드를 그대로 고정한다. 이후 PUT에서 버전 필드가 다르면 422.
- 같은 `Idempotency-Key` 재요청은 최초 응답을 돌려준다.

## 보관·Legacy API

| ID | Method / Path | 목적 |
|---|---|---|
| API-LEG-001 | `GET /archives` | 보관 선수·시즌 앨범 목록 |
| API-LEG-002 | `GET /archives/{careerId}` | Archive, LegacyResult, 최종 프로필. 백분위는 `detail` 아래에만 |
| API-LEG-003 | `GET /archives/{careerId}/timeline` | 커리어 연대기 |

Archive 본문은 클라이언트가 계산한 LegacyResult를 포함한다. 서버는 스키마와 버전만 검증하고, 검증 모드가 켜져 있으면 API-VER-001을 먼저 통과해야 보상 자격이 된다.

## 서비스 시즌 API

| ID | Method / Path | 목적 |
|---|---|---|
| API-SVC-001 | `GET /service-seasons/current` | 현재 시즌과 전환 공지 |
| API-SVC-002 | `GET /service-seasons/{id}/challenges` | 개인 도전 진행 |
| API-SVC-003 | `POST /service-seasons/{id}/rewards/{challengeId}/claim` | 보상 수령. unique key로 한 번만 |
| API-SVC-004 | `GET /service-seasons/{id}/summary` | 개인 시즌 결산 |

보상 수령은 Archive의 도전 판정 필드를 서버가 다시 계산해 확인한다. `verifyOnClaim`이 켜진 시즌은 API-VER-001 통과가 조건이다.

## 콘텐츠

콘텐츠 팩과 ruleset은 API가 아니라 정적 자산이다.

| 경로 | 내용 |
|---|---|
| `/content/manifest.json` | 활성 ruleset·content pack 버전, checksum, `clientMinVersion`, 과거 버전 URL |
| `/content/<contentPackVersion>/bundle.json` | 팩 번들, immutable 캐시 |
| `/content/rulesets/<rulesetVersion>.json` | ruleset manifest, immutable 캐시 |

## 오류 코드

| HTTP | 코드 | 처리 |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | 필드별 오류 표시 |
| 400 | `RECOVERY_CODE_INVALID` | 코드 재입력, 남은 시도 횟수 표시 |
| 401 | `TOSS_KEY_INVALID` | 식별키 재발급 후 재시도, 실패 시 "토스 앱을 업데이트해 주세요" |
| 403 | `ORIGIN_NOT_ALLOWED` | 허용되지 않은 origin. 사용자에게는 일반 오류 |
| 401 | `PROFILE_REQUIRED` | 익명 프로필 재발급 |
| 403 | `CAREER_NOT_OWNED` | 허브 이동 |
| 404 | `CAREER_NOT_FOUND` | 로컬 전용 커리어로 표시, 재동기화 제안 |
| 409 | `CAREER_REVISION_CONFLICT` | 서버 Snapshot 받아 비교, 필요 시 기기 선택 |
| 409 | `COMMAND_ALREADY_RESOLVED` | 최초 결과 표시 |
| 409 | `RECOVERY_CONFLICT` | 현재 브라우저 Career 유지/교체 선택 |
| 409 | `MERGE_REQUIRED` | 병합 선택 화면 |
| 409 | `CAREER_ARCHIVED` | 동기화 중단, 보관함으로 |
| 422 | `VERSION_MISMATCH` | 클라이언트 업데이트 또는 과거 번들 로드 |
| 422 | `VERIFICATION_FAILED` | 보상 보류, "검증되지 않은 커리어" 표시 |
| 429 | `RATE_LIMITED` | Retry-After 이후 재시도 |
| 503 | `SERVICE_UNAVAILABLE` | 동기화 재시도 큐 유지 |

## 로컬 명령 계약 (engine-client)

브라우저 엔진이 처리하는 명령이다. HTTP가 아니라 Worker 메시지지만 같은 봉투·오류 코드를 쓴다.

| ID | 명령 | 목적 |
|---|---|---|
| CMD-CAR-001 | `CREATE_CAREER` | DRAFT 생성, 세 버전 고정 |
| CMD-CAR-002 | `UPDATE_PLAYER_DRAFT` | 생성 단계 입력 저장 |
| CMD-CAR-003 | `CONFIRM_PLAYER` | 초기 선수·OVR 확정, 첫 Snapshot |
| CMD-EVT-001 | `RESOLVE_EVENT` | 선택 확정, roll 1회 소비 |
| CMD-SIM-001 | `START_SEASON` | `simulationMode` 고정, steps 생성 |
| CMD-SIM-002 | `ADVANCE` | 다음 결정 step 또는 결산까지 진행 |
| CMD-SIM-003 | `SETTLE_SEASON` | 시즌 결산 확정 |
| CMD-CON-001~004 | `NEGOTIATE`, `ACCEPT_OFFER`, `REJECT_OFFER`, `LOAN_RETURN` | 계약·이적 |
| CMD-LEG-001 | `RETIRE` | 은퇴 판정·확정, Archive 생성 |

각 명령은 `commandId`, `expectedRevision`, `payload`를 받고 확정 Snapshot과 `nextAction`을 돌려준다. 멱등성·revision·checkpoint 규칙은 [저장·버전](05-save-and-versioning.md)을 따른다.

Phase 8 WORLD STAGE는 새 서버 명령을 만들지 않는다. 해외 제안 협상·확정은 `CMD-CON-001~004`, 적응 선택은 `CMD-EVT-001`, 국제 시즌·경기는 `CMD-SIM-001~003`을 재사용한다. 확장 payload와 원자 등록 판정은 [WORLD STAGE 명세](15-world-stage-expansion.md)를 따른다.

## 계약 테스트

- `packages/contracts`의 Zod 스키마와 서버 응답의 CI 검증.
- 모든 동기화·보상 엔드포인트에 멱등성, revision 충돌, 소유권 테스트.
- 과거 ruleset fixture로 동기화·보관 호환성 테스트.
- 로컬 명령 계약은 브라우저와 Node(Vitest) 양쪽에서 같은 fixture로 실행한다.
