# 01. 시스템 아키텍처

## 설계 목표

- 비로그인 사용자도 즉시 플레이하고 오프라인에서도 진행한다.
- 커리어 결과는 재현 가능하고 중복 명령에 안전하다.
- 화면·API와 게임 규칙을 분리해 밸런스 변경이 UI를 깨지 않게 한다.
- 서비스 시즌이 바뀌어도 과거 커리어를 읽고 재생한다.
- 서버는 프로필·로그인·동기화·보관·시즌만 다루며 규모를 작게 유지한다.

실행 위치와 저장소 결정은 [ADR-002](../adr/ADR-002-persistence-and-identity.md), [ADR-003](../adr/ADR-003-simulation-location.md)을 따른다. 이 문서의 이전 판이 권장한 서버 권위 시뮬레이션은 폐기됐다.

## 논리 구성

```text
Browser  |  Toss App WebView (앱인토스 미니앱, 같은 SPA 번들)
  ├─ Web App (React SPA)
  │    ├─ Screen State / Accessibility
  │    ├─ Draft State / Query Cache
  │    ├─ Platform Adapter (web | toss: 식별·저장·SafeArea·공유·분석)
  │    └─ Sync Client
  ├─ Engine Worker (Web Worker)
  │    ├─ Command Handler / Idempotency / Revision
  │    ├─ Domain Core (순수 규칙)
  │    └─ Content Pack + Ruleset (버전 고정)
  └─ Local Store (web: IndexedDB | toss: 네이티브 Storage)
       ├─ Career State / Snapshots / Command Log
       └─ Profile Settings / Draft
          │ HTTPS (checkpoint 동기화, 조회). toss 채널은 Bearer 세션 + CORS
Cloudflare Workers API (Hono)
  ├─ Profile / Auth / Recovery / Merge
  ├─ Career Sync (Snapshot + Command Log, If-Match)
  ├─ Archive / Legacy / Service Season / Rewards
  ├─ Replay Verifier (Domain Core 재사용, 필요 시)
  ├─ Toss Partner Client (mTLS 바인딩: 식별키 검증)
  └─ D1 (정본 저장) · R2 (아카이브) · KV (rate limit)
Static (Cloudflare Workers Static Assets)
  └─ Web App 번들, Content Pack 번들, Ruleset Manifest
```

## 패키지 경계

정본은 [ADR-005](../adr/ADR-005-monorepo-boundaries.md)다.

| 패키지 | 책임 | 금지 |
|---|---|---|
| `apps/web` | 라우팅, 화면 상태, 접근성, 동기화 호출. web·toss 두 번들 | OVR·확률 계산, 채널 직접 분기 |
| `packages/platform` | 채널 어댑터(web·toss): 식별키, 로컬 저장 구현, SafeArea, 공유, 리더보드, 분석 | 게임 규칙, 화면 문자열 |
| `packages/engine-client` | 명령 처리, revision, 로컬 저장, Worker 실행 | UI 문자열 조립 |
| `packages/domain` | 순수 규칙과 상태 전이 | 외부 import, Node·브라우저 API |
| `apps/api` | 프로필·인증·동기화·보관·시즌, 리플레이 검증 | 플레이 경로 시뮬레이션 |
| `packages/content` | 이벤트·문구·룰셋 정본과 검증 | 실행 중 임의 변형 |
| `packages/contracts` | API·Snapshot 스키마 | 규칙 판단 |
| `packages/ui` | 토큰·공통 컴포넌트 | 규칙 계산 |

## 명령 처리 계약

명령은 브라우저의 엔진 워커가 처리한다.

1. 웹 앱이 `commandId`를 생성해 엔진 워커에 보낸다.
2. 엔진이 현재 Career revision, 명령 가능 상태, 고정된 ruleset/content pack을 확인한다.
3. Domain이 새 상태와 도메인 이벤트를 순수 계산한다. seed와 난수 소비는 Snapshot의 `rngState`에서 이어진다.
4. 엔진이 상태, 이벤트, Snapshot, 명령 로그 항목, idempotency 결과를 IndexedDB 트랜잭션 하나로 저장하고 revision을 1 올린다.
5. 응답은 확정 Snapshot과 다음 허용 동작이다. 같은 `commandId` 재요청은 저장된 최초 응답을 돌려준다.
6. checkpoint에 해당하면 동기화 클라이언트가 Snapshot과 명령 로그를 서버에 `PUT`한다. 실패해도 플레이는 계속되고 재시도 큐에 남는다.

