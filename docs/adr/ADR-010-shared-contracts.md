# ADR-010. Phase 3 이후 병렬화를 위한 공유 계약

- 상태: 확정 (2026-09-03)
- 관련: [로드맵 "Phase 3 이후 병렬화"](../development/00-development-roadmap.md#phase-3-이후-병렬화), [03 게임 시뮬레이션 엔진](../development/03-game-simulation-engine.md), [04 이벤트 엔진](../development/04-event-engine.md), [14 Legacy Score와 엔딩](../development/14-legacy-score-and-endings.md), [ADR-005](ADR-005-monorepo-boundaries.md)

## 배경

로드맵 "Phase 3 이후 병렬화"는 Phase 2 종료 직후 트랙 A(Phase 3 계약·임대·이적)와 트랙 B(Phase 4 부상·관계·평판)를 병렬로 투입하려면 세 계약을 먼저 닫으라고 정했다: Effect 큐의 만료·중첩 규칙, 시장가치 입력 항목과 소유 Phase, CareerTag 목록과 부여 인터페이스. 이 세 계약을 미리 확정하지 않으면 두 트랙이 같은 `packages/domain`·`packages/contracts` 필드를 동시에 바꾸며 충돌한다. 이 ADR이 그 확정이다.

## 결정 1: Effect 만료·중첩·타깃 소유권 (D-40)

### kind → 타깃 소유권

| kind | 타깃 | 바꿀 수 있는 주체 |
|---|---|---|
| `PERMANENT` | `attributes.*` | 성장(시즌 결산)과 명시적 이벤트/챕터 outcome만. 단일 이벤트 ±1, 중대 이벤트 ±2 이내(다른 규칙 위반 금지) |
| `CURRENT` | `state.form` / `state.fitness` / `state.morale` | 경기·이벤트·챕터, Phase 4 부상 |
| `CONTEXT` | `context.tacticalFit` / `context.squadStatus` / `context.positionProficiency` | T-2-002 역할 제안, Phase 3 이적/임대, 이벤트 |
| `RELATION` | `relationships.managerTrust` / `captain` / `rival` / `fans` / `agent` | 이벤트·챕터, Phase 4 |
| `DEFERRED` | 위 넷 중 하나(예약만, 즉시 적용 없음) | 모든 Phase — `appliesAt.NEXT_SEASON_STEP{step}`으로만 |

두 Phase가 같은 타깃을 동시에 `REPLACE`로 직접 덮어쓰지 않는다(예: Phase 3과 Phase 4가 둘 다 `context.tacticalFit`을 REPLACE하지 않는다). `SUM`은 여러 Phase가 공유해도 안전하다(클램프만 하고 서로 상쇄되지 않는다).

### 중첩 규칙(`stackingRule`)

- `SUM`: 무제한 누적, clamp만 한다.
- `REPLACE`: 값을 그대로 대입한다. `expiresAt`이 있으면 적용 전 값을 `activeEffects[].restoreTo`에 저장해 만료 시 그 값으로 복원한다(새 필드, 콘텐츠 스키마에는 없다 — 런타임 전용).
- `ONCE_PER_SOURCE`: 커리어 전체에서 한 번만(기존 규칙).
- `ONCE_PER_SEASON`(신규): `appliedSourceIds`에 `season:<index>:<sourceId>`로 기록한다. `seasonBoundaryReset`이 `season:` 접두사를 쓸어내 다음 시즌에는 같은 소스가 다시 적용된다.

### 만료(`expiresAt`)

- `STEPS_AFTER{steps}` → 저장 시 `AT_STEP{step}`(기존).
- `AT_STEP{step}`: 시즌을 넘기면 다음 시즌 같은 step을 기다리지 않는다 — 결산 시(`expireAtSeasonEnd`) 시즌 로컬로 강제 만료된다.
- `AT_SEASON_END`(신규): 결산 직전에만 되돌아온다.
- `SEASONS_AFTER{seasons}`(신규) → 저장 시 `AT_SEASON_INDEX{index}`(적용 시점 `season.index + seasons`)로 치환. 그 시즌 결산 직전에만 되돌아온다.
- `PERMANENT`는 `expiresAt`이 반드시 `null`이다(스키마가 거부한다) — 능력치 효과는 영구적이라는 불변이 만료 규칙보다 우선한다.

`expireEffects(state, step)`는 step 진입 시(기존)만, `expireAtSeasonEnd(state, seasonIndex)`는 결산 직전(신규)만 부른다. `CURRENT`의 되돌리기 순서는 "만료 → 시즌 경계 회귀"다(만료로 복원된 값 위에 시즌 경계 회귀가 다시 적용된다).

### DEFERRED와 reasonTag

`DEFERRED`는 `appliesAt.NEXT_SEASON_STEP{step}`만 지원한다. `resolveDeferredKind`는 `effects.ts`로 옮기고 export한다. `FootballSeason.scheduledEffects`(이번 시즌 안에서 즉시 발동 예약)와 `CareerState.deferredEffects`(시즌 경계를 넘는 예약)의 역할 분리는 그대로 유지한다(T-2-005 PR #40이 고친 버그와 같은 재발 방지). `Effect`에 선택적 `reasonTag?: string`을 추가해 콘텐츠가 왜 이 효과가 적용됐는지 남길 수 있게 한다(효과 적용 로직은 이 값을 그대로 통과시킬 뿐 해석하지 않는다).

## 결정 2: 시장가치 지수 입력 소유권 (D-41)

03 문서 식 그대로다.

```text
Market Value Index = Base OVR 35% + Scouted Potential Mid 20% + Age Curve 15%
                   + Contract 10% + League 10% + Form 5% + Popularity 5%
```

`packages/domain/src/market-value.ts`의 `computeMarketValueIndex(input, rules)`는 순수 함수이고 상태에 저장하지 않는다(호출할 때마다 계산). `truePotential`은 `MarketValueInput` 타입에 없다 — 03 문서 "시장가치가 정찰 범위 밖의 정보를 드러내지 않음" 테스트 벡터를 타입 레벨에서 보증한다.

| 입력 | 소유 Phase | 비고 |
|---|---|---|
| `baseOvr` | 도메인 현재값(Phase 1~2) | `state.player.profile.baseOvr` |
| `scoutedPotentialMid` | 도메인 현재값(Phase 1~2) | `profile.scoutedPotentialMin`·`Max`의 중간값. `truePotential` 아님 |
| `age` | 도메인 현재값(Phase 1~2) | `state.age` |
| `form` | 도메인 현재값(Phase 1~2) | `state.state.form` |
| `contractSeasonsRemaining` | Phase 3 | `buildMarketValueInput`이 `contract.lengthSeasons − timeline SEASON_STARTED 횟수(서명 이후)`로 유도한다(브리프가 유도식을 명시하지 않아 이 ADR이 정한다) |
| `leagueTier` | Phase 3 | `contract.leagueTier` |
| `popularityCenti` | Phase 4 | Phase 4 평판 체계가 생기기 전까지 호출자가 5000(중간값) 고정 |

`buildMarketValueInput(state, ruleset)`은 Phase 3가 그대로 재사용할 어댑터다. 정규화 표(`marketValueRules`)는 `packages/content`의 ruleset 데이터이며 밸런스 수치는 LINE TEST 기준선 뒤로 조정될 수 있다(로드맵 "Phase 3 이후 병렬화" 4번).

## 결정 3: CareerTag 카탈로그와 부여 인터페이스 (D-42)

`packages/domain/src/career-tags.ts`의 `CAREER_TAGS`는 14 문서 "커리어 태그 카탈로그" 표의 16종을 라벨·희귀도까지 그대로 담는다. `evaluateAt`·`ownerPhase`는 14 문서가 명시하지 않으므로 이 ADR이 04 문서 "이벤트군" 표(감독/계약/관계/부상/경기/미디어/국가대표)와 로드맵의 Phase별 도메인 범위를 근거로 배정한다.

| 태그 | 조건 요약(14 문서) | evaluateAt | ownerPhase | 근거 |
|---|---|---|---|---|
| TAG-BIG-GAME | 핵심 경기 챕터 성공 5회 이상 | SEASON_SETTLED | 2 | 경기군, 이미 구현된 챕터 개념 — 이 브리프가 평가기 등록 |
| TAG-DERBY-HERO | 더비 챕터 결정적 기여 3회 이상 | SEASON_SETTLED | 2 | 경기군 — 이 브리프가 평가기 등록 |
| TAG-IRONMAN | 10시즌 이상 시즌당 출전 비율 80% 이상 | SEASON_SETTLED | 2 | 경기군, 출전 통계는 이미 도메인에 있음 — 이 브리프가 조건을 코드화하되 10시즌 미만인 Phase 2에서는 항상 false로 테스트 고정 |
| TAG-ONE-CLUB | 프로 8시즌 이상 한 구단, 임대 제외 | SEASON_SETTLED | 3 | 계약군(재계약) |
| TAG-JOURNEYMAN | 완전 이적 5회 이상 또는 6개 구단 | SEASON_SETTLED | 3 | 계약군(이적) |
| TAG-LOAN-LEGEND | 임대 출전 70%+평점 상위, 복귀 후 주전 | SEASON_SETTLED | 3 | 계약군(임대) |
| TAG-PROMOTION-EXPERT | 승격 2회 이상, 해당 시즌 주전 | SEASON_SETTLED | 3 | 계약군·리그 이동 |
| TAG-TRAITOR | 라이벌 구단 직행 이적 또는 약속 위반 이적 후 팬 관계 급락 | SEASON_SETTLED | 3 | 계약군(이적)+관계 |
| TAG-GLASS-GENIUS | 잠재력 상위 밴드와 중대 부상 3회 이상 | SEASON_SETTLED | 4 | 부상군 |
| TAG-MANAGER-FAVOURITE | 같은 감독 아래 신뢰 80 이상 3시즌 | SEASON_SETTLED | 4 | 감독군(재직 기간 추적은 Phase 4가 도입) |
| TAG-LOCKER-LEADER | 주장·부주장 3시즌 이상, 동료 관계 75 이상 | SEASON_SETTLED | 4 | 관계군 |
| TAG-COMEBACK | 중대 부상 또는 장기 결장 후 주전 복귀 | SEASON_SETTLED | 4 | 부상군 |
| TAG-CONTROVERSIAL | 미디어·윤리 이벤트 부정 결과 3회 이상 | SEASON_SETTLED | 4 | 미디어군 |
| TAG-LATE-BLOOMER | 26세 이후 최고 OVR 6 이상 갱신 또는 첫 1부 주전 | RETIREMENT | 5 | 통산 커리어 평가, Legacy(14 문서 소유) |
| TAG-MENTOR | 유망주 멘토링 이벤트 성공 3회 이상 | RETIREMENT | 5 | Legacy |
| TAG-UNCROWNED | 10시즌 이상 팀 트로피 0, 개인 기록 상위 | RETIREMENT | 5 | Legacy |

인터페이스:

- `grantCareerTag(state, tagId, source: { seasonIndex, revision, refId }) → CareerState` — 순수 함수, 이미 있는 태그면 무변경(멱등). `careerTags`는 코드포인트 오름차순 정렬, `careerTagGrants`에 `{ tagId, seasonIndex, atRevision, sourceRefId }`를 남긴다.
- `evaluateCareerTags(state, result: SeasonResult, ruleset) → CareerTagId[]` — `settleSeason`이 `seasonHistory`에 이번 시즌 결과를 넣은 뒤 부른다. `CAREER_TAG_EVALUATORS`에 등록된 태그만 판정하고, 미등록 태그는 건너뛴다(각 Phase가 자기 소유 태그의 평가기를 자기 작업에서 등록한다).
- Phase 2는 TAG-BIG-GAME·TAG-DERBY-HERO·TAG-IRONMAN 세 평가기만 등록한다. 나머지 13종은 카탈로그 메타데이터만 존재하고 평가기는 소유 Phase가 붙인다.
- `settleSeason`이 태그를 부여할 때마다 timeline에 `{ kind: 'CAREER_TAG_GRANTED', refId: tagId }`를 남긴다.

이 인터페이스를 만들기 위해 `RESOLVE_CHAPTER.payload.outcomes[]`에 `kind: 'SUCCESS' | 'NEUTRAL' | 'FAIL' | 'FIXED'`를 계약 레벨에서 필수로 추가했고(web은 payload만 채운다), `ChapterRecord.decisions[]`에 `outcomeKind`, `ChapterRecord`에 `trigger`를 추가했다(TAG-DERBY-HERO가 트리거 종류로 챕터를 구분해야 하기 때문).

## 검토한 대안

| 대안 | 보류 이유 |
|---|---|
| CareerTag 평가기를 각 Phase가 완전히 독립적으로 정의(카탈로그도 나눠 소유) | 16종이 서로 참조하는 엔딩(14 문서 "엔딩 카탈로그")과 태그 조합이 있어, 카탈로그를 한곳에서 관리하지 않으면 Phase 3·4·5가 같은 `CareerTagId` 유니온을 각자 확장하려다 충돌한다 |
| `expiresAt`을 시즌과 무관하게 절대 step으로만 관리(시즌 개념 없이) | 이미 여러 시즌에 걸친 챕터(TAG-BIG-GAME 등)와 시즌 경계 회귀가 존재해, 시즌 인덱스를 모르면 "이 효과가 몇 번째 시즌에 만료되는가"를 계약만으로 표현할 수 없다 |
| 시장가치를 상태에 캐시해 재계산 비용을 줄임 | 03 문서가 시장가치를 "요청 시점 계산값"으로 규정하고, 입력 대부분(폼·계약 잔여)이 매 step 바뀌어 캐시 무효화 규칙이 오히려 더 복잡해진다 |

## 결과

- `packages/domain`: `effects.ts`(ONCE_PER_SEASON·AT_SEASON_END·SEASONS_AFTER·AT_SEASON_INDEX·`restoreTo`·`reasonTag`·`resolveDeferredKind` export), `market-value.ts`(신규), `career-tags.ts`(신규), `simulate.ts`/`settlement.ts`(결산 훅 배선), `chapter.ts`/`types.ts`(trigger·outcomeKind).
- `packages/content`: `EffectSchema`(stackingRule·expiresAt·reasonTag 확장), `marketValueRules` 스키마+ruleset 1.0.0 데이터.
- `packages/contracts`: `EffectSchema`, `CareerStateSchema`(careerTags·careerTagGrants·activeEffects.restoreTo), `ChapterRecordSchema`, `commands.ts`(RESOLVE_CHAPTER outcomes.kind), timeline kind(CAREER_TAG_GRANTED).
- Phase 3·4 착수 워커는 이 ADR의 소유권 표를 그대로 따른다 — 새 타깃을 REPLACE하려는 Phase는 먼저 이 표를 갱신해야 한다.
