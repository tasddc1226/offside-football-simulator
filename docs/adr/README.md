# 아키텍처 결정 기록 (ADR)

기술 스택과 인프라의 확정 결정이다. 개발 명세가 "권장"이라고 쓴 곳은 이 디렉터리의 결정이 우선한다. 결정을 뒤집을 때는 기존 ADR을 지우지 않고 `Superseded by ADR-xxx`로 표시한 뒤 새 번호를 만든다.

| ID | 결정 | 상태 |
|---|---|---|
| [ADR-001](ADR-001-web-framework.md) | Vite + React SPA, Tailwind v4, Web Worker 엔진 | 확정 |
| [ADR-002](ADR-002-persistence-and-identity.md) | 로컬 우선 저장, 서버는 동기화·보관, 익명 프로필 쿠키 | 확정 |
| [ADR-003](ADR-003-simulation-location.md) | 시뮬레이션은 클라이언트, 서버는 리플레이 검증 | 확정 |
| [ADR-004](ADR-004-content-format.md) | JSON 콘텐츠 팩과 ruleset, Zod 검증, 불변 아티팩트 | 확정 |
| [ADR-005](ADR-005-monorepo-boundaries.md) | pnpm + Turborepo 모노레포와 패키지 의존 방향 | 확정 |
| [ADR-006](ADR-006-service-name-and-domain.md) | 서비스명 표기, 도메인 구매·DNS | 확정, 도메인 가용성만 미확인 |
| [ADR-007](ADR-007-hosting-and-infra.md) | Cloudflare Pages·Workers·D1·R2, 환경·CI·비용 | 확정 |
| [ADR-008](ADR-008-auth-and-account-merge.md) | 익명 플레이 + Google 로그인 1종, 계정 연결·병합 | 확정 |
| [ADR-009](ADR-009-apps-in-toss-channel.md) | 앱인토스 미니앱 동시 출시: WebView SDK 3.x, 식별키·Bearer 세션, 네이티브 Storage, mTLS, 게임 등급분류 | 확정 |

## 한 줄 요약

브라우저가 게임을 실행하고 저장하며, 서버는 프로필·로그인·동기화 스냅샷·보관함·서비스 시즌만 다룬다. 같은 SPA 번들을 일반 웹과 앱인토스 미니앱 두 채널로 배포하고, 채널 차이는 `packages/platform` 어댑터 하나에 가둔다. 시뮬레이션은 결정론적이므로 서버는 필요할 때 명령 로그를 재생해 결과를 검증할 수 있다. 모든 인프라는 Cloudflare 한 곳에 두고 월 고정비를 도메인 외 약 5달러로 잡는다.

## 결정 원칙

- 1인 개발과 에이전트 구현에 맞게 운영 부담이 가장 작은 선택을 한다.
- 비로그인 플레이가 1급이며 로그인은 복구·동기화 수단이다.
- 상용 서비스가 허용되는 요금제만 쓴다.
- 도메인 규칙은 실행 위치와 무관하게 순수 TypeScript로 유지한다.
