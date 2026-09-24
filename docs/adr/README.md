# 아키텍처 결정 기록 (ADR)

기술 스택과 인프라의 확정 결정이다. 개발 명세가 "권장"이라고 쓴 곳은 이 디렉터리의 결정이 우선한다. 결정을 뒤집을 때는 기존 ADR을 지우지 않고 `Superseded by ADR-xxx`로 표시한 뒤 새 번호를 만든다.

`제안` 상태의 ADR도 검토를 위해 등록할 수 있지만, 채택되기 전에는 확정 ADR이나 기존 개발 계약보다 우선하지 않는다.

**2026-09-24 Phase 9 풀타임 전환**: [ADR-013](ADR-013-fulltime-replacement.md)이 원작 OFFSIDE(React + TanStack SPA, Web Worker 결정론 엔진, 버전 고정 콘텐츠 팩, 서버 동기화·리그 원장·서버 연간 커리어)를 새 게임 **풀타임**(vanilla Vite + TypeScript, `apps/web/src/game/*`, localStorage 저장, 서버는 로그인·프로필만)으로 전면 교체한 결정을 기록한다. 원작 설계 문서는 [`docs/archive/offside/`](../archive/offside/README.md)에 보존돼 있다.

| ID | 결정 | 상태 |
|---|---|---|
| [ADR-001](ADR-001-web-framework.md) | Vite + React SPA, Tailwind v4, Web Worker 엔진 | Superseded by ADR-013 |
| [ADR-002](ADR-002-persistence-and-identity.md) | 로컬 우선 저장, 서버는 동기화·보관, 익명 프로필 쿠키 | Amended by ADR-013 (게임 저장은 localStorage, 서버는 프로필만) |
| [ADR-003](ADR-003-simulation-location.md) | 시뮬레이션은 클라이언트, 서버는 리플레이 검증 | Superseded by ADR-013 |
| [ADR-004](ADR-004-content-format.md) | JSON 콘텐츠 팩과 ruleset, Zod 검증, 불변 아티팩트 | Superseded by ADR-013 |
| [ADR-005](ADR-005-monorepo-boundaries.md) | pnpm + Turborepo 모노레포와 패키지 의존 방향 | Amended by ADR-013 (패키지 목록 축소) |
| [ADR-006](ADR-006-service-name-and-domain.md) | 서비스명 표기, 도메인 구매·DNS | Reaffirmed by ADR-013 |
| [ADR-007](ADR-007-hosting-and-infra.md) | Cloudflare Workers Static Assets·API Workers·D1·R2, 환경·CI·비용 | Amended by ADR-013 (D1에 게임 데이터 없음) |
| [ADR-008](ADR-008-auth-and-account-merge.md) | 익명 플레이 + Google 로그인 1종, 계정 연결·병합 | Amended by ADR-013 (계정 병합 제거) |
| [ADR-009](ADR-009-apps-in-toss-channel.md) | 앱인토스 미니앱 대응 구조(출시 시점은 별도 결정): 채널 어댑터, 식별키·Bearer 세션, 네이티브 Storage, mTLS, 게임 등급분류 | Amended by ADR-013 (출시 보류 유지, platform 패키지 삭제됨) |
| [ADR-010](ADR-010-shared-contracts.md) | Phase 3 이후 병렬화를 위한 공유 계약: Effect 만료·중첩·타깃 소유권, 시장가치 입력 소유권, CareerTag 카탈로그·부여 인터페이스 | Superseded by ADR-013 (원작 domain 구조 자체가 제거됨) |
| [ADR-011](ADR-011-league-ledger-and-career-feedback.md) | 소속 리그 결과 원장, 결정론·저장·사건·모션의 분리 | Superseded by ADR-013 |
| [ADR-012](ADR-012-server-annual-careers.md) | 서버 권위 연간 커리어 진행 | Superseded by ADR-013 |
| [ADR-013](ADR-013-fulltime-replacement.md) | 원작 OFFSIDE → 풀타임 전면 교체, 서버는 로그인·프로필만, 구현은 Sonnet 5 서브에이전트에게 위임 | 확정 |

## 한 줄 요약

브라우저가 게임(풀타임)을 실행하고 `localStorage`에 저장한다. 서버(Cloudflare Workers + D1)는 익명 프로필·Google 로그인·프로필 복구만 다루며 게임 데이터를 갖지 않는다. 브랜드는 OFFSIDE, 도메인은 offside-lab.com을 그대로 쓴다. 원작의 결정론 엔진·콘텐츠 팩·서버 동기화·리그 원장·서버 연간 커리어 구조는 ADR-013으로 폐기됐다.

## 결정 원칙

- 1인 개발과 에이전트 구현에 맞게 운영 부담이 가장 작은 선택을 한다.
- 비로그인 플레이가 1급이며 로그인은 복구·동기화 수단이다.
- 상용 서비스가 허용되는 요금제만 쓴다.
- 게임 로직은 `apps/web/src/game`에 두고, 서버는 로그인·프로필 이상으로 커지지 않는다.
