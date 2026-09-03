# Phase 2 실행 계획 — 한 시즌 시뮬레이션

정본: [`docs/phases/phase-02-full-season.md`](../phases/phase-02-full-season.md). 이 문서는 그 범위를 워커 작업(T-2-xxx)으로 쪼개고, 설계 문서에 비어 있던 항목을 오케스트레이터 결정(D-24~D-32)으로 채운다. Phase 1 계획([phase-1-plan.md](phase-1-plan.md))과 같은 방식이다. 결정을 바꾸려면 결정 로그에 사유를 남긴다.

투입 규칙: Phase 1 보드가 모두 done(또는 U-00x 대기 blocked)이 된 뒤에 Wave 1을 띄운다. Phase 2는 **순차 Phase**다 — 이후 모든 Phase가 시즌 루프 위에서 돌기 때문에 도메인 Wave 1·2는 순서대로, 화면·검증 Wave 3·4만 병렬로 간다. 동시 워커는 최대 3명, 서로 다른 패키지에만 배치한다. Phase 3 이후의 병렬 구조는 [로드맵의 "Phase 3 이후 병렬화"](../development/00-development-roadmap.md#phase-3-이후-병렬화)를 따른다(2026-09-03 사용자 결정).

## 1. 끝나면 보이는 것

첫 계약 선수가 SCR-005(프리시즌 계획·시뮬레이션 모드) → SCR-011(시즌 준비 선택) → SCR-029(대시보드에서 advance, 전술실 구역) → SCR-031(핵심 경기 챕터, 판단 1~3개) → SCR-012(역할 변경) → SCR-013·014(선택 이벤트·결과) → SCR-015(시즌 결산)까지 한 시즌을 마친다. FAST 시즌은 6분, CHAPTER 시즌은 12분 안에 스크립트 플레이가 끝난다. 같은 seed는 같은 결산 hash를 낸다. 챕터 판단 도중 새로고침해도 확정된 판단까지 재생되고 roll이 추가로 소비되지 않는다. 끝나면 `PRESEASON: LINE TEST` 서비스 시즌으로 외부 공개 테스트를 연다.

## 2. Wave와 작업

| ID | 패키지 | 작업 | 선행 | Wave |
|---|---|---|---|---|
| T-2-001 | domain + content | FootballSeason·CompetitionRecord·12 step 캘린더(룰셋 `leagueCalendar`), `START_SEASON`(CMD-SIM-001)·`SETTLE_SEASON`(CMD-SIM-003), `ADVANCE`를 "다음 결정 step 또는 결산까지"로 재정의(RULE-TIME-002), step 경계 checkpoint 규칙, 결정 슬롯·예산 산정(RULE-TIME-004) | Phase 1 종료 | 1 |
| T-2-002 | domain + content | 팀 전술·감독 선호 역할·포지션 경쟁자 모델, Tactical Fit·Squad Status, RULE-PERF-001 Expected Performance, RULE-SEL-001 Selection Score와 선발·벤치·결장 판정, 룰셋 상수(가중치·포지션 숙련도), 계산 예 A·B golden fixture | T-2-001 | 1 |
| T-2-003 | domain | 포지션별 경기 통계 generator(FW·MF·DF·GK 필수 통계, 0분·교체·퇴장·부상 이탈), 상대 수준·관여량, FAST/CHAPTER 분포 동일성, 같은 seed 1,000회 hash 일치 | T-2-002 | 2 |
| T-2-004 | domain + content | 핵심 경기 챕터 선택(MAJOR/MINOR 조건, 예산 초과 시 가중치 순 절단, FAST는 MAJOR만)·판단 resolver(판단 1~3, 옵션 2~3, 사전 확률 표기, roll 1회, 재생 시 roll 미소비), 콘텐츠 팩 `chapters` 스키마 + 데뷔전·더비·결정전 3종 | T-2-003 | 2 |
| T-2-005 | domain | 시즌 집계·SeasonResult, 성장(훈련·출전·경험·연령)과 폼·체력·사기 Effect, 역할 변화·출전 약속 이행, 원인 태그, 결산 hash | T-2-003, T-2-004 | 2 |
| T-2-006 | contracts + api + engine-client | CMD-SIM-001~003 payload 스키마, FootballSeason·SeasonResult·EffectQueue 스키마, Snapshot 크기 상한 재검토, API-CAR-003 동기화 회귀, Worker에서 시즌 계산 시간 측정 | T-2-001 (스키마는 T-2-005까지 따라감) | 2 |
| T-2-007 | web | SCR-005 프리시즌 계획·시뮬레이션 모드, SCR-011 시즌 준비 선택, SCR-029 대시보드 advance·step 표시·전술실 구역, SCR-033 능력치 상세(전술 적합도·감독 신뢰·예상치 공개) | T-2-002, T-2-006 | 3 |
| T-2-008 | web | SCR-031 핵심 경기 챕터(판단·위험 표시·결과), SCR-012 역할 변경, 챕터 도중 새로고침 재생 | T-2-004, T-2-006 | 3 |
| T-2-009 | web | SCR-015 시즌 결산(CompareCards, OVR과 Expected Performance 변화 원인 분리, 0분·미집계·애니메이션 중 구분), 연대기 요약, 결산 중 응답 유실 복구 | T-2-005, T-2-006 | 3 |
| T-2-010 | content | 콘텐츠 팩 0.2.0: 챕터 3종 문구·판단·결과, 시즌 이벤트 추가분. `docs/content/kickoff/production-backlog.md`의 상태가 `SHIPPABLE`인 항목만 옮긴다 | T-2-004, 콘텐츠 승격 | 4 |
| T-2-011 | domain + web(e2e) | 포지션군 4종 시즌 완주 fixture, RULE-SEL-001 B > A, 0분·퇴장·부상 집계, FAST 6분·CHAPTER 12분 스크립트 측정, TEST-E2E-002·010, 챕터 재생 | T-2-007~009 | 4 |
| T-2-012 | api + web + platform | LINE TEST 준비: 서비스 시즌 `svc_line_test`(PRESEASON) manifest, 테스트 보관함 분리, 세션 길이·시즌당 결정 수·이탈 step·선택지 분포 분석 이벤트, 스테이징 배포 | T-2-011, T-0-010(U-002) | 4 |
| T-2-013 | docs | LINE TEST 운영 계획·기준선 기록 양식·Phase 2 완료 조건 표 | T-2-012 | 4 |
| T-2-014 | domain + contracts (+ADR) | **Phase 3 이후 병렬화용 공유 계약**: Effect 만료·중첩 규칙 확정, 시장가치 입력 항목과 소유 Phase, CareerTag 목록·부여 인터페이스 | T-2-005 | 3 (Wave 3·4와 병렬) |

투입 순서: T-2-001 → T-2-002 → (T-2-003, T-2-006) → (T-2-004, T-2-005) → (T-2-007, T-2-008, T-2-009, T-2-014) → (T-2-010, T-2-011) → T-2-012 → T-2-013. 브리프는 Wave가 열리기 전에 미리 쓴다.

## 3. 설계 결정 (초안 — 각 Wave 투입 전 확정)

### D-24 시즌 구조

`CareerState`에 `season: FootballSeason | null`과 `seasonHistory: SeasonSummary[]`를 추가한다. `FootballSeason = { index, serviceSeasonId, simulationMode, calendarId, steps: SeasonStep[12], competitions: CompetitionRecord[], matches: MatchRecord[] }`. 기존 `currentStep`·`seasonPhase`는 `season.steps[currentStep-1].phase`의 캐시로 유지한다(Phase 1 화면 호환). 캘린더는 룰셋 manifest `leagueCalendar`(개막 step, 이적창 step 7, 컵 라운드 위치)가 정의한다.

### D-25 명령

`START_SEASON { simulationMode }`는 step 1에서만, `SETTLE_SEASON`은 step 12 결정이 닫힌 뒤에만 허용한다. `ADVANCE`는 현재 step부터 다음 결정이 열리는 step까지 계산하고 지나간 step의 경기 요약을 `timeline`에 남긴다. 같은 step에 결정이 둘 이상이면 계약·부상 → 선택 이벤트 → 챕터 순으로 `pending`에 쌓는다(RULE-TIME-002). 결정이 열린 step과 step 12는 반드시 checkpoint다(engine-client가 명령 뒤 Snapshot 저장 — Phase 0 규칙 유지).

### D-26 팀·경쟁자

팀은 룰셋 `teams`에 `tacticalProfile`(역할별 요구 능력 가중치, 선호 아키타입, 역할 정원)을 추가한다. 경쟁자는 시즌 시작 시 역할당 2명을 팀 수준에 맞춰 생성한다(`generatePlayer`와 같은 rng 순서 규칙). Tactical Fit은 선수 능력과 역할 요구 가중치의 정규화 내적(0~100), Manager Trust는 `relationships.managerTrust`, Squad Status는 출전 약속·주장 여부·직전 평점의 합(0~100). 선발은 매 경기 RULE-SEL-001로 판정하고 이유(가장 큰 구성 요소 차이)를 기록한다.

### D-27 경기 통계

경기마다 출전 시간 → 관여량 → 포지션군 필수 통계 순으로 정수·고정소수점으로 생성한다. 상대 수준은 `leagueStrength`와 상대 팀 OVR 평균으로 정규화한다. rng 소비 순서는 경기 순서 → 선발 판정 → 출전 시간 → 통계 항목 순으로 고정하고 테스트가 순서를 검사한다. FAST와 CHAPTER는 같은 generator를 쓰고, 챕터 판단은 해당 경기의 통계에 보정만 더한다(분포 동일성 테스트).

### D-28 핵심 경기 챕터

챕터 후보는 03 문서의 조건표(MAJOR: 데뷔전·컵 결승·결정전·대표팀 데뷔, MINOR: 더비·친정팀·경쟁자 복귀 직후·감독 교체 직후)로 뽑고 예산(CHAPTER 2~3, 상한 4)을 넘으면 MAJOR 우선·가중치 순으로 자른다. 콘텐츠 팩 `chapters[]`: `{ id, importance, trigger, decisions: [{ id, prompt, options: [{ id, label, risk, probability, outcomes: [{ weight, effects, narrative }] }] }] }`. 판단 하나가 roll 1회다. 확정된 판단은 `resolvedEventIds`와 같은 방식으로 상태에 남아 재생 시 roll을 다시 소비하지 않는다. 챕터 결과는 경기 기록·폼·평판·감독 신뢰·태그에만 작용한다(Base OVR 불변).

### D-29 결산·성장

시즌 결산은 `SeasonResult { competitions, playerStats, selectionSummary, roleChanges, promiseFulfilment, attributeDeltas: { key, delta, causes[] }[], stateDeltas, hash }`. 성장식은 03 문서 그대로 쓰되 Phase 2는 훈련·출전 시간·경기 경험·연령 하락만 구현하고 코칭·성격 보정·부상 후유증은 Phase 4·5가 붙인다. 원인 태그는 결산 화면이 "OVR 변화"와 "Expected Performance 변화"를 분리해 보여주는 근거다. 폼·체력·사기는 시즌 경계에서 룰셋 상수로 회귀한다.

### D-30 화면

SCR-005·011·012·015·031·033은 06 문서와 13 디자인 시스템 토큰만 쓴다. SCR-015는 CompareCards(이번 시즌 vs 지난 시즌 또는 목표). SCR-031은 판단마다 위험 라벨과 사전 확률을 보여주고 결과는 DSN-LINE-001 허용 순간에만 오프사이드 라인을 쓴다. 대시보드 전술실 구역은 첫 프로 계약 뒤에만 열린다(점진 공개).

### D-31 LINE TEST 보관함

서비스 시즌 `svc_line_test`(PRESEASON)를 별도 manifest로 두고, 그 시즌에 만든 커리어는 `createdServiceSeasonId`로 구분해 KICKOFF 도전·앨범에 집계하지 않는다. 분석 이벤트는 세션 길이(SCR-034→SCR-010, CMD-SIM-001→003), 시즌당 결정 수, 이탈 step, 선택지 분포를 보낸다. 자유 입력과 선수 이름은 보내지 않는다.

### D-32 Phase 3 이후 병렬화 (2026-09-03 사용자 결정)

Phase 2가 끝나면 T-2-014의 공유 계약을 먼저 닫고, Phase 3(계약·이적)과 Phase 4(부상·관계)를 병렬 트랙으로 돌린다. 그 위에 Phase 5(은퇴·Legacy)와 Phase 6(KICKOFF 시즌)을 병렬로 얹는다. LINE TEST가 도는 동안 Phase 3·4의 도메인 골격(계약 상태기계, 부상 모델)은 먼저 만들고 밸런스 수치만 LINE TEST 기준선 뒤로 미룬다. 트랙은 최대 3개(리뷰 병목·사용량 한도·`packages/domain` 충돌이 상한). 상세는 로드맵.

### D-34 전술 스타일·역할 제안·경쟁자 생성 상세 (2026-09-03, T-2-002 투입 전 확정)

- 룰셋: `tacticalStyles` 3종(점유·역습·압박)에 포지션별 정원(합 11)·벤치 정원·요구 능력 가중치(합 1)·감독 선호 아키타입. 팀은 `leagueId`·`tacticalStyleId`·`squadStrength`(주전 평균 Base OVR 목표). `leagues[]`는 `teamCount` YOUTH 8·1부 12·2부 12·3부 10, 홈·원정 2회전. 컵은 4라운드 R1 step 5·R2 7·SEMI 9·FINAL 11(D-33의 R2 위치 확정). 가중치·숙련도 상수는 룰셋 `selectionRules`에 둔다(03 초기 기준식 그대로).
- Tactical Fit = round(스타일 가중 내적 × 0.6 + 감독 선호 아키타입 여부(100/0) × 0.4). 내적만으로는 Base OVR과 거의 같이 움직여 03 계산 예(A 50·B 88)의 폭이 나오지 않으므로 아키타입 항을 둔다. 포지션 숙련도는 기존 `context.positionProficiency`(현재 주포지션의 0~100)를 95/80 기준으로 1.0·0.97·0.92 등급화한다(배경 초기값 유지). Squad Status = 출전 약속 기준값(`squadStatusByRole`) + 주장 보너스(Phase 2는 NONE=0) + 직전 평점 보정(6.5 중립, ±20 상한) — 평점이 없으면 기존 초기값과 같다.
- 경쟁자는 `START_SEASON`에서 룰셋 `positions` 순서로 8포지션 × 2명 생성한다(선수 포지션 전환 시 재추첨 없음). Base OVR은 팀 `squadStrength ± 6`, 아키타입은 감독 선호 60%·나머지 40%(D-33), 이름은 룰셋 `competitorNames`에서 중복 없이. RNG 순서: 포지션 → 경쟁자 → 아키타입 roll → 이름 roll → 능력치 jitter 20 → managerTrust roll. 새 roll은 이것뿐이다.
- step 1 필수 슬롯(RULE-TIME-001 "역할 제안")은 감독 역할 제안이다: `KEEP` / `POSITION_CHANGE`(인접 포지션, Tactical Fit +15 이상, 순위 개선) / `ROLE_CHANGE`(순위로 본 역할 ≠ 계약 약속). roll 없이 산출하고 새 명령 `RESOLVE_ROLE { decision: ACCEPT | DECLINE }`(CMD-SIM-004)로 닫는다. SCR-012의 "조건부 훈련"은 훈련 Effect가 생기는 T-2-005가 붙인다. 포지션 전환은 능력치를 즉시 바꾸지 않고 `primaryPosition`·숙련도(인접 80·그 외 60)·Tactical Fit만 바꾼다. `contract.rolePromise`는 Phase 3 계약 작업 전까지 바꾸지 않는다.
- 선발 순위는 순수 함수 `rankSelection`(정렬 키 score → baseOvr → id, 정원 안 START·벤치 SUB·나머지 OUT)이고 이유는 선수와 경계 후보 사이 가중 차이가 가장 큰 구성 요소다. `season.squadRole`은 순위에서 파생한다(`SquadRole`은 시즌 지위, `MatchAppearance`는 경기 결과 — 02 구분 유지). 화면(T-2-007 전술실·SCR-033)은 도메인 선택자 `deriveTacticalRoom`이 주는 값만 쓴다.

### D-35 경기 계산 상세 (2026-09-03, T-2-003 브리프 선작성)

- 일정은 roll 없이 시즌 시작 시 확정한다: 리그는 `teamCount` 원형 라운드로빈 2회전을 step 3~11에 균등 배치, 컵은 R1 5·R2 7·SEMI 9·FINAL 11. 이름 없는 상대는 `league.strength`에 index 기반 균등 오프셋, 컵 상대는 라운드별 기준 strength. 리그 순위는 다른 팀 경기를 돌리지 않고 strength 기반 기대 승점(정수 ×100)과 우리 실제 승점을 비교해 매긴다.
- 경기 하나의 RNG 순서: 팀 결과(roll100 + 득점 rollInt 2) → 선발(roll 없음, `availability` 제외) → 출전 시간 → 관여량 → 포지션군 통계 항목(고정 키 순서) → 카드 → 부상 이탈 → 평점(roll 없음). 0분·OUT 경기는 팀 결과 roll만 소비한다. `ADVANCE`는 step의 경기를 먼저 돌리고 결정 슬롯을 연다(챕터 훅은 그 사이 — T-2-004).
- 부상·정지는 Phase 2에서 `availability { INJURY | SUSPENSION, matchesRemaining }`로만 표현한다(능력치·재활은 Phase 4). 평점은 통계 가중합으로 roll 없이 산출해 `lastRating`으로 Squad Status(D-34)에 들어간다. FAST·CHAPTER는 같은 generator라 챕터가 없는 T-2-003 시점에는 `matches`가 byte-identical하다.

### D-36 저장 상태의 모든 수는 정수 (2026-09-03, PR #37 리뷰)

`canonicalize`가 safe integer만 허용하므로 CareerState·Snapshot에 저장되는 모든 수는 정수다. 소수가 필요한 값(평점·xG·PSxG·기대 승점)은 `…Tenths`·`…Centi` 정수 필드로 들고 표시 계층에서 나눈다. 함수 안의 중간값은 부동소수여도 되지만 저장 전에 `Math.round` 한 번, 더하는 순서 고정. T-2-002 `selection.ts`가 `roundToInt`로 이 규칙을 먼저 적용했고 T-2-003 브리프의 평점은 `ratingTenths`(40~100)다.

D-34 보정: 역할 제안의 POSITION_CHANGE 후보는 `positionAdjacency[primaryPosition]` 전부(아키타입 필터 없음)이고, RESOLVE_ROLE 네 분기 뒤 `season.squadRole === squadRoleFromSelection(season.selection)` 불변식을 유지한다.

### D-37 경기 전용 RNG 스트림 (2026-09-03, PR #39 리뷰)

`FootballSeason.matchRngState`는 결정 슬롯이 쓰는 `CareerState.rngState`와 별개다. START_SEASON에서 `seedRng(\`match:${seasonIndex}:${rngState.s.join(',')}\`)`로 시드해 FAST/CHAPTER의 `matches`가 byte-identical하고 fork-by-replay 뒤에도 같다. 챕터 판단 roll(T-2-004)은 결정 스트림을 쓴다.

### D-38 핵심 경기 챕터 상세 (2026-09-03, T-2-004 브리프)

챕터 훅은 `walkToNextDecision`이 step의 경기를 돌린 직후·슬롯을 열기 전. `ADVANCE.payload.chapterCandidates`(웹이 팩에서 요약)와 trigger(DEBUT·DERBY·CUP_FINAL·DECIDER·TAG)를 그 step의 `MatchRecord`에 대조해 roll 없이 후보를 고른다(MAJOR > weight > id, step당 1개, FAST는 MAJOR만). 새 명령 `RESOLVE_CHAPTER`(CMD-SIM-005)가 판단 하나를 닫고 roll 1회를 소비한다. 결과는 `CURRENT`·`RELATION`·`DEFERRED` Effect와 경기 평점 delta(±15 tenths)·태그만(Base OVR·Fit 불변). 확정 판단은 `pending.resolved`·`season.chapters`·`resolvedChapterIds`에 남아 재생 시 roll을 다시 소비하지 않는다. 룰셋 리그에 `rivalOpponentIndex`·`promotionSpots`·`relegationSpots`, 팩에 `chapters/CHP-MATCH-001·002·004`.

### D-39 결산·성장 상세 (2026-09-03, T-2-005 브리프)

`SeasonResult`는 `seasonHistory[].result`로 남긴다(hash = canonical JSON sha256). 성장은 결산 시 1회, roll 없이 정수 산술: 연령대별 예산(centi) × 잠재력 gap 비율 × 출전 계수(0분도 30%) + 경험 보너스, 능력별 몫은 아키타입 roleWeights·기본 몫·훈련 초점(`START_SEASON.payload.trainingFocus`, 기본 ROLE), 그룹별 연령 곡선(신체 25/28, 기술 20~29/32, 정신 23~33, 골키핑 26~34)과 연령 하락. 소수 이월은 `growthCarryCenti`. 한 시즌 능력당 −3~+4, Base OVR은 잠재력을 넘지 않는다(초과분은 roleWeight 순으로 되돌리고 `POTENTIAL_CAP` 원인). 시즌 중 폼·체력·사기는 매 step 경기 결과로 roll 없이 갱신(`conditionRules`). 출전 약속 이행은 출전 시간 비율(`promiseMinutesShareBp`)로 판정하고 기록만 한다. 상수는 밸런스 테스트(seed 200 × 연령 3)가 balance-targets 표를 만족하도록 워커가 조정한다.

## 4. 열린 질문 (Wave 1 전에 닫는다)

- 리그·컵 구조를 룰셋 데이터로 얼마나 구체화할지(팀 수, 경기 수, 컵 라운드 수). 제안: 리그 팀 수는 룰셋 `leagues[].teamCount`, 경기 수는 홈·원정 2회전, 컵은 4라운드.
- 경쟁자 생성 시 아키타입 분포(같은 포지션 3종 중 무작위 vs 팀 전술 선호). 제안: 팀 선호 아키타입 60%, 나머지 40%.
- Snapshot 크기: 12 step × 경기 기록이 Snapshot 상한(contracts `REQUEST_BODY_MAX_BYTES`)에 닿는지 T-2-006이 측정한다. 넘으면 경기 기록은 시즌 결산 시 요약으로 압축한다.
