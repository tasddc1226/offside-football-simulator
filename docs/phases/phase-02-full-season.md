# Phase 2. 한 시즌 시뮬레이션

## 목표

첫 계약 선수가 프리시즌부터 리그·컵의 핵심 장면을 거쳐 시즌 결산까지 진행한다.

## 완료 후 흐름

```text
SCR-005 프리시즌 계획 + 시뮬레이션 모드
→ SCR-011 시즌 준비 선택
→ SCR-029 대시보드에서 advance
→ SCR-031 핵심 경기 챕터(판단 1~3개)
→ SCR-012 역할 변경
→ SCR-013 선택 이벤트
→ SCR-014 결과
→ SCR-015 시즌 결산
```

## 포함 범위

- FootballSeason phase, 12 step, `FAST`/`CHAPTER` 모드, step 경계 checkpoint.
- 팀 전술, 감독 선호 역할, 포지션 경쟁자.
- Base OVR와 Expected Performance 분리, RULE-SEL-001 선발 판정.
- 선발·교체·결장, 출전 시간, 평점, 카드, 부상 이탈 가능 상태.
- FW/MF/DF/GK 포지션별 통계 생성기.
- 데뷔전·더비·결정전 중 최소 3종 핵심 경기 챕터와 챕터 전용 화면 SCR-031.
- 대시보드 전술실 구역과 능력치 상세(SCR-033), 첫 프로 계약 후 전술 적합도·감독 신뢰·예상치 공개.
- 시즌 기록, 팀 성적, 역할 변화, 능력 변화 원인 결산.
- LINE TEST 공개 테스트를 위한 테스트 보관함 분리와 세션 길이 측정.

## 규칙

- RULE-OVR-001, RULE-PERF-001, RULE-SEL-001, RULE-RNG-001, RULE-TIME-001~004.
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

- CMD-SIM-001~003, CMD-EVT-001. 동기화는 API-CAR-003.
- FootballSeason, CompetitionRecord, SeasonResult, EffectQueue.

## 완료 조건

- [ ] 네 포지션군 fixture가 한 시즌을 완주한다.
- [ ] 같은 Snapshot/seed의 시즌 결과 hash가 동일하다.
- [ ] 0분·교체·퇴장·부상이 올바르게 집계된다.
- [ ] OVR이 낮아도 전술 적합도가 높은 선수가 선발되는 fixture가 있다.
- [ ] 결과 화면이 OVR과 Expected Performance 변화 원인을 분리한다.
- [ ] 시즌 결산 중 응답 유실 후 동일 결과를 복구한다.
- [ ] RULE-SEL-001 계산 예의 선수 B가 선수 A보다 많이 선발된다.
- [ ] FAST 시즌 6분, CHAPTER 시즌 12분 이내로 스크립트 플레이가 끝난다.
- [ ] 챕터 판단 도중 새로고침해도 확정된 판단까지 재생되고 roll이 추가 소비되지 않는다.

## LINE TEST 게이트

이 Phase가 끝나면 [로드맵](../development/00-development-roadmap.md)의 LINE TEST를 연다. Phase 3은 LINE TEST 기준선이 기록된 뒤 시작한다.

LINE TEST는 web(staging 도메인)과 toss(앱인토스 QR 테스트, 워크스페이스 멤버 한정) 두 채널에서 같은 빌드로 진행한다. 앱인토스 첫 검토 요청은 LINE TEST 결함이 닫힌 뒤 보낸다. 게임 등급분류 증빙(U-009)이 없으면 검토 요청을 보낼 수 없다.

## 제외

다년 계약 협상, 실제 해외 리그 전체 데이터, 대표팀 토너먼트, 복합 부상 재활.

