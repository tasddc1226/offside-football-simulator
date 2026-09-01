# OFFSIDE 화면 명세 인덱스

## 화면 계약 읽는 법

각 화면은 다음 필드를 가진다.

- **목적**: 화면이 해결하는 하나의 사용자 문제.
- **진입**: 서버 상태와 이전 명령.
- **표시**: 정본에서 읽어야 하는 데이터.
- **동작**: 허용 명령과 DRAFT 동작.
- **이탈**: 성공 시 다음 화면과 저장 checkpoint.
- **예외**: 빈 상태, 충돌, 복구.

공통 LOADING/DRAFT/COMMITTING/RESOLVED/EMPTY/ERROR 계약은 [`../development/06-ui-ux-specification.md`](../development/06-ui-ux-specification.md)를 따른다.

## 카탈로그

| ID | 축구 구현 화면 | 우선 | Phase | 상세 |
|---|---|---:|---:|---|
| SCR-001 | 홈·커리어 허브 | P0 | 1/6 | [시작·계약](01-career-start.md) |
| SCR-002 | 선수 생성 | P0 | 1 | [시작·계약](01-career-start.md) |
| SCR-003 | 플레이 스타일·아키타입 | P0 | 1 | [시작·계약](01-career-start.md) |
| SCR-004 | 생성 완료 확인 | P0 | 1 | [시작·계약](01-career-start.md) |
| SCR-005 | U18/프리시즌 계획 | P0 | 2 | [시즌](02-season-flow.md) |
| SCR-006 | 아마추어/유소년 시즌 결과 | P0 | 2 | [시즌](02-season-flow.md) |
| SCR-007 | 졸업 후 진로 선택 | P0 | 1 | [시작·계약](01-career-start.md) |
| SCR-008 | 입단 테스트 진행 | P1 | 1 | [시작·계약](01-career-start.md) |
| SCR-009 | 첫 프로 제안 결과 | P0 | 1 | [시작·계약](01-career-start.md) |
| SCR-010 | 신인 계약 사인 | P2 | 1 | [시작·계약](01-career-start.md) |
| SCR-011 | 스토브리그·시즌 준비 | P0 | 2 | [시즌](02-season-flow.md) |
| SCR-012 | 포지션·역할 변경 제안 | P0 | 2 | [시즌](02-season-flow.md) |
| SCR-013 | 커리어 선택 이벤트 | P0 | 1~4 | [시즌](02-season-flow.md) |
| SCR-014 | 선택 결과 카드 | P0 | 1~4 | [시즌](02-season-flow.md) |
| SCR-015 | 프로 시즌 결과 | P0 | 2 | [시즌](02-season-flow.md) |
| SCR-016 | 윤리·위기 이벤트 | P1 | 4 | [관계·이적](03-career-events.md) |
| SCR-017 | 계약 만료·FA | P0 | 3 | [관계·이적](03-career-events.md) |
| SCR-018 | 라커룸 관계 | P1 | 4 | [관계·이적](03-career-events.md) |
| SCR-019 | 이적 루머·관심 | P1 | 3 | [관계·이적](03-career-events.md) |
| SCR-020 | 이적·임대 결과 | P0 | 3 | [관계·이적](03-career-events.md) |
| SCR-021 | 슬럼프 대응 | P1 | 4 | [관계·이적](03-career-events.md) |
| SCR-022 | 부상·재활 대응 | P0 | 4 | [관계·이적](03-career-events.md) |
| SCR-023 | 포지션 전용 경기 이벤트 | P1 | 4 | [관계·이적](03-career-events.md) |
| SCR-024 | SNS·평판 이벤트 | P1 | 4 | [관계·이적](03-career-events.md) |
| SCR-025 | 은퇴·통산 기록 | P0 | 5 | [엔딩·시즌](04-legacy-and-service-season.md) |
| SCR-026 | Legacy Score | P0 | 5 | [엔딩·시즌](04-legacy-and-service-season.md) |
| SCR-027 | 커리어 연대기 | P1 | 5 | [엔딩·시즌](04-legacy-and-service-season.md) |
| SCR-028 | 최종 선수 프로필 | P0 | 5 | [엔딩·시즌](04-legacy-and-service-season.md) |

## 서비스 시즌 추가 화면

| ID | 화면 | Phase |
|---|---|---:|
| SCR-SVC-001 | 시즌 전환 공지 | 6 |
| SCR-SVC-002 | 시즌 도전 목록 | 6 |
| SCR-SVC-003 | 개인 시즌 결산 | 6 |
| SCR-SVC-004 | 선수 보관함·시즌 앨범 | 6 |

