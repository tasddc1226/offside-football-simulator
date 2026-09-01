# 07. API 계약

## 공통 규칙

- Base path: `/api/v1`.
- 상태 변경은 `Idempotency-Key`와 `If-Match: <careerRevision>`을 요구한다.
- 시간은 ISO 8601 UTC, 금액은 통화 코드와 정수 최소 단위로 전달한다.
- 모든 응답은 `requestId`를 포함한다.
- 목록은 안정적인 cursor pagination을 사용한다.

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
    "message": "다른 화면에서 커리어가 먼저 진행되었습니다.",
    "retryable": true,
    "details": { "currentRevision": 13 }
  },
  "meta": { "requestId": "req_..." }
}
```

## 커리어 API

| ID | Method / Path | 목적 |
|---|---|---|
| API-CAR-001 | `POST /careers` | DRAFT 커리어 생성 |
| API-CAR-002 | `GET /careers` | 내 커리어 목록 |
| API-CAR-003 | `GET /careers/{id}` | 현재 Snapshot과 허용 동작 |
| API-CAR-004 | `PATCH /careers/{id}/player` | 생성 단계 선수 입력 저장 |
| API-CAR-005 | `POST /careers/{id}/confirm` | 초기 선수·OVR 확정 |
| API-CAR-006 | `POST /careers/{id}/archive` | 은퇴 커리어 보관 |

`POST /careers` 응답은 `createdServiceSeasonId`, `rulesetVersion`, `contentPackVersion`, `revision`을 반드시 포함한다.

## 진행·이벤트 API

| ID | Method / Path | 목적 |
|---|---|---|
| API-EVT-001 | `GET /careers/{id}/pending-action` | 현재 제시 이벤트/진행 단계 |
| API-EVT-002 | `POST /careers/{id}/events/{eventId}/resolve` | 선택 확정 |
| API-SIM-001 | `POST /careers/{id}/seasons` | 축구 시즌 시작 |
| API-SIM-002 | `POST /careers/{id}/advance` | 다음 체크포인트까지 진행 |
| API-SIM-003 | `GET /careers/{id}/seasons/{seasonId}` | 시즌 현황 |
| API-SIM-004 | `POST /careers/{id}/seasons/{seasonId}/settle` | 시즌 결산 확정 |

`advance`는 서버가 다음 허용 동작을 결정한다. 클라이언트가 임의 phase나 결과를 제출하지 않는다.

## 계약·이적 API

| ID | Method / Path | 목적 |
|---|---|---|
| API-CON-001 | `GET /careers/{id}/offers` | 유효 제안 조회 |
| API-CON-002 | `POST /careers/{id}/offers/{offerId}/negotiate` | 한 차례 협상 |
| API-CON-003 | `POST /careers/{id}/offers/{offerId}/accept` | 계약·이적 확정 |
| API-CON-004 | `POST /careers/{id}/offers/{offerId}/reject` | 거절 확정 |

제안 응답은 기간, 급여, 역할, 출전 약속, 바이아웃, 전술 적합도, 포지션 경쟁을 포함한다.

## 은퇴·아카이브 API

| ID | Method / Path | 목적 |
|---|---|---|
| API-LEG-001 | `POST /careers/{id}/retire` | 은퇴 판정/선택 확정 |
| API-LEG-002 | `GET /careers/{id}/legacy` | 통산 기록과 Legacy 설명 |
| API-LEG-003 | `GET /careers/{id}/timeline` | 커리어 연대기 |
| API-LEG-004 | `GET /archives` | 보관 선수·시즌 앨범 |

## 서비스 시즌 API

| ID | Method / Path | 목적 |
|---|---|---|
| API-SVC-001 | `GET /service-seasons/current` | 현재 시즌과 전환 공지 |
| API-SVC-002 | `GET /service-seasons/{id}/challenges` | 개인 도전 진행 |
| API-SVC-003 | `POST /service-seasons/{id}/rewards/{challengeId}/claim` | 보상 수령 |
| API-SVC-004 | `GET /service-seasons/{id}/summary` | 개인 시즌 결산 |

## 오류 코드

| HTTP | 코드 | 처리 |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | 필드별 오류 표시 |
| 401 | `PROFILE_REQUIRED` | 익명 프로필 복구/생성 |
| 403 | `CAREER_NOT_OWNED` | 허브 이동 |
| 404 | `CAREER_NOT_FOUND` | 빈 상태/복구 안내 |
| 409 | `CAREER_REVISION_CONFLICT` | 최신 Snapshot 다시 로드 |
| 409 | `COMMAND_ALREADY_RESOLVED` | 최초 결과 표시 |
| 422 | `COMMAND_NOT_ALLOWED` | 허용 동작 표시 |
| 429 | `RATE_LIMITED` | Retry-After 이후 재시도 |
| 503 | `SIMULATION_UNAVAILABLE` | 같은 commandId 유지 재시도 |

## 계약 테스트

- OpenAPI 스키마와 서버 응답의 CI 검증.
- 프런트 생성 타입과 API 버전 호환성 검사.
- 모든 명령에 멱등성, revision 충돌, 소유권 테스트.
- 과거 ruleset fixture로 조회·진행 호환성 테스트.

