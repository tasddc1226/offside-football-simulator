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

## 프로필 API

| ID | Method / Path | 목적 |
|---|---|---|
| API-PRO-001 | `GET /profile` | 현재 익명 프로필과 설정 |
| API-PRO-002 | `PATCH /profile/settings` | 접근성·테마·기본 시뮬레이션 모드 저장 |
| API-PRO-003 | `POST /profile/recovery-code` | 복구 코드 발급·재발급. 원문은 응답에 한 번만 포함 |
| API-PRO-004 | `POST /profile/recover` | 복구 코드로 다른 브라우저에서 프로필 연결 |
| API-PRO-005 | `POST /profile/delete` | 프로필과 연결 데이터 삭제(2단계 확인 토큰) |

- 복구 코드 입력은 rate limit과 실패 횟수 제한을 둔다.
- `recover` 성공 시 현재 브라우저의 빈 프로필은 폐기하고 복구된 프로필로 교체한다. 현재 브라우저에 진행 중 Career가 있으면 병합하지 않고 선택을 요구한다.

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

- API-SIM-001 요청은 `simulationMode`(`FAST` | `CHAPTER`)를 포함한다. 생략 시 프로필 기본값을 쓴다.
- API-SIM-002 `advance`는 서버가 다음 결정이 있는 step 또는 결산까지 진행하고, 응답에 `currentStep`, 통과한 step 요약, `nextAction`을 담는다. 클라이언트가 임의 phase, step, 결과를 제출하지 않는다.
- 핵심 경기 챕터의 판단은 별도 API 없이 API-EVT-002로 확정한다. 챕터는 `pending-action`에 `kind: CHAPTER`로 나타난다.
- API-LEG-002 응답은 [Legacy·엔딩](14-legacy-score-and-endings.md)의 `DATA-LEG-001` 구조를 따르며 백분위는 `detail` 아래에만 둔다.

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
| 400 | `RECOVERY_CODE_INVALID` | 코드 재입력, 남은 시도 횟수 표시 |
| 409 | `RECOVERY_CONFLICT` | 현재 브라우저 Career 유지/교체 선택 |
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

