# OFFSIDE

> 한 발 앞서거나, 모든 것을 놓치거나

축구 선수의 유소년 시절부터 은퇴까지를 선택과 시뮬레이션으로 경험하는 웹 기반 커리어 게임의 기획 저장소입니다.

## 핵심 방향

- 높은 OVR만으로 성공이 보장되지 않는 전술·포지션·관계 중심 커리어
- 선수의 축구 시즌과 서비스 운영 시즌을 분리한 장기 구조
- 첫 서비스 시즌 `SEASON 1: KICKOFF`
- 시즌 전환 뒤에도 과거 커리어를 재현할 수 있는 규칙 버전 고정
- 은퇴 결과를 프로필·연대기·Legacy Score·시즌 앨범으로 보관

## 문서

- [`docs/offside-football-simulator-design.docx`](docs/offside-football-simulator-design.docx): 편집 가능한 73페이지 통합 설계서
- [`docs/offside-football-simulator-design.pdf`](docs/offside-football-simulator-design.pdf): 검토·공유용 PDF
- [`docs/development/README.md`](docs/development/README.md): 공통 기술 명세, 시간 모델, 브랜드·시각 디자인, Legacy 규칙과 Phase 0~7 개발 문서 인덱스
- [`docs/screens/README.md`](docs/screens/README.md): 핵심 화면 34개와 서비스 시즌 화면 계약
- [`docs/content/README.md`](docs/content/README.md): 이벤트 저작 형식과 종이 프로토타입
- [`docs/research/slbcareer-first-run.md`](docs/research/slbcareer-first-run.md): 분석 대상 첫 플레이 기록
- [`docs/research/slbcareer-fresh-run.md`](docs/research/slbcareer-fresh-run.md): 초기화 후 재플레이 기록

문서가 충돌하면 `docs/development/`가 정본입니다. 통합 설계서의 어느 절이 대체됐는지는 [`docs/development/README.md`](docs/development/README.md)의 정본 우선순위 표에 있습니다.

## 현재 범위

이 저장소는 제품 콘셉트, 화면 단위 구현 명세, OVR·선발·이벤트·저장 데이터 구조, 시간 모델, 차별화 전략, 브랜드 가이드, 시각 디자인 시스템, Legacy·엔딩 규칙, 시즌 운영 설계, 단계별 개발 계약, 종이 프로토타입 콘텐츠를 보관합니다. 실제 게임 소스 코드는 아직 포함하지 않습니다.

## 시작 순서

1. [종이 프로토타입](docs/content/prototype/season-01-inside-forward.md)을 3회 플레이하고 결정 수·시간을 기록한다.
2. [로드맵](docs/development/00-development-roadmap.md)의 Phase 0으로 들어간다.
3. Phase 2가 끝나면 `PRESEASON: LINE TEST`로 외부 공개 테스트를 연다.
