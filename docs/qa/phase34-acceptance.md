# Phase 3·4 완료 조건별 인수 증거

기준: [`phase-3-4-plan.md` §4](../tracking/phase-3-4-plan.md#4-완료-조건--작업)의 P3-1~6, P4-1~7, 공통 조건을 현재 코드와 **이미 존재하는** 테스트에 연결한다.

이 문서는 테스트를 새로 실행한 결과표가 아니다. 테스트 정의와 구현을 정적으로 대조한 증거 지도이며, 현재 통합 브랜치의 최종 전체 체인 통과 여부는 별도 [통합 완료 기록](phase34-completion.md)에 남긴다. 따라서 아래의 “직접 근거”도 최신 CI 통과 전에는 병합·출시 완료 선언으로 사용하지 않는다.

## 판정 기준

| 표기 | 의미 |
|---|---|
| 직접 근거 | 기존 테스트가 완료 조건의 핵심 결과를 assertion으로 실패시킨다. |
| 부분 근거 | 구현과 일부 assertion은 있으나 완료 조건의 한 경로나 화면 의미까지 한 테스트로 닫지 않는다. |
| 관찰 근거 | 수치를 출력하거나 위반 후보를 수집하지만, 상한 초과·위반 자체는 테스트 실패가 아니다. |
| 사용자 게이트 | 자동화로 대체할 수 없는 문구 이해도, 선택 체감, 실제 플레이 시간 또는 반복 플레이 검증이다. |

## 요약

| 조건 | 구현 | 기존 자동 근거 | 현재 판정 | 출시 시 별도 게이트 |
|---|---|---|---|---|
| P3-1 제안 3개 이상 비교 | 있음 | 직접 | 기계적 인수 근거 있음 | 실제 선택지가 서로 다르게 느껴지는지 플레이 확인 |
| P3-2 만료·거절·협상 실패 안전망 | 있음 | 부분 | 현실적인 전 경로 fixture는 후속 | EXPIRED 전부 거절·협상 실패 실플레이 |
| P3-3 중복 명령 시 계약 중복 방지 | 있음 | 직접 | 기계적 인수 근거 있음 | 없음(최종 전체 체인만 확인) |
| P3-4 임대 기간·급여·원소속 계약 | 있음 | 직접 | 기계적 인수 근거 있음 | 급여 분담 문구 이해도 확인 |
| P3-5 리그 이동 시 Base OVR 불변 | 있음 | 직접 | 기계적 인수 근거 있음 | 결과 카드에서 오해가 없는지 확인 |
| P3-6 약속 위반 → 다음 시즌 관계 이벤트 | 있음 | 부분 | 상태·DSL 연결은 확인, 실제 다음 시즌 연결은 후속 | 소비 이벤트가 0.2.0/0.3.0 DEV 팩에만 있음 |
| P4-1 관계 중복 Edge 방지 | 있음 | 직접 | 현재 “축 하나 + 로그” 모델의 근거 있음 | 관계 화면의 인물성·기억 맥락 확인 |
| P4-2 감독 교체 후 역할·신뢰·경쟁 재평가 | 있음 | 직접 | 핵심 전환 assertion 있음 | 감독 교체 서사 콘텐츠는 DEV 팩 중심 |
| P4-3 재활 대가를 선택 전에 표시 | 있음 | 부분 | 값·도메인·브라우저 경로는 분리 검증 | 한 화면에서 수치가 이해되는지 실플레이 |
| P4-4 부상 재발 결정론 | 있음 | 직접 | 기계적 인수 근거 있음 | 없음(최종 전체 체인만 확인) |
| P4-5 관계·평판이 Base OVR을 직접 변경하지 않음 | 있음 | 직접 | 기계적 인수 근거 있음 | 결과 문구가 OVR 변화로 오해되지 않는지 확인 |
| P4-6 단일 실패 이벤트가 강제 종료를 만들지 않음 | 있음 | 직접+구조 | Phase 4 presentation 안전 규칙 근거 있음 | DEV 팩 실패 선택 반복 플레이 |
| P4-7 대표팀 사양이 감독 신뢰를 바꾸지 않음 | 있음 | 직접 | 기계적 인수 근거 있음 | 협회 대리 축을 `에이전트`로 표시하는 문구 확인 |
| 공통 세션 길이·결정 예산 | 측정 코드 있음 | 관찰 | 완료 조건 미확정 | 실제 사용자 FAST 6분·CHAPTER 12분 측정 필요 |

## Phase 3 상세 매핑

### P3-1 역할·전술이 다른 최소 3개 제안 비교

- 구현: [`market.ts`](../../packages/domain/src/market.ts)의 `generateMarket`이 안전 잔류 제안과 추첨 제안을 만들고, 역할·`tacticalFitEstimate`·`competitorSummary`·리그·계약 조건을 제안마다 저장한다. 웹은 이 값을 SCR-017 비교 카드로 렌더링한다.
- 직접 근거:
  - [`market-golden.test.ts`](../../packages/domain/src/market-golden.test.ts) — `market 골든 2: ... 제안 4개, TRANSFER 위주`, `market 골든 3: ... 제안 3개, LOAN 위주·바이아웃 포함`.
  - [`market.test.ts`](../../packages/domain/src/market.test.ts) — `제안 수 = clamp(1 + interest + agent, 1, 4)`, 역할별 TRANSFER/LOAN 가중, LOAN/TRANSFER 필드, 경쟁자 요약을 각각 고정한다.
  - [`transfer.spec.ts`](../../apps/web/e2e/transfer.spec.ts) — `TEST-E2E-003(a): 3개 이상 제안 비교→협상→FREE_AGENT 확정→SCR-020→새 팀 프리시즌`에서 비교 카드 3개와 상세·협상·결과 화면을 확인한다.
- 남은 의미 검증: 세 카드의 숫자가 다르다는 사실과 사용자가 “역할·전술상 다른 진로”로 인식하는지는 다르므로, 문구·정보 우선순위는 사용자 플레이 게이트다.

### P3-2 만료·거절·협상 실패에도 안전한 잔류/대안

- 구현: [`market.ts`](../../packages/domain/src/market.ts)의 `buildSafeOffer`는 index 0의 만료되지 않는 RENEWAL을 만들고, [`simulate.ts`](../../packages/domain/src/simulate.ts)의 `rejectOffer`는 EXPIRED 시장의 전부 거절을 안전 제안 수락으로 닫으며 FIRST_CONTRACT 전부 거절은 거부한다.
- 기존 근거:
  - [`market.test.ts`](../../packages/domain/src/market.test.ts) — `안전 잔류 제안은 항상 index 0이고 validUntilRevision null·negotiable 전부 false`.
  - [`market-commands.test.ts`](../../packages/domain/src/market-commands.test.ts) — `NEGOTIATE 성공·실패 모두 roll을 정확히 1회 소비한다`, `만료된 제안 ACCEPT_OFFER는 OFFER_EXPIRED로 실패...`, 안전 제안 개별 거절의 `SAFE_OFFER` 오류를 확인한다.
  - [`career-10-transfer.test.ts`](../../packages/domain/src/career-10-transfer.test.ts)와 [`transfer.spec.ts`](../../apps/web/e2e/transfer.spec.ts) — 결산 뒤 안전 잔류 제안 존재 및 INTEREST 안전 잔류 수락 화면을 확인한다.
- 판정이 부분인 이유: 현재 기존 테스트는 안전 제안 생성·수락과 협상 실패를 각각 확인하지만, **실제 EXPIRED 다중 제안에서 전부 거절** 및 **비안전 제안 협상 실패 뒤 안전 제안이 계속 유효한 상태**를 한 현실적인 fixture로 닫지는 않는다. 계획의 감사 C12에 해당하는 전용 fixture는 최소 테스트 정책에 따라 후속으로 둔다.

### P3-3 이적 중 중복 명령으로 계약이 겹치지 않음

- 구현: 모든 시장 명령은 revision 선검사를 거치고, 계약·stint 전환은 한 `simulate` 결과에서 원자적으로 생성된다. [`career-state.ts`](../../packages/contracts/src/career-state.ts)는 열린 stint 수와 현재 계약 일치를 검사한다.
- 직접 근거:
  - [`market-commands.test.ts`](../../packages/domain/src/market-commands.test.ts) — `같은 ACCEPT_OFFER를 stale revision으로 다시 보내면 revision 충돌이고 계약/stint는 하나만 추가된다`.
  - [`integration-invariants.test.ts`](../../packages/domain/src/integration-invariants.test.ts) — `career-11-loan fixture로 LOAN_RETURN P3-3 idempotency를 보충한다`.
  - [`sync/golden.test.ts`](../../packages/engine-client/src/sync/golden.test.ts) — `T-3-004 transfer·loan golden: replay·fork·import·중복 명령`에서 ACCEPT_OFFER와 LOAN_RETURN 재전송 후 열린 영구 stint가 하나임을 확인한다.
  - [`season-sync.test.ts`](../../apps/api/src/sync/season-sync.test.ts) — `T-3-004 transfer·loan 동기화 3경로`에서 전체·경계 분할·멱등 재시도의 최종 hash와 열린 계약 수가 같다.

### P3-4 임대와 원소속 계약의 기간·급여 규칙

- 구현: [`simulate.ts`](../../packages/domain/src/simulate.ts)의 LOAN 수락·`LOAN_RETURN` 분기가 원소속 계약을 `parentContract.suspended: true`로 보존하고 1시즌 뒤 RETURN/PERMANENT/원소속 만료 FA를 처리한다. `wageShareBp`는 설계대로 표시용 분담률이며 급여 원장 계산은 하지 않는다.
- 직접 근거:
  - [`market.test.ts`](../../packages/domain/src/market.test.ts) — `LOAN 제안은 loan·lengthSeasons 1을 갖고...`에서 룰셋의 `wageShareBp`도 함께 고정한다.
  - [`career-11-loan.test.ts`](../../packages/domain/src/career-11-loan.test.ts) — `원소속 계약이 복원되고... 3개 stint`, `임대 시즌 중에는 parentContract가 suspended:true...`, LOANED→LOAN_RETURNED 순서를 확인한다.
  - [`market-commands.test.ts`](../../packages/domain/src/market-commands.test.ts) — `LOAN_RETURN의 RETURN·PERMANENT 분기와 parentRemaining 0 자동 FA 분기를 모두 처리한다`.
  - [`career-state.test.ts`](../../packages/contracts/src/career-state.test.ts) — `LOAN 계약의 parentContract null·비정지 parentContract를 거부한다`; [`career-state.ts`](../../packages/contracts/src/career-state.ts)는 분담률 0~10000, LOAN-부모 계약 일치, stint 종료 시즌 하한을 검증한다.
- 제한: 분담률은 재무 시뮬레이션 값이 아니라 UI 설명용 계약 값이다. 화면에서 “총 주급”과 “부담률”이 혼동되지 않는지는 사용자 게이트다.

### P3-5 리그 이동이 Base OVR을 직접 변경하지 않음

- 구현: [`simulate.ts`](../../packages/domain/src/simulate.ts)의 계약 전환은 context·관계·팀을 바꾸지만 능력치와 `profile.baseOvr`은 이전 값을 유지한다.
- 직접 근거:
  - [`market-commands.test.ts`](../../packages/domain/src/market-commands.test.ts) — LOAN, TRANSFER, FREE_AGENT 분기 전후 `attributes`와 `baseOvr` 불변을 assertion한다.
  - [`transfer.spec.ts`](../../apps/web/e2e/transfer.spec.ts) — FREE_AGENT, LOAN, LOAN_RETURN, STAY 전후 저장 상태와 SCR-020 표시 OVR이 같다.
- 보조 관찰: [`integration-invariants.test.ts`](../../packages/domain/src/integration-invariants.test.ts)의 `checkP35`도 ACCEPT_OFFER/LOAN_RETURN 전후 `computeBaseOvr`를 비교하지만, 이 파일의 위반 수집기는 설계상 위반 자체를 테스트 실패로 만들지 않는다. 직접 테스트를 주 근거로 사용한다.

### P3-6 계약 약속 위반이 다음 시즌 관계 이벤트 입력

- 구현:
  - [`simulate.ts`](../../packages/domain/src/simulate.ts)의 결산은 약속 미달 때 `contract.promiseBreaches`를 증가시키고 `약속_위반` 태그 및 `PROMISE_BREACH` 감독 신뢰 로그를 남긴다.
  - [`condition-context.ts`](../../packages/content/src/runtime/condition-context.ts)는 저장 값을 `contract.promiseBreaches` DSL 입력으로 노출한다.
  - [`EVT-CON-012.json`](../../packages/content/packs/0.2.0/events/EVT-CON-012.json), [`EVT-REL-010.json`](../../packages/content/packs/0.2.0/events/EVT-REL-010.json), 0.3.0의 `EVT-MGR-003`이 이 입력을 소비한다.
- 기존 근거:
  - [`condition-context.test.ts`](../../packages/content/src/runtime/condition-context.test.ts) — 계약의 `promiseBreaches`를 그대로 context에 내보낸다.
  - [`new-events.test.ts`](../../packages/content/packs/0.2.0/new-events.test.ts) — `EVT-CON-012: promiseBreaches>=1·step<=3이면 PRO에서 통과...`.
  - [`career-10-transfer.golden.json`](../../packages/domain/src/__fixtures__/career-10-transfer.golden.json)은 결산 뒤 `약속_위반` 상태를 포함한다.
- 판정이 부분인 이유: 결산 위반 발생 → 다음 시즌 초 → 실제 관계 이벤트 선택 → 결과 적용을 하나로 잇는 기존 통합 fixture는 없다. 또한 소비 이벤트는 현재 기본 0.1.0에 없고 0.2.0/0.3.0 DEV 경로에만 있어 production 기본 커리어에서는 이 서사 연결이 노출되지 않는다.

## Phase 4 상세 매핑

### P4-1 같은 인물 관계 변화가 중복 Edge를 만들지 않음

- 구현 모델: 별도 인물 Edge 배열을 누적하지 않고 [`types.ts`](../../packages/domain/src/types.ts)의 관계 5축 singleton + `relationshipLog` + 축별 `memoryTags`로 표현한다. 따라서 “같은 인물 Edge 중복 금지”는 “축은 하나이고 변화 이력만 추가”로 해석한다.
- 직접 근거: [`effects.test.ts`](../../packages/domain/src/effects.test.ts)의 `5축 RELATION은 clamp 뒤 실제 delta와 감사 필드를 기록한다`, `clamp으로 실제 delta가 0이면 ... 기록하지 않는다`, `relationshipLog는 logMax...`, `memoryTags는 target별 LRU로 중복을 뒤로 옮기고...`; 동일 source 재적용은 `ONCE_PER_SOURCE는 두 번째 적용이 reject된다`가 막는다.
- 보조 관찰: [`integration-invariants.test.ts`](../../packages/domain/src/integration-invariants.test.ts)는 5축 범위·로그 40건·memory tag 상한을 매 명령 검사하지만 위반 후보를 출력만 하므로 단독 인수 근거로 삼지 않는다.
- 범위 주의: 이 판정은 현재 5축 추상 모델 기준이다. 향후 실제 감독·주장 인물 노드를 여러 명 저장하면 person id 기준 유일성 invariant가 새로 필요하다.

### P4-2 감독 교체가 선호 역할·신뢰·출전 경쟁을 재평가

- 구현: [`relationships.ts`](../../packages/domain/src/relationships.ts)가 결산에서 독립 파생 RNG로 교체를 판정하고 `nextManager`를 예약한다. [`manager.ts`](../../packages/domain/src/manager.ts)가 이전과 다른 선호 아키타입 후보를 만들며, [`simulate.ts`](../../packages/domain/src/simulate.ts)의 `START_SEASON`은 교체 여부를 기준으로 `managerTrust`, tactical fit, 선발 후보 점수를 다시 계산한다.
- 직접 근거:
  - [`relationships.test.ts`](../../packages/domain/src/relationships.test.ts) — `manager replacement consumes one derived roll without changing main rng...`에서 재생·fork와 MANAGER_CHANGED를 확인한다.
  - [`simulate.test.ts`](../../packages/domain/src/simulate.test.ts) — `실제 교체 예약만 START_SEASON에서 trustBase로 재설정한다`.
  - [`market-commands.test.ts`](../../packages/domain/src/market-commands.test.ts) — `강제 감독 교체가 예약된 임대 결산→PERMANENT→START_SEASON에서 감독·신뢰·전술·선발·주장단을 보존한다`가 교체 감독 id, 선호 아키타입 기반 tactical fit, 선수 선발 후보의 fit/trust를 함께 assertion한다.
- 제한: 별도 장기 C13 골든은 만들지 않았다. 현재 직접 회귀는 핵심 전환을 닫지만, 여러 시즌에서 교체 빈도와 서사 체감은 사용자 플레이 게이트다.

### P4-3 조기 복귀·단계 재활의 대가가 선택 전에 보임

- 구현:
  - [`injury.ts`](../../packages/domain/src/injury.ts)의 `applyRehabPlan`이 EARLY/STANDARD/CONSERVATIVE의 복귀 범위 이동과 재발 위험을 적용한다.
  - [`event-screen.tsx`](../../apps/web/src/shared/event-screen.tsx)는 확정 전 모든 `previewEffects`를 `ChoiceCard.effects`로 렌더링하고, [`injury.tsx`](../../apps/web/src/routes/-phase4/injury.tsx)는 진단 범위·현재 재발 위험·예정 컵 일정을 함께 보여준다.
- 기존 근거:
  - [`injury.test.ts`](../../packages/domain/src/injury.test.ts) — EARLY/STANDARD/CONSERVATIVE 각각의 범위 이동, 위험 clamp, 불변 필드를 확인한다.
  - [`load-content-pack.test.ts`](../../packages/content/src/packs/load-content-pack.test.ts) — `0.1.0/0.2.0/0.3.0가 세 rehabPlan의 이동량·재발 bp를 선택 전에 보여준다`에서 정확한 세 줄을 고정한다.
  - [`injury.spec.ts`](../../apps/web/e2e/injury.spec.ts) — 실제 forced INJURY pending에서 세 재활 선택지를 보고 표준 재활을 확정해 시즌을 계속한다.
- 판정이 부분인 이유: 기존 브라우저 테스트는 세 선택지와 진행 재개를 확인하지만 각 선택지의 preview 문구 DOM 및 표시값-룰셋 의미의 결합을 한 번에 assertion하지 않는다. C14 성격의 전용 검증과 실제 이해도 확인은 후속이다.

### P4-4 부상 재발 fixture가 결정론적으로 재현

- 구현: [`injury.ts`](../../packages/domain/src/injury.ts)의 발생·회복·재발은 전달받은 RNG만 소비하고 재발 시 같은 부위의 심각도를 한 단계 높인다.
- 직접 근거:
  - [`career-12-injury.test.ts`](../../packages/domain/src/career-12-injury.test.ts) — `golden revision/hash/rng draws와 정확히 일치`, `같은 fixture를 반복 실행해도 state hash가 같다`, 중증→재활→회복→MAJOR 재발을 확인한다.
  - [`injury.test.ts`](../../packages/domain/src/injury.test.ts) — `재발은 duration roll 1회로 같은 부위의 한 단계 높은 새 에피소드...`, `동일 입력 hook 결과의 canonical hash가 결정론적으로 같다`.
  - [`injury.spec.ts`](../../apps/web/e2e/injury.spec.ts)는 같은 고정 seed가 실제 브라우저에서 forced pending을 여는지 보완한다.

### P4-5 관계·평판이 Base OVR을 직접 바꾸지 않음

- 구현: [`effects.ts`](../../packages/domain/src/effects.ts)는 RELATION을 관계·평판 target으로만 라우팅하고 능력치 target을 거부한다. Base OVR 갱신은 PERMANENT 능력치 경로에만 있다.
- 직접 근거: [`effects.test.ts`](../../packages/domain/src/effects.test.ts)의 `RELATION이 attributes를 바꾸지 못한다`와 `RELATION/reputation 반복 적용은 attributes와 profile.baseOvr를 바꾸지 않는다`가 관계 5축·popularity·media 각각을 5회 적용해 불변을 확인한다.
- 보조 관찰: [`integration-invariants.test.ts`](../../packages/domain/src/integration-invariants.test.ts)의 RELATION target 검사와 EVT-REL-010/EVT-MEDIA-010 전후 비교는 위반 수집용이므로 보조 근거다.

### P4-6 단일 실패 이벤트가 강제 커리어 종료를 만들지 않음

- 구현: [`event.ts`](../../packages/content/src/schema/event.ts)의 Phase 4 presentation 안전 규칙은 FAIL outcome의 PERMANENT 음수 효과를 금지하고, 음수 CURRENT/CONTEXT에는 후속 이벤트 또는 유한 만료를 요구한다. 이벤트 Effect 자체에는 career status를 종료하는 target이 없다.
- 직접 근거:
  - [`event.test.ts`](../../packages/content/src/schema/event.test.ts) — `EventDefinitionSchema — presentation FAIL safety`가 영구 음수, 후속, 유한 만료 규칙을 각각 확인한다.
  - [`0.2.0/new-events.test.ts`](../../packages/content/packs/0.2.0/new-events.test.ts) — 신규 이벤트의 모든 FAIL outcome 회복 경로.
  - [`0.3.0/pack.test.ts`](../../packages/content/packs/0.3.0/pack.test.ts) — `새로 더한 presentation 이벤트의 FAIL outcome은 회복 경로를 가진다`.
- 범위 주의: 이 스키마 규칙의 직접 대상은 SLUMP/LOCKER_ROOM/ETHICS/MEDIA presentation이다. 통합 sweep의 ACTIVE status 확인은 [`integration-invariants.test.ts`](../../packages/domain/src/integration-invariants.test.ts)에서 관찰하지만 위반을 실패로 만들지는 않는다. DEV 팩의 실제 FAIL 선택을 여러 번 이어 가는 사용자 플레이는 별도 게이트다.

### P4-7 대표팀 사양이 감독 신뢰가 아니라 협회·팬 관계에만 작용

- 구현: [`national-team.ts`](../../packages/domain/src/national-team.ts)의 `nationalTeamEffects`는 fitness, fans, agent만 생성한다. 현재 데이터 모델에서 `agent` 축이 협회 관계의 대리 축이며 `managerTrust`는 포함하지 않는다.
- 직접 근거: [`national-team.test.ts`](../../packages/domain/src/national-team.test.ts)의 `choice A/B/C maps to ... and preserves managerTrust`와 `keeps national effects limited to fitness/fans/agent...`가 ACCEPT/CONDITIONAL/DECLINE 전부 및 실제 relationship log target을 확인한다. 같은 파일의 step 8·부상 자동 사양·중복 resolve·NATIONAL_DEBUT 재생 테스트가 주변 경로를 고정한다.
- 제품 문구 게이트: 사용자에게 `agent` 변화가 “소속 에이전트”가 아니라 “협회 관계 대리값”으로 잘못 읽힐 수 있으므로 SCR-032/SCR-014의 라벨은 실플레이에서 확인한다.

## 공통: 세션 길이와 결정 예산

- [`decision-budget.test.ts`](../../packages/domain/src/decision-budget.test.ts)는 FAST/CHAPTER 각 200 seed에서 결정·챕터·강제 부상을 센다. 다만 파일 주석과 assertion대로 상한 초과는 실패시키지 않고 `samples > 0`만 요구하며, 실제 콘텐츠 선택보다 챕터 수를 과소추정할 수 있는 합성 후보를 쓴다. 따라서 **관찰 근거**다.
- [`session-length.spec.ts`](../../apps/web/e2e/session-length.spec.ts)는 첫 계약의 자동화 시간·최소 조작 시간에는 5분 기준을 적용하지만, FAST/CHAPTER 한 시즌은 시간과 명령 수를 기록만 하고 6분/12분 기준을 assertion하지 않는다. 자동화 시간은 사람 플레이 시간이 아니다.
- T-4-006의 Phase 3·4 전체 E2E 3회 반복, 실제 사용자 FAST 6분·CHAPTER 12분, 선택 피로·이해도는 아직 완료 조건으로 닫지 않는다.

## 콘텐츠 팩과 실제 노출 범위

| 팩 | 현재 선택 경로 | 내용·기존 자동 근거 | 플레이 상태 | 인수 해석 |
|---|---|---|---|---|
| 0.1.0 | [`versions.ts`](../../apps/web/src/engine/versions.ts)의 production 새 커리어 기본값 | 기본 11 이벤트·4 챕터, core 부상/대표팀 정의 포함 | [`manifest.json`](../../packages/content/packs/0.1.0/manifest.json)도 `playtested: false` | LINE TEST 기준선이지 전체 Phase 3·4 콘텐츠 출시 승인 증거는 아님 |
| 0.2.0 | `import.meta.env.DEV`일 때 localStorage 오버라이드로만 새 커리어 선택 | 20 이벤트·4 챕터; 이적 루머, 약속 위반 소비, SLUMP/LOCKER_ROOM/ETHICS/MEDIA 추가. [`pack.test.ts`](../../packages/content/packs/0.2.0/pack.test.ts), 엔진 도달 seed [`phase4-seed-reachability.test.ts`](../../apps/web/src/engine/phase4-seed-reachability.test.ts) | [`manifest.json`](../../packages/content/packs/0.2.0/manifest.json) `playtested: false`, 신규/변경 정의 `PROTOTYPE` | 기능 QA용. 현재 production 기본값 승격 승인 없음 |
| 0.3.0 | `PACK_VERSIONS`에는 있으나 역시 DEV 오버라이드로만 새 커리어 선택 | 0.2.0 전체 + 신규 이벤트 12개 + 포지션 챕터 3개. [`load-content-pack.test.ts`](../../packages/content/src/packs/load-content-pack.test.ts), [`pack.test.ts`](../../packages/content/packs/0.3.0/pack.test.ts), [`reachability.test.ts`](../../packages/content/packs/0.3.0/reachability.test.ts)의 500 seed×2시즌 조건·presentation 도달성 | [`manifest.json`](../../packages/content/packs/0.3.0/manifest.json) `playtested: false`, 신규 정의·챕터 `PROTOTYPE` | 도달성은 검증됐지만 서사 품질·밸런스·재미는 승인되지 않음 |

DEV 오버라이드는 0.2.0뿐 아니라 `PACK_VERSIONS`에 들어 있는 0.3.0도 선택할 수 있다. production에서는 `import.meta.env.DEV` 조건이 false라 새 커리어는 계속 0.1.0이다. 기존 커리어는 [`content.ts`](../../apps/web/src/engine/content.ts)의 `contentForCareer`가 저장된 `contentPackVersion`을 유지하며, [`engine.test.ts`](../../apps/web/src/engine/engine.test.ts)의 `D-56 팩 오버라이드: 기존 커리어 replay 불변`이 0.1.0 replay 보존을 확인한다.

0.3.0의 500 seed 테스트는 신규 이벤트 12개의 **조건 충족**, 신규 presentation 종류의 **실제 선택**, 신규 챕터 3개의 **실제 선택**을 구분해 검사한다. 희귀 이벤트 12개가 각각 모두 실제 당첨됐다는 증거는 아니다. 자동 도달성·schema·hash 테스트는 “후보가 되고 대표 경로가 결정론적으로 처리된다”는 근거다. `PROTOTYPE` 문구가 자연스러운지, 선택지가 납득되는지, 결과가 공정하게 느껴지는지, 한 시즌이 목표 시간 안에 끝나는지는 사용자 실플레이 게이트다.

## 최소 후속 검증 권고

현재 사용자 정책에 맞춰 병합 전에 대규모 fixture 조합을 새로 만들지 않는다. 출시 준비 단계에서 다음을 작은 전용 검증으로 분리한다.

1. P3-2: 실제 EXPIRED 다중 제안에서 전부 거절, 비안전 제안 협상 실패, 안전 잔류 체결을 잇는 C12 회귀 1개.
2. P3-6: 약속 위반 결산부터 다음 시즌 `EVT-CON-012` 또는 관계 이벤트 선택까지 잇는 저장 팩 버전별 회귀 1개.
3. P4-3: 재활 카드 DOM의 세 preview 값이 룰셋 적용값과 맞는 C14 회귀 1개.
4. 사용자 플레이: 0.2.0과 0.3.0에서 대표 경로를 각각 실행해 문구·선택 체감·FAST/CHAPTER 실제 시간을 기록하고, 승격할 팩만 콘텐츠 리뷰 후 `playtested` 상태와 production 기본값 변경을 별도 승인한다.

최종 권고: 현재 직접 근거가 있는 기계적 조건은 통합 브랜치의 전체 체인과 CI가 통과하면 코드 병합 판단에 사용할 수 있다. 그러나 P3-2·P3-6·P4-3의 결합 경로, 공통 시간 예산, 그리고 모든 팩의 `playtested: false` 때문에 **Phase 3·4 production 콘텐츠 출시 완료**로는 아직 판정하지 않는다.