서버 동기화 충돌은 `409 CAREER_REVISION_CONFLICT`로 처리하며 규칙은 ADR-002를 따른다. 서버는 명령을 실행하지 않고, 필요할 때만 명령 로그를 재생해 state hash를 검증한다.

## 비로그인 식별

- web 채널: 최초 방문 시 서버가 `profileId`를 발급하고 `HttpOnly`, `Secure`, `SameSite=Lax` 쿠키로 유지한다.
- toss 채널: 앱인토스 SDK의 사용자 식별키(hash)를 서버가 mTLS API로 검증한 뒤 프로필에 연결하고 Bearer 세션을 준다. 미니앱은 `*.tossmini.com` origin에서 실행되므로 쿠키를 쓰지 않는다. 상세는 [ADR-009](../adr/ADR-009-apps-in-toss-channel.md).
- 로그인 기능이 추가되면 익명 프로필을 계정으로 병합하되 커리어 ID는 유지한다.
- **복구 코드는 Phase 1 필수다.** 첫 커리어 확정(SCR-004) 직후 사람이 옮겨 적을 수 있는 복구 코드를 발급하고, 설정(SCR-030)에서 다시 보기·재발급·복구를 제공한다. 긴 커리어가 쿠키 삭제로 사라지는 것은 이 제품 최악의 이탈 사유이므로 로그인보다 먼저 둔다.
- 복구 코드는 서버에 해시로만 저장하고 로그에 남기지 않는다. 재발급은 이전 코드를 무효화한다.
- 데이터 내보내기/가져오기 파일과 로그인 병합은 Phase 7에서 결정한다.

## 일관성 경계

- **로컬 강한 일관성**: 커리어 명령, 계약 확정, 시즌 결산, 은퇴. IndexedDB 트랜잭션 하나로 확정한다.
- **서버 강한 일관성**: 프로필 연결·병합, 복구, 시즌 보상 수령, Archive 확정. D1 트랜잭션과 unique key로 보장한다.
- **최종 일관성 허용**: 커리어 동기화(checkpoint 단위 지연), 분석 이벤트, 비핵심 통계, 운영 대시보드.
- 캐시는 정본이 아니며 커리어 `revision`이 다르면 폐기한다.
- 같은 Career를 두 기기에서 동시에 진행하면 한쪽 분기는 버려질 수 있다. 동기화 충돌 화면에서 사용자가 고른다.

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
| 엔진 워커 준비(허브 진입 후) | p75 1초 이하 |
| 이벤트 해결 명령(워커, 로컬) | p95 200ms 이하 |
| 시즌 결산(워커, 중간급 모바일) | p95 2초 이하 |
| 동기화 PUT | p95 500ms 이하, 실패 시 백그라운드 재시도 |
| 서버 조회 API | p95 300ms 이하 |
| 커리어 Snapshot | 압축 전 256KB 권장 상한 |
| 명령 로그 항목 | 평균 300B 이하 |

시즌 계산이 예산을 넘으면 UI는 진행 상태를 표시하되 결과 확정 명령은 한 번만 실행한다.

## 실패 복구

- 커밋 전 오류: 기존 상태 유지, 같은 명령 재시도 가능.
- 커밋 후 응답 유실(워커와 UI 사이): 같은 `commandId`로 결과 복구.
- 동기화 실패: 로컬 상태 유지, 재시도 큐. 오프라인 표시만 한다.
- 로컬 저장소 손상: 서버의 마지막 동기화 Snapshot으로 복원하고 그 이후 진행은 잃을 수 있음을 안내.
- 잘못된 콘텐츠 배포: 새 커리어 생성 중단 후 이전 content pack 재활성화.
- 데이터 마이그레이션 오류: 신규 쓰기 차단, 기존 Snapshot 읽기 유지, roll-forward 우선.
