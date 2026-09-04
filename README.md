# OFFSIDE

> 한 발 앞서거나, 모든 것을 놓치거나

축구 선수의 유소년 시절부터 은퇴까지를 선택과 시뮬레이션으로 경험하는 웹 기반 커리어 게임의 기획 저장소입니다.

## 핵심 방향

- 높은 OVR만으로 성공이 보장되지 않는 전술·포지션·관계 중심 커리어
- 선수의 축구 시즌과 서비스 운영 시즌을 분리한 장기 구조
- 첫 서비스 시즌 `SEASON 1: KICKOFF`
- 시즌 전환 뒤에도 과거 커리어를 재현할 수 있는 규칙 버전 고정
- 은퇴 결과를 프로필·연대기·Legacy Score·시즌 앨범으로 보관
- 국내에서 시작해 가상 해외 리그·대륙대회로 이어지는 `WORLD STAGE` 확장

## 문서

- [`docs/offside-football-simulator-design.docx`](docs/offside-football-simulator-design.docx): 편집 가능한 73페이지 통합 설계서
- [`docs/offside-football-simulator-design.pdf`](docs/offside-football-simulator-design.pdf): 검토·공유용 PDF
- [`docs/development/README.md`](docs/development/README.md): 공통 기술 명세, 시간 모델, 브랜드·시각 디자인, Legacy·WORLD STAGE 규칙과 Phase 0~8 개발 문서 인덱스
- [`docs/screens/README.md`](docs/screens/README.md): 핵심 화면 40개와 서비스 시즌 화면 계약
- [`docs/content/README.md`](docs/content/README.md): 이벤트 저작 형식과 종이 프로토타입
- [`docs/adr/README.md`](docs/adr/README.md): 확정된 기술 스택·인프라 결정 8건
- [`docs/tracking/README.md`](docs/tracking/README.md): 역할, 진행 보드, 결정 로그, 워커 위임 워크플로
- [`docs/research/slbcareer-first-run.md`](docs/research/slbcareer-first-run.md): 분석 대상 첫 플레이 기록
- [`docs/research/slbcareer-fresh-run.md`](docs/research/slbcareer-fresh-run.md): 초기화 후 재플레이 기록

문서가 충돌하면 `docs/development/`가 정본입니다. 통합 설계서의 어느 절이 대체됐는지는 [`docs/development/README.md`](docs/development/README.md)의 정본 우선순위 표에 있습니다.

## 현재 범위

이 저장소는 제품 콘셉트와 단계별 개발 계약뿐 아니라 도메인·콘텐츠·API·웹 클라이언트의 플레이 가능한 수직 슬라이스를 함께 보관합니다. WORLD STAGE는 국내 MVP와 운영 기반을 완성한 뒤 새 ruleset으로 출시하는 후속 확장입니다.

## 기술 스택 요약

Vite + React SPA가 브라우저 Web Worker에서 게임을 실행하고 로컬에 저장한다. 일반 웹(Cloudflare Workers Static Assets)으로 먼저 배포하며, 같은 번들을 앱인토스 미니앱(토스 앱 WebView)으로도 언제든 배포할 수 있는 구조다. Cloudflare Workers(Hono) + D1이 프로필·Google 로그인·복구·checkpoint 동기화·보관함·서비스 시즌을 담당하고, 필요할 때만 명령 로그를 재생해 결과를 검증한다. 콘텐츠 팩은 JSON 정적 번들이다. 상세는 [`docs/adr/`](docs/adr/README.md).

## 시작 순서

1. [진행 보드](docs/tracking/board.md)의 사용자 액션(도메인, Cloudflare, Google OAuth)을 처리한다.
2. [종이 프로토타입](docs/content/prototype/season-01-inside-forward.md)을 3회 플레이하고 결정 수·시간을 기록한다.
3. [로드맵](docs/development/00-development-roadmap.md)의 Phase 0으로 들어간다. 구현은 워커 에이전트가, 명세·리뷰는 오케스트레이터가 맡는다.
4. Phase 2가 끝나면 `PRESEASON: LINE TEST`로 외부 공개 테스트를 연다.
5. Phase 3~7의 계약·관계·Legacy·운영 기반이 안정되면 [Phase 8 WORLD STAGE](docs/phases/phase-08-world-stage.md)를 착수한다.
