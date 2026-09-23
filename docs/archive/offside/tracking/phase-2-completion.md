# Phase 2 완료 조건 표

T-2-011(PR #47, main `0c27965`, 2026-09-04 03:41 머지)이 검증한 [phase-2-plan.md](phase-2-plan.md) 완료 조건. 본문은 워커가 PR 본문에 남긴 기록을 그대로 옮긴 것이며, 판정·후속 배정은 [decision-log.md](decision-log.md) 2026-09-04 항목이 정본이다. "수정하지 않고 기록만 남긴다(사용자 확인)"의 확인 주체는 사용자가 아니라 오케스트레이터 지시다. 사람 기준 세션 길이(FAST 6분·CHAPTER 12분) 판정은 U-005 플레이테스트와 합쳐 오케스트레이터가 별도로 낸다.

---

## 요구사항

T-2-011: `docs/phases/phase-02-full-season.md` "완료 조건" 9행을 코드·측정으로 닫는다(`docs/tracking/briefs/T-2-011.md`). 새 기능 없음 — fixture·테스트·측정·작은 후속 수정만.

## 완료 조건 표(9행)

| # | 항목 | 상태 | 근거 | 수치 |
|---|---|---|---|---|
| 1 | 포지션군 4종 시즌 완주 fixture | ✅ | `packages/domain/src/__fixtures__/career-{04-gk,07-df,08-mf,09-fw}.{ts,json,golden.json}` + `packages/fixtures` 미러/`index.ts` export + `packages/contracts` `KNOWN_GOLDEN_FILES`/순회/`snapshot-size.test.ts` + `apps/api/src/test/{hash-probe.worker.ts,cross-runtime-hash.test.ts}` | GK 25경기·DF 26·MF 26·FW 23, 전부 FAST·ruleset 1.0.0·pack 0.1.0, SETTLE_SEASON까지 완주(`season===null`) |
| 2 | 같은 Snapshot/seed → 같은 결과 hash | ✅ | `packages/domain/src/season-determinism.test.ts` | 4종 fixture × (2회 재생·step 6 부근 중간 스냅샷에서 이어 재생) 전부 `stateHash`·`seasonHistory[0].result.hash` 일치 |
| 3 | 0분·교체·퇴장·부상 집계 | ✅ | `packages/domain/src/season-aggregation.test.ts` | 4종 합쳐 outReason 3/4종(NOT_SELECTED·UNUSED_SUB·SUSPENSION, INJURY는 별도 테스트) 실제 등장, SUB 투입·90분 미만 교체 아웃, 레드카드→SUSPENSION 결장, 부상 이탈→INJURY 결장→복귀 전부 실제 fixture에서 등장(합성 주입 불필요) |
| 4 | OVR 낮아도 전술 적합도로 선발 | ✅ | `packages/domain/src/career-03-underdog.test.ts`("시즌 완주 — 선발 수가 경쟁자보다 많다") | 시즌 완주(25경기), player 선발 22 > COMP-W-2(진짜 밀려난 경쟁자) 선발 4. W 슬롯 2+벤치 1에 실질 후보 3명(COMP-W-1은 항상 선발권이라 비교 불가 — 아래 "범위 밖 발견" 참고) |
| 5·6 | SCR-015 원인 분리·응답 유실 복구 | ✅(검증만, 코드 변경 없음) | `apps/web/e2e/season-result.spec.ts`(T-2-009 작성분)를 `E2E_PORT=5187`로 3회 연속 실행 | 3/3 통과, flake 0 |
| 7 | RULE-SEL-001 B > A | ✅ | `packages/domain/src/selection-ab-season.test.ts` | 실제 FAST 시즌 완주: B(선호 아키타입) 선발 > A(비선호), 첫 경기 팀 스코어는 A·B 동일(경기 전용 RNG 공유, 아래 "범위 밖 발견" 참고) |
| 8 | FAST 6분·CHAPTER 12분 스크립트 플레이 | ✅ | `apps/web/e2e/session-length.spec.ts`("T-2-011 8번" describe) | FAST automationMs 2.9~4.5s·commandCount 4(예산 60s), CHAPTER automationMs 3.0~4.7s·commandCount 4(예산 120s) — 둘 다 예산 대비 크게 여유 있어 원인 분석 불필요. 사람 기준 6분/12분 판정은 오케스트레이터 몫 |
| 9 | 챕터 재생·TEST-E2E-010·안정화 | ✅ | `apps/web/e2e/chapter.spec.ts`(rngState.draws 검사 추가) | `chapter.spec.ts`·`season-result.spec.ts`·`season.spec.ts` 각 3연속 + 전체 스펙(68 tests) 3연속, 전부 flake 0. 알려진 flake(`/legal/privacy` axe `scrollable-region-focusable`) 3회 측정에서 재현 안 됨 — 기록만 |

후속 4건(10번, 각 별 커밋)은 아래 "후속 정리" 참고.

## 후속 정리(각 별 커밋)

- **(a) `player.ts` truePotential ≥ baseOvr+1`** (`2afbce8`): attributes jitter와 truePotential을 독립으로 굴려 표본 ~7%가 `baseOvr > truePotential`이던 문제. roll 자체(인자·소비 순서)는 그대로 두고 `truePotential = clamp(max(rolled, baseOvr+1), 40, 99)`로 결과값만 보정. 200 seed × 전체 archetype·배경 조합(3400+ 표본)으로 불변식 고정(`player.test.ts`).
  - 골든 hash 변경: `career-04-gk.golden.json` `0268d521…` → `40c4bf42…`, `career-07-df.golden.json` `fabbebb8…` → `7c7ba0bc…`(둘 다 domain·fixtures 미러 동시 갱신). `career-08-mf`·`career-09-fw`는 이미 `truePotential > baseOvr`였어서 hash 불변.
  - 두 fixture 모두 `playerStats`/`appearances`/`competitions` 등 시즌 통계는 완전히 동일(diff로 확인) — truePotential은 selection에 관여하지 않는다. 차이는 `attributeDeltas`의 EXPERIENCE-cause 배열이 TRAINING·MINUTES 성분을 추가로 포함하게 된 것뿐(성장 여지가 생겨 SETTLE_SEASON의 TRAINING/MINUTES 성장식이 더 이상 0으로 스킵되지 않음 — 정수 delta 자체는 두 fixture 다 여전히 0, centi 단위 causes 배열만 늘었다).
- **(b) `createWorkerSimulator` 요청당 타임아웃** (`0d2297a`): 기존엔 요청 하나가 타임아웃 나면 포트 전체를 broken 처리해 대기 중인 나머지 요청까지 전부 거부했다(PR #30 TODO). 타이머를 그 요청 하나만 지우는 `rejectOne`로 바꿔 포트·다른 대기 요청은 건드리지 않는다 — `error`/`messageerror`(진짜 포트 사망)만 여전히 전체 거부. `host.test.ts`에 (i) 타임아웃 뒤 같은 포트로 다음 요청이 정상 처리되는지, (ii) 동시 대기 중 하나만 타임아웃 나고 나머지·뒤늦은 응답 무시가 맞는지 테스트 2개 추가.
- **(c) `packages/fixtures`의 `eligibleEvents` 불일치** — **수정하지 않고 발견 사항으로 기록만**(아래 "범위 밖 발견 사항" 참고, 사용자 확인 2026-09-04). 브리프대로 실제 선택기 출력으로 재생성하면 weighted-roll 결과 자체가 바뀌어(EVT-REL-001이 ~91% 확률로 뽑힘) 7개 fixture 전부의 RESOLVE_EVENT·후속 이벤트 체인·golden을 새로 설계해야 해 이번 후속 3건과 규모가 다르다고 판단했다.
- **(d) `start-season.ts`의 `TrainingFocus` import 정리** (`f81f25b`): `@offside/domain`과 값이 완전히 같은 유니온을 독립 재선언하던 것을 `import type { TrainingFocus } from '@offside/domain'` + 재수출로 교체. 기존 import 경로는 그대로.

## balance-targets 시즌 통계 대조표

4개 fixture는 **완료 조건 3번(0분·교체·퇴장·부상 집계)을 만족시키도록 seed 탐색으로 고른 표본**이라 `docs/content/kickoff/balance-targets.md`의 인구 수준 목표(수만 표본 기준 %)를 n=1로 직접 검증할 수 없다 — 아래는 원시 수치 보고이며, 이탈 여부는 판단하지 않는다(오케스트레이터가 T-2-010/콘텐츠 결정으로 넘긴다는 브리프 지침).

| Fixture | 포지션군 | 출전 시간(분) | 평균 평점 | 득점/도움 | 카드(옐로/레드) | 부상 | 출전(선발/교체/0분/OUT) |
|---|---|---:|---:|---:|---:|---:|---|
| career-04-gk | GK | 1700 | 6.9 | – | 0/0 | 2 | 21/0/4/4 |
| career-07-df | DF | 220 | 6.5 | – | 1/1 | 1 | 0/24/15/2 |
| career-08-mf | MF | 170 | 6.3 | 0/2 | 1/1 | 0 | 0/20/17/6 |
| career-09-fw | FW | 185 | 6.6 | 3/2 | 0/1 | 1 | 0/18/13/5 |

DF·MF·FW의 낮은 출전 시간(대부분 SUB·0분)은 3번 완료 조건이 요구하는 "교체·0분·퇴장·부상" 사례를 한 fixture 안에 몰아넣도록 의도적으로 고른 결과다 — "일반적인 DF/MF/FW는 거의 안 뛴다"는 밸런스 신호로 읽으면 안 된다.

## 테스트 방법

- domain: `packages/domain/src/{season-determinism,season-aggregation,career-03-underdog,selection-ab-season,player}.test.ts` + 기존 스위트 — 409 tests, 33 files, 전부 통과.
- fixtures: 36 tests(11 files), contracts: 164 tests(6 files), api: 150 tests(22 files) — 전부 통과(신규 골든 hash를 동적으로 읽어 검증, 하드코딩 없음).
- web e2e: `E2E_PORT=5187`로 전체 스펙(68 tests, 5 skipped — 실 API 전용) 3연속 통과. `chapter.spec.ts`·`season-result.spec.ts`·`season.spec.ts` 각각 추가로 3연속 통과.
- 전체 체인: `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:deps && pnpm typecheck && pnpm test && pnpm build && pnpm --filter @offside/web check:bundle && E2E_PORT=5187 pnpm --filter @offside/web e2e` 전부 통과.
- 서브에이전트(Agent/Explore/fork, gstack `/review`·`/codex`·`/simplify`) 미사용 — 브리프 제약대로 모든 파일을 직접 Read/Bash/Edit로 처리했다. Orca PR 게이트용 `/review:pr`은 실제로는 `allowed-tools: Agent`(서브에이전트 스폰)로 정의돼 있어, "서브에이전트를 절대 띄우지 않는다"는 상위 제약과 "리뷰는 오케스트레이터가 한다"는 같은 문단의 마지막 문장을 우선해 이번엔 호출하지 않았다 — 리뷰는 오케스트레이터가 진행해 달라.

## 범위 밖 발견 사항

1. **RULE-SEL-001 B>A 시즌에서 "경기 결과가 시즌 내내 완전히 같다"는 가정은 성립하지 않는다**(`selection-ab-season.test.ts`). team-result roll(match.ts 1단계)은 항상 그 경기 시작 시점의 `matchRngState`만 쓰므로 두 시즌이 지금까지 같은 수의 roll을 소비한 동안은(A·B 모두 seed·팀·명령 로그가 같아 첫 경기까지는 보장) 팀 스코어가 완전히 같다 — 그러나 `minutes>0`일 때만 소비하는 관여량·포지션 통계·카드·부상 roll(4~7단계) 때문에, 선발 여부가 갈리는 순간부터 두 시즌의 matchRngState가 서로 다른 지점을 가리키게 돼 팀 스코어도 갈린다. 이 시드에서는 3경기(인덱스 0~2)까지 우연히 일치, 이후 갈림 — "선발 수가 확실히 다른" 시즌과 "경기 결과가 시즌 내내 완전히 같다"를 동시에 요구할 수 없다(둘 다 매 경기 똑같이 뛰거나 쉬어야 스코어가 안 갈리는데, 그러면 선발 수 차이도 안 생긴다). 도메인 버그 아님 — 명세(브리프) 쪽 가정 정정 필요.
2. **`career-03-underdog`의 "선발 수 > 경쟁자" 비교 대상은 COMP-W-1이 아니라 COMP-W-2다.** W 포지션은 slots=2·benchSlots=1이고 실 경쟁자가 정확히 2명이라, player를 더해도 후보 3명·자리 3개(2선발+1벤치)뿐이라 아무도 순수 랭킹만으로 OUT되지 않는다. player 점수(59~65)가 COMP-W-1(~58)보다 항상 높아 COMP-W-1은 player가 있든 없든(부상·퇴장 결장 시에도) 거의 항상 선발이다 — "player 선발 수 > COMP-W-1"은 구조적으로 불가능. 실제로 player에게 밀려 벤치로 가는 쪽은 COMP-W-2(~55~56)라 그쪽과 비교해야 "OVR 낮아도 전술 적합도로 선발" 서사가 성립한다.
3. **`packages/fixtures`의 `eligibleEvents`가 실제 `selectEligibleEvents` 후보군과 다르다**(PR #26 기록, 후속 10-c). CREATE_CAREER 기반 fixture 7종(`career-01`·`03-underdog`·`04-gk`·`06-settled`·`07-df`·`08-mf`·`09-fw`) 전부, 계약 전 EVT-CON-002 직전 ADVANCE에서:
   - fixture: `[{"eventId":"EVT-CON-002","weight":10}]`
   - 실제 `selectEligibleEvents(loadContentPack('0.1.0'), state)` 출력: `[{"eventId":"EVT-CON-002","weight":10},{"eventId":"EVT-REL-001","weight":100}]`

   EVT-REL-001 트리거(`career.tags에 '고집'` 또는 `season.step>=4`)가 이 시점에 이미 참이라 실제로는 적격 후보다. **콘텐츠 가중치 관찰(T-2-010 입력)**: 이 시점에 EVT-CON-002(weight 10)와 EVT-REL-001(weight 100)이 함께 뜨면 실제 플레이에서는 EVT-REL-001이 ~91%(100/110) 확률로 뽑혀, "온보딩 직후 진로 선택 이벤트를 보여준다"는 의도와 달리 열에 아홉은 진로 선택 이벤트(EVT-CON-002)가 노출되지 않는다 — EVT-CON-002의 weight를 올리거나 EVT-REL-001의 트리거를 진로 이벤트 이후로 미루는 조정이 필요해 보인다. 두 번째 ADVANCE(EVT-CON-003 직전)는 fixture와 실제 출력이 정확히 일치해 문제없다. `career-02-season`·`career-06-settled`의 시즌 파트에 있는 `EVT-SEASON-FIXTURE` placeholder 불일치는 별개로 — FAST 모드가 EVENT 슬롯 자체를 열지 않아(RULE-TIME-003) 이미 무해하다고 문서화돼 있다(문제 아님).

   수정 범위: 브리프대로 "실제 출력으로 재생성"하면 weighted-roll 결과가 통째로 바뀌어(위 91%) 7개 fixture 전부의 RESOLVE_EVENT·후속 이벤트 체인·golden을 서사 판단과 함께 재설계해야 한다 — 이번 후속 3건(각 1개 함수 수정)과 규모가 달라 **수정하지 않고 기록만 남긴다**(사용자 확인).

## LINE TEST 게이트(T-2-013)

이 9행 뒤의 외부 공개 테스트 게이트는 [line-test-plan.md](line-test-plan.md) 7절의 7행으로 관리한다(staging `svc_line_test` 확인, 예행, 테스터 10명 이상, 기준선 기록, 결함 배정, ruleset 1.0.0 확정, 시즌 LOCKED). 사람 기준 세션 길이(FAST 6분·CHAPTER 12분) 판정은 그 문서 5-3·6절의 분석 이벤트 값으로 닫는다.
