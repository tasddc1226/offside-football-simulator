# Phase 6. SEASON 1: KICKOFF

## 목표

첫 출시부터 서비스 시즌 구조를 사용하되, 초기 운영은 경쟁보다 개인 도전과 시즌 앨범에 집중한다.

## 시즌 메시지

`THE LINE HAS MOVED. 새로운 라인이 그어집니다.`

KICKOFF는 U18에서 첫 프로 계약과 주전 경쟁까지의 핵심 루프를 검증한다.

## 포함 범위

- ServiceSeason PRESEASON/ACTIVE/LOCKED/ARCHIVED 전환.
- 신규 Career에 serviceSeasonId/ruleset/content pack 원자 고정.
- 시즌 전환 공지와 미완료 Career 영향 안내.
- 지난 시즌 선수 보관함과 개인 시즌 결산.
- 개인 도전 6~10개, 완료 상태, 한 번만 받는 비경쟁 보상/배지.
- 시즌 앨범: 생성 선수 수, 최고의 선수, 가장 긴 Career, 극적인 복귀, 원클럽맨, 대표 태그.

## KICKOFF 도전 기본 6종

| 도전 | 의도 |
|---|---|
| OVR 70 이하로 1부 리그 데뷔 | 낮은 능력과 좋은 맥락 보상 |
| 임대 후 원소속팀 주전 | 임대를 실패가 아닌 성장 경로로 사용 |
| 포지션 전환 후 국가대표 선발 | 역할 숙련도·전술 적응 검증 |
| 중대한 부상 후 주전 복귀 | 재활 선택과 내구성 서사 회수 |
| 한 구단에서 10시즌 | 원클럽맨 가치 인정 |
| 우승 없이 Legacy 80 | 트로피 외 관계·기록·서사 보상 |

도전 의존성:

- "포지션 전환 후 국가대표 선발"은 Phase 4의 대표팀 차출(SCR-032)이 필요하다.
- "우승 없이 Legacy 80"은 [Legacy·엔딩](../development/14-legacy-score-and-endings.md)의 RULE-LEG-002 스케일 기준이며, 참조 분포에서 80 이상이 약 상위 10%가 되도록 fixture로 검증한다.
- KICKOFF는 Phase 5까지 완료된 뒤 여는 첫 정식 시즌이다. 첫 외부 공개는 Phase 2 이후의 `PRESEASON: LINE TEST`다.

## 운영 정책

- 기존 Career는 생성 당시 ruleset으로 끝까지 진행한다.
- 시즌 종료가 Career 삭제·강제 은퇴·OVR 소급 변경을 일으키지 않는다.
- 신규 시즌 랭킹/도전은 새 시즌 Career만 집계한다.
- 초기 버전은 글로벌 경쟁 랭킹보다 개인 기록과 앨범을 우선한다.
- 보상은 경기력 수치를 판매하거나 OVR을 영구 강화하지 않는다.

## 구현 슬라이스

1. ServiceSeason manifest와 상태 전이.
2. Career binding과 시즌 eligibility.
3. Challenge evaluator와 중복 보상 차단.
4. 시즌 전환 공지·허브 UI.
5. LOCKED 결산 job과 SeasonArchive.
6. 이전 시즌 보관함/앨범.

## 완료 조건

- [ ] 전환 중 생성된 Career가 정확히 한 시즌에 귀속된다.
- [ ] ACTIVE→LOCKED 뒤 신규 Career 생성이 차단된다.
- [ ] 기존 Career가 과거 ruleset으로 계속 진행된다.
- [ ] 도전 보상을 병렬 요청해도 한 번만 수령한다.
- [ ] 결산을 재실행해도 동일 SeasonArchive가 나온다.
- [ ] 시즌 공지가 미완료 Career와 신규 Career 영향을 구분한다.

## 제외

유료 시즌 패스, 길드, 글로벌 보상 랭킹, 시즌 종료 강제 초기화.

