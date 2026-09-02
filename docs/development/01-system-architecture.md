# 01. 시스템 아키텍처

## 설계 목표

- 비로그인 사용자도 즉시 플레이한다.
- 커리어 결과는 재현 가능하고 중복 명령에 안전하다.
- 화면·API와 게임 규칙을 분리해 밸런스 변경이 UI를 깨지 않게 한다.
- 서비스 시즌이 바뀌어도 과거 커리어를 읽고 재생한다.

## 논리 구성

```text
Web Client
  ├─ Screen State / Accessibility
  ├─ Query Cache / Draft State
  └─ Command Client
          │ HTTPS
Application API
  ├─ Career Command Service
  ├─ Career Query Service
  ├─ Idempotency / Authorization
  └─ Transaction Boundary
          │
Domain Core
  ├─ Player & OVR Rules
  ├─ Season Simulator
  ├─ Event Resolver / EffectQueue
  ├─ Contract & Transfer
  └─ Retirement & Legacy
          │
Persistence / Content
  ├─ Relational DB
  ├─ Snapshot & Event Log
  ├─ Ruleset Manifest
  └─ Versioned Content Packs
```

## 패키지 경계

| 패키지 | 책임 | 금지 |
|---|---|---|
| `web` | 라우팅, 화면 상태, 접근성 | OVR·확률 계산 |
| `application` | 명령 오케스트레이션, 트랜잭션 | UI 문자열 조립 |
| `domain` | 순수 규칙과 상태 전이 | DB·HTTP 직접 접근 |
| `persistence` | 저장 구현, 마이그레이션 | 게임 규칙 판단 |
| `content` | 이벤트·문구·룰셋 정본 | 실행 중 임의 변형 |
| `observability` | 로그·지표·추적 | 개인정보 원문 저장 |

## 명령 처리 계약

1. 클라이언트가 `commandId`를 생성한다.
2. API가 소유권, 현재 커리어 버전, 명령 가능 상태를 검증한다.
3. Application이 고정된 ruleset/content pack과 seed를 읽는다.
4. Domain이 새 상태와 도메인 이벤트를 순수 계산한다.
5. 상태, 이벤트, Snapshot, idempotency 결과를 한 트랜잭션으로 저장한다.
6. 응답은 확정 Snapshot과 다음 허용 동작을 반환한다.

같은 `commandId` 재요청은 저장된 최초 응답을 반환해야 한다. 충돌한 `expectedRevision`은 `409 CAREER_REVISION_CONFLICT`로 처리한다.

## 비로그인 식별

- 최초 방문 시 무작위 `localProfileId`를 생성하고 보안 쿠키와 로컬 복구 키를 사용한다.
- 서버 저장을 사용한다면 쿠키는 `HttpOnly`, `Secure`, `SameSite=Lax`를 기본으로 한다.
- 로그인 기능이 추가되면 익명 프로필을 계정으로 병합하되 커리어 ID는 유지한다.
- **복구 코드는 Phase 1 필수다.** 첫 커리어 확정(SCR-004) 직후 사람이 옮겨 적을 수 있는 복구 코드를 발급하고, 설정(SCR-030)에서 다시 보기·재발급·복구를 제공한다. 긴 커리어가 쿠키 삭제로 사라지는 것은 이 제품 최악의 이탈 사유이므로 로그인보다 먼저 둔다.
- 복구 코드는 서버에 해시로만 저장하고 로그에 남기지 않는다. 재발급은 이전 코드를 무효화한다.
- 데이터 내보내기/가져오기 파일과 로그인 병합은 Phase 7에서 결정한다.

## 일관성 경계

- **강한 일관성**: 커리어 명령, 계약 확정, 시즌 결산, 은퇴, 시즌 보상 수령.
- **최종 일관성 허용**: 분석 이벤트, 비핵심 통계, 운영 대시보드.
- 캐시는 정본이 아니며 커리어 `revision`이 다르면 폐기한다.

## 보안과 개인정보

- 선수 이름은 사용자 입력이므로 출력 시 이스케이프한다.
- 자유 입력은 최소화하고 길이·문자 범위를 검증한다.
- 콘텐츠 관리 기능은 플레이 API와 권한을 분리한다.
- 로그에 쿠키, 복구 키, 전체 사용자 입력을 기록하지 않는다.
- 모든 상태 변경 엔드포인트에 요청 크기 제한과 rate limit을 둔다.

## 성능 예산

| 항목 | 목표 |
|---|---:|
| 초기 화면 LCP(중간급 모바일) | p75 2.5초 이하 |
| 일반 조회 API | p95 300ms 이하 |
| 이벤트 해결 명령 | p95 500ms 이하 |
| 시즌 결산 | p95 2초 이하 |
| 커리어 Snapshot | 압축 전 256KB 권장 상한 |

시즌 계산이 예산을 넘으면 UI는 진행 상태를 표시하되 결과 확정 명령은 한 번만 실행한다.

## 실패 복구

- 커밋 전 오류: 기존 상태 유지, 같은 명령 재시도 가능.
- 커밋 후 응답 유실: 같은 `commandId`로 결과 복구.
- 잘못된 콘텐츠 배포: 새 커리어 생성 중단 후 이전 content pack 재활성화.
- 데이터 마이그레이션 오류: 신규 쓰기 차단, 기존 Snapshot 읽기 유지, roll-forward 우선.

