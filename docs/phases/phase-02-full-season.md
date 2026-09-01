# Phase 2. 한 시즌 시뮬레이션

## 목표

첫 계약 선수가 프리시즌부터 리그·컵의 핵심 장면을 거쳐 시즌 결산까지 진행한다.

## 완료 후 흐름

```text
SCR-005 프리시즌 계획
→ SCR-011 시즌 준비 선택
→ 주전 경쟁/핵심 경기 이벤트
→ SCR-012 역할 변경
→ SCR-013 선택 이벤트
→ SCR-014 결과
→ SCR-015 시즌 결산
```

## 포함 범위

- FootballSeason phase와 일정 요약.
- 팀 전술, 감독 선호 역할, 포지션 경쟁자.
- Base OVR와 Expected Performance 분리.
- 선발·교체·결장, 출전 시간, 평점, 카드, 부상 이탈 가능 상태.
- FW/MF/DF/GK 포지션별 통계 생성기.
- 데뷔전·더비·결정전 중 최소 3종 핵심 경기 챕터.
- 시즌 기록, 팀 성적, 역할 변화, 능력 변화 원인 결산.

## 규칙

- RULE-OVR-001, RULE-PERF-001, RULE-RNG-001.
- 모든 경기를 조작하지 않고 경력상 중요한 경기만 선택형 장면으로 노출한다.
- 폼·체력·사기는 Base OVR을 바꾸지 않는다.
- 0분, 미집계, 애니메이션 중 값을 구분한다.

## 구현 슬라이스

1. FootballSeason·CompetitionRecord.
2. 전술 적합도와 스쿼드 역할.
3. 포지션별 경기 통계 generator.
4. 핵심 경기 선택과 결과 resolver.
5. 시즌 집계와 성장·폼·체력 Effect.
6. 시즌 결과 UI와 원인 태그.

## API·데이터

- API-SIM-001~004, API-EVT-001~002.
- FootballSeason, CompetitionRecord, SeasonResult, EffectQueue.

## 완료 조건

- [ ] 네 포지션군 fixture가 한 시즌을 완주한다.
- [ ] 같은 Snapshot/seed의 시즌 결과 hash가 동일하다.
- [ ] 0분·교체·퇴장·부상이 올바르게 집계된다.
- [ ] OVR이 낮아도 전술 적합도가 높은 선수가 선발되는 fixture가 있다.
- [ ] 결과 화면이 OVR과 Expected Performance 변화 원인을 분리한다.
- [ ] 시즌 결산 중 응답 유실 후 동일 결과를 복구한다.

## 제외

다년 계약 협상, 실제 해외 리그 전체 데이터, 대표팀 토너먼트, 복합 부상 재활.

