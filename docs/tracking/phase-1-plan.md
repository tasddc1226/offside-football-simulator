# Phase 1 실행 계획 — 커리어 수직 슬라이스

정본: [`docs/phases/phase-01-career-vertical-slice.md`](../phases/phase-01-career-vertical-slice.md). 이 문서는 그 범위를 워커 작업(T-1-xxx)으로 쪼개고, 설계 문서에 비어 있던 항목을 오케스트레이터 결정(D-1~D-18)으로 채운다. 브리프는 이 문서의 결정을 그대로 따른다. 결정을 바꾸려면 결정 로그에 사유를 남긴다.

투입 규칙: Phase 0 보드가 모두 done(또는 U-00x 대기 blocked)이 된 뒤에 Wave 1을 띄운다(결정 로그 2026-09-02 "Phase 순서"). 동시 워커는 최대 4명, 서로 다른 패키지에만 배치한다.

## 1. 끝나면 보이는 것

온보딩(SCR-034) → 허브(SCR-001) → 선수 만들기 3단계(SCR-002·003·004, 복구 코드 발급) → 진로 선택(SCR-007, EVT-CON-002) → 입단 테스트(SCR-013·014, EVT-CON-003) → 제안 비교(SCR-009) → 계약 확정(SCR-010, AUTO 서명) → 대시보드(SCR-029). 다른 브라우저에서 복구 코드로 같은 커리어를 이어 본다. 삭제하면 서버·로컬 모두 지워진다. 첫 세션 5분 안에 계약까지 간다(TEST-E2E-001).

## 2. 설계 결정

### D-1 포지션과 묶음

`Position = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST'`. 묶음 `PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD'` (CB·FB → DEF, DM·CM·AM → MID, W·ST → FWD). 프로토타입 김서준 "AM/W 인사이드 포워드"는 `position: 'W'`, `archetypeId: 'inside-forward'`.

### D-2 아키타입 카탈로그 (룰셋 데이터)

포지션마다 3개, 총 24개. 각 항목: `id`(kebab), `position`, `name`(한글), `summary`(한 줄), `roleWeights`(`AttributeKey` 부분집합, 합 1.000), `template`(20개 `AttributeKey` 전부, 30~72), `potentialRange {min,max}`(55~92 안). 인사이드 포워드는 프로토타입 값을 그대로 쓴다(D-3). 나머지 23개는 워커가 저작하고 오케스트레이터가 리뷰한다. 검증 테스트: 가중치 합 1±1e-9, 템플릿 범위, 포지션당 3개, id 중복 없음, GK 아키타입만 `goalkeeping` 가중치 > 0.

### D-3 능력 키 매핑과 인사이드 포워드 가중치

T-0-002가 프로토타입 능력을 `ATTRIBUTE_KEYS`로 옮길 때 슈팅력을 뺐고 `goalkeeping`·`jumping`을 넣었다(`career-01.json`). 가중치는 결정력 14 + 슈팅력 6을 `shooting` 0.20으로 합친다.

| key | weight | key | weight |
|---|---|---|---|
| shooting | .20 | acceleration | .06 |
| passing | .14 | pace | .04 |
| crossing | .06 | agility | .03 |
| dribbling | .14 | stamina | .02 |
| firstTouch | .11 | positioning | .09 |
| composure | .05 | decisions | .04 |
| concentration | .02 | | |

김서준 fixture 능력으로 계산하면 59.30 → Base OVR 59. 이것이 golden이다(프로토타입 58.82 → 59와 같은 결과). 이도현 61은 능력표가 없어 golden에서 뺀다.

### D-4 Base OVR 계산

`baseOvr = Math.round(Σ roleWeights[k] × attributes[k])`. 가중치에 없는 키는 0. 반올림은 `Math.round` 하나로 통일하고 중간 반올림 없음. 관계·폼·체력·사기는 절대 들어가지 않는다(프로토타입 원칙).

### D-5 배경 3종 (룰셋 데이터)

| id | 이름 | 능력 보정(템플릿에 더함) | 초기 state | 초기 context | 초기 relationships |
|---|---|---|---|---|---|
| `club-academy` | 클럽 아카데미 | 없음 | form 50, fitness 80, morale 60 | tacticalFit 58, squadStatus 40, positionProficiency 100 | managerTrust 40, captain 50, rival 50, fans 50, agent 50 |
| `school` | 학원 축구 | stamina +3, strength +3, decisions −2 | form 50, fitness 85, morale 65 | tacticalFit 50, squadStatus 45, positionProficiency 100 | managerTrust 45, captain 55, rival 50, fans 55, agent 40 |
| `street` | 동네 클럽 | dribbling +4, agility +3, concentration −3, tackling −2 | form 55, fitness 75, morale 60 | tacticalFit 45, squadStatus 35, positionProficiency 95 | managerTrust 35, captain 45, rival 55, fans 45, agent 35 |

`club-academy`는 프로토타입 김서준 초기값과 정확히 같아야 한다(golden). 배경은 fixture처럼 `state/context/relationships`를 통째로 정의한다. 각 배경에 `startTeamId`(아카데미 소속 팀; Phase 1은 셋 다 `hangang-u18`)와 온보딩 문장 `blurb`를 둔다.

### D-6 잠재력

`truePotential = rollInt(rng, range.min, range.max)`(아키타입 범위). 정찰 범위는 `scoutedMin = truePotential − rollInt(rng, 5, 10)`, `scoutedMax = truePotential + rollInt(rng, 3, 8)`, 각각 40~99로 clamp. `truePotential`은 상태에 저장되고 해시에 들어가지만 화면·로그·에러 details 어디에도 노출하지 않는다(contracts `PlayerPublic` 타입은 이 필드를 갖지 않는다).

### D-7 DRAFT → ACTIVE 명령 셋

- `CREATE_CAREER` payload는 `{ careerId, seed, simulationMode, rulesetVersion, contentPackVersion }`로 줄인다. 결과 `status: 'DRAFT'`, `stage: 'YOUTH'`, `age: 17`, `currentStep: 0`, `seasonPhase: 'PRESEASON'`, 능력 전부 0, `player.draft` 전 필드 null, `player.profile: null`, `rngState = seedRng(seed)`(draws 0). checkpoint `CAREER_CREATED`.
- `UPDATE_PLAYER_DRAFT` payload `{ draft: Partial<PlayerDraft> }`. 준 필드만 검증 후 병합. 검증: `name` trim 후 2~12자, 제어문자·줄바꿈 금지; `nationalityCode`는 룰셋 `nationalities`에 있어야 함; `preferredFoot ∈ LEFT|RIGHT|BOTH`; `position ∈ Position`; `archetypeId`는 룰셋에 있고 `position`과 일치(둘 다 주면 같이 검사, archetype만 바꾸면 현재 position 기준); `backgroundId`는 룰셋에 있어야 함. DRAFT 상태에서만 허용. checkpoint `CAREER_CREATED`, rng 소비 없음.
- `CONFIRM_PLAYER` payload `{}`. draft 6개 필드가 모두 채워져야 한다(아니면 `VALIDATION_FAILED`, details `{ missing: [...] }`). 순서대로 rng 소비: (1) `ATTRIBUTE_KEYS` 순서로 키마다 `rollInt(-2, 2)` 20회 → `attributes[k] = clamp(template[k] + backgroundDelta[k] + jitter, 1, 99)`, (2) truePotential, (3) scoutedMin 편차, (4) scoutedMax 편차. 그다음 `baseOvr`(D-4), state/context/relationships는 배경 값, `status: 'ACTIVE'`, `currentStep: 12`, `seasonPhase: 'SETTLEMENT'`(Phase 1은 유스 시즌을 건너뛴 채 정산 시점에서 시작한다. Phase 2가 그 앞에 시즌을 넣는다), `player.profile` 채움, 타임라인 `CAREER_CONFIRMED`. checkpoint `CAREER_CREATED`, nextAction `'ADVANCE'`.

확정 전에는 어떤 명령도 rng를 소비하지 않는다(테스트로 고정). 기존 fixture의 `CREATE_CAREER`가 능력을 직접 받던 형태는 사라진다. golden fixture `career-01`은 새 명령 셋(CREATE → UPDATE_PLAYER_DRAFT → CONFIRM_PLAYER → …)으로 다시 만들고, 김서준 golden은 "확정 후 능력이 fixture 능력과 같도록" jitter를 포함한 값이 아니라 **Base OVR 계산 테스트에 프로토타입 능력을 직접 넣어** 59를 검증한다. 결정론 1,000회·복제 drift 테스트는 새 golden으로 유지한다.

### D-8 룰셋 데이터는 콘텐츠 패키지, 도메인은 입력으로 받는다

`packages/content/rulesets/1.0.0/ruleset.json` 한 파일. content가 Zod `RulesetSchema`로 검증하고 `loadRuleset('1.0.0')`을 export한다. domain은 `Ruleset` TS 타입을 정의하고 `SimulationInput.ruleset: Ruleset`으로 받는다. `ruleset.version !== input.rulesetVersion`이면 `VERSION_MISMATCH`. 룰셋 자체는 해시에 넣지 않는다(버전 고정 + 팩 checksum으로 보증, ADR-004). content의 `RulesetSchema`는 `satisfies z.ZodType<Ruleset>`으로 domain 타입과 묶는다. 룰셋 내용: `version`, `positions`, `archetypes[24]`, `backgrounds[3]`, `nationalities[10]`(KR 첫 번째), `draftRules {nameMin 2, nameMax 12}`, `scoutRange`(D-6 상수), `teams[]`, `offerRules`, `contractRules`.

### D-9 팀·제안·계약 (룰셋 데이터 + 도메인 규칙)

팀 8개(가상 이름, 실제 구단 연상 금지): `hangang-u18`(tier `YOUTH`), 1부 2팀, 2부 3팀, 3부 2팀. 필드 `id, name, leagueTier ('YOUTH'|1|2|3), reputation 1~5, wageBandId`.

제안 생성은 `ADVANCE`가 한다(D-10 4단계). 분기는 태그로 정한다:

| 태그 | 제안 |
|---|---|
| `진로_아카데미` | `hangang-u18` 유스 계약 연장 1건 고정 |
| `진로_하부리그` + `입단테스트_완료` | 수식 개수, 팀 풀 tier 2~3 |
| `진로_하부리그`, 테스트 미응시(baseOvr < 55) | 1건, tier 3 (2026-09-02 T-1-002 워커 발견으로 추가) |
| `진로_입단테스트` + `테스트_실패` | 1건, tier 3 |
| `진로_입단테스트` + `테스트_보통` | 수식 개수, tier 2~3 |
| `진로_입단테스트` + `테스트_성공` | 수식 개수, tier 1~3. baseOvr ≥ 60이면 첫 제안은 tier 1에서 |

개수 수식(프로토타입): `1 + (챕터 활약 2회 이상 → Phase 1은 항상 0) + hasTag('에이전트_계약') + hasTag('주목받는_유망주')`, 최대 3, 최소 1. 팀은 풀을 id 순 정렬 후 `rollInt(0, n-1)`로 비복원 추출. 제안 필드: `id` = `OFR-{revision}-{index}`, `teamId, teamName, leagueTier, lengthSeasons = rollInt(1,3)`, `wageMinorPerWeek`(룰셋 wage band: tier × baseOvr 구간 `<55 | 55~64 | ≥65`), `signingBonusMinor`(band), `rolePromise`(tier 1 → `RESERVE|BENCH`, 2 → `BENCH|ROTATION`, 3·YOUTH → `ROTATION|STARTER`, 각 rollInt(0,1)), `shirtNumber = rollInt(2, 39)`, `tacticalFitEstimate = clamp(rollInt(45, 75))`. 한 제안당 rng 소비 순서: 팀 추출 → length → rolePromise → shirtNumber → fitEstimate. 통화는 KRW 정수(minor 단위 없음, `Minor` 접미어는 정수 원을 뜻한다).

`ACCEPT_OFFER` payload `{ offerId }`: `pending.kind === 'OFFERS'`이고 목록에 있어야 한다. 계약 `Contract { id: 'CTR-'+revision, offerId, teamId, teamName, leagueTier, lengthSeasons, wageMinorPerWeek, signingBonusMinor, rolePromise, shirtNumber, signatureType: 'AUTO', signedAtRevision }`. `stage`는 tier `YOUTH`면 `YOUTH` 유지, 아니면 `PRO`. `context.squadStatus`는 rolePromise 매핑(STARTER 80, ROTATION 60, BENCH 40, RESERVE 25). 새 클럽이면 `relationships.managerTrust = 40`, 아카데미 잔류면 유지. `pending = null`, 타임라인 `CONTRACT_SIGNED`, checkpoint `CONTRACT_CONFIRMED`, nextAction `'SETTLEMENT'`. `NEGOTIATE`·`REJECT_OFFER`는 Phase 3.

### D-10 이벤트 제시는 도메인이 굴린다 (`ADVANCE` 재정의, 1·2·4·5단계는 T-1-001, 3단계는 T-1-005)

이벤트 후보의 **적격 판정**은 클라이언트가 콘텐츠 팩 조건(`evaluateCondition`, exclusionTags, resolvedEventIds)으로 계산하고, **선택**은 도메인이 한다. `ADVANCE` payload는 `{ eligibleEvents: Array<{ eventId: string; version: number; weight: number }> }`(eventId 오름차순, 클라이언트가 정렬). 처리 순서:

1. `status !== 'ACTIVE'` 또는 `pending !== null` → `VALIDATION_FAILED`(details `{ reason: 'PENDING_DECISION' }` 등).
2. `eligibleEvents.length > 0` → 1개면 그대로, 2개 이상이면 `rollInt(1, Σweight)` 한 번으로 가중 선택 → `pending = { kind: 'EVENT', eventId, version }`, checkpoint `EVENT_OFFERED`, nextAction `'DECISION'`.
3. `contract === null`이고 태그가 `offerRules` 분기 중 하나에 맞으면 → 제안 생성(D-9) → `pending = { kind: 'OFFERS', offers }`, checkpoint `CHAPTER_DECISION`, nextAction `'DECISION'`.
4. `seasonPhase !== 'SETTLEMENT'` → Phase 0 step 진행(현행 유지: STEP_BOUNDARY / SEASON_SETTLED).
5. 그 외(정산 단계, 할 일 없음) → `VALIDATION_FAILED` `{ reason: 'NOTHING_TO_ADVANCE' }`. 웹은 이 경우 버튼을 비활성화하고 "다음 시즌은 곧 열립니다"를 보여 준다(Phase 2 연결점).

`RESOLVE_EVENT`는 `pending.kind === 'EVENT'`이고 `eventId`·`definitionVersion`이 일치할 때만 받는다. 해소 후 `pending = null`, 타임라인 `EVENT_RESOLVED`, nextAction `'ADVANCE'`. 이렇게 하면 어떤 이벤트가 떴는지가 명령 로그에 남고, 재생(replay)이 콘텐츠 평가 없이 성립한다. 적격 판정 함수(`selectEligibleEvents`)는 content 패키지에 두고(T-1-015) engine-client·web이 호출한다. 이를 위해 ADR-005의 `engine-client → content`·`web → content` 허용 범위를 "스키마·조건 평가기·팩/룰셋 로더"로 넓힌다.

### D-11 콘텐츠 팩 수정 (0.1.0 제자리 수정)

`career.pathDecision` 필드는 만들지 않고 태그로 대신한다. 사용자 없음(`playtested: false`)이므로 0.1.0을 제자리에서 고친다(버전 올림은 KICKOFF 이후).

- EVT-CON-002: A 결과 `addTags: ['진로_입단테스트']`, B 결과 `addTags: ['늦은_출발', '진로_아카데미']`, C 결과 `addTags: ['밑바닥부터', '진로_하부리그']`. B의 followUp 없음, A·C는 `EVT-CON-003`.
- EVT-CON-003 trigger: `{ all: [ { any: [ hasTag '진로_입단테스트', hasTag '진로_하부리그' ] }, { gte: ['player.baseOvr', 55] } ] }`. baseOvr < 55이면 테스트 없이 곧바로 제안(`입단테스트_완료`가 없는 `진로_입단테스트`·`진로_하부리그` 각각에 미응시 분기: 1건 tier 3). 모든 CON-003 결과에 `입단테스트_완료` + 종류 태그(`테스트_성공`/`테스트_보통`/`테스트_실패`).
- `player.baseOvr`, `career.tags`, `career.stage`, `career.age`, `season.phase`가 조건 DSL의 상태 경로와 실제 `CareerState` 경로에 모두 존재하는지 검증기가 확인한다(`player.baseOvr` → `state.player.profile.baseOvr`).
- 대학 경로는 Phase 3 콘텐츠로 미룬다. `relationships.family`는 도메인에 없으므로 팩이 참조하면 검증 실패여야 한다.

### D-12 타임라인

`state.timeline: TimelineEntry[]`, `TimelineEntry = { revision, kind: 'CAREER_CONFIRMED' | 'EVENT_RESOLVED' | 'CONTRACT_SIGNED' | 'SEASON_SETTLED', refId: string | null, age, step }`. 문장은 넣지 않는다(웹이 팩·룰셋에서 조합). `refId`는 이벤트면 `EVT-…:choiceId:outcomeId`, 계약이면 contract id.

### D-13 CareerState 추가 필드

```ts
player: { draft: PlayerDraft; profile: PlayerProfile | null };
pending: null | { kind: 'EVENT'; eventId: string; version: number } | { kind: 'OFFERS'; offers: Offer[] };
contract: Contract | null;
timeline: TimelineEntry[];
```

`schemaVersion`은 1 유지(출시 전). golden·fixture는 새 형태로 재생성하고 PR 본문에 사유를 적는다. contracts의 `CareerStateSchema`·`PlayerPublic`은 T-1-006에서 맞춘다.

### D-14 복구 코드

형식 `OFS-XXXX-XXXX-XXXX`, 알파벳은 Crockford base32에서 `I L O U 0 1`을 뺀 26자 + 숫자 `2~9` → 총 30자, 12자리(약 2^59). 서버가 `crypto.getRandomValues`로 만들고 `sha256Hex(정규화 코드)`만 저장(`profiles.recovery_code_hash`, 이미 있음). 정규화: 대문자화, 공백·하이픈 제거, `OFS` 접두 제거. 원문은 발급 응답에 한 번만 담고 다시 보여 주지 않는다(SCR-030은 발급일과 "재발급"만). 재발급하면 이전 코드는 즉시 무효.

- `POST /profile/recovery-code` (API-PRO-003): 세션 필요. 응답 `{ code, issuedAt }`. 시간당 5회.
- `POST /profile/recover` (API-PRO-004): 본문 `{ code, mergeChoice?: 'MOVE_TO_LINKED' | 'KEEP_LINKED_ONLY' }`. 현재 세션 프로필에 삭제되지 않은 커리어가 있고 대상 프로필과 다르면 `mergeChoice` 없이는 409 `RECOVERY_CONFLICT` `{ currentCareerCount, targetCareerCount }`. `MOVE_TO_LINKED`는 현재 프로필 커리어를 대상 프로필로 이동(ADR-008 병합 규칙, careerId 유지, 감사 로그), `KEEP_LINKED_ONLY`는 이동 없이 세션만 대상 프로필로 재바인딩. 응답 `{ profileId, careerCount }`. 실패 코드 401 `RECOVERY_CODE_INVALID`(존재 여부를 구분하지 않는다). 실패 시도 IP+세션당 시간당 5회 → 429 `RATE_LIMITED`(D1 `auth_attempts` 테이블, KV 없이).
- 복구 성공 후 클라이언트는 로컬 커리어 목록을 서버 목록(`GET /careers`)으로 다시 채운다(T-1-012).

### D-15 프로필 삭제·로그아웃·커리어 삭제

- `POST /profile/delete` (API-PRO-005) 2단계: 본문 없음 → `{ confirmToken, expiresAt }`(10분, 세션에 묶임); 본문 `{ confirmToken }` → 204. 삭제는 `profiles.deleted_at` 기록 + 세션 전부 폐기 + 커리어·스냅샷·명령 로그 즉시 삭제(30일 보관 없음. 09 문서 규칙: 사용자 요청 삭제는 즉시). 감사 로그 `PROFILE_DELETED`.
- `POST /auth/logout` (API-AUTH-004): 세션 폐기, 204. 로컬 IndexedDB는 건드리지 않는다(ADR-008).
- `DELETE /careers/{id}` (API-CAR-005): 소유 확인 후 커리어·스냅샷·명령 로그 삭제, 204. 목록에서 빠진다. ARCHIVED 커리어는 Phase 4.
- 스키마에 없는 컬럼(`deleted_at`, `auth_attempts`)은 T-1-004가 migration으로 추가한다.

### D-16 화면 문서 정정

- SCR-004의 "API-CAR-005 호출"은 오기. 확정은 로컬 `CONFIRM_PLAYER` 후 동기화 `PUT /careers/{id}`(API-CAR-003)이며 API-CAR-005는 삭제다. 06·screens 문서를 고친다(오케스트레이터).
- 잠금 표시는 06(화면 명세)을 따른다. 13은 스타일만.
- SCR-030 Google 항목은 U-003 전까지 "준비 중" 비활성 행으로 둔다.

### D-17 인증(Google)

API-AUTH-001~003은 코드로 구현하되 실제 검증은 U-003 뒤. 테스트는 OIDC 토큰 엔드포인트를 `fetch` 주입으로 가짜로 둔다. 상세 규칙은 T-1-013 브리프에서 정한다. Phase 1 완료 조건에서 Google 실계정 검증은 U-003 대기 항목으로 분리한다.

### D-18 E2E 도구

Playwright(`@playwright/test`, Chromium만) + `@axe-core/playwright`. 위치 `apps/web/e2e/`, 스크립트 `pnpm --filter @offside/web e2e`. 프런트 단독 시나리오는 fetch를 스텁한다. API가 필요한 시나리오(복구·삭제)는 `apps/api`를 `wrangler dev --local`(포트 8787, 로컬 D1)로 띄워 실제 HTTP로 검사한다. CI 연결은 T-0-010(U-002) 이후.

### D-19 동기화 배선과 충돌 해소 (T-1-011)

- 배선: web은 `createSyncClient`를 앱 싱글턴으로 두고 `engine.execute` 성공(재생 아님)마다 `notifyCommitted`, `online`·`visibilitychange(hidden)`·`pagehide`에 `flush`. 앱 시작 시 미전송 커리어(`revision > lastSyncedRevision`)를 다시 큐에 넣는다. `fetch`는 `credentials: 'include'`, base URL은 `VITE_API_BASE_URL`(기본 `http://localhost:8787`). 세션은 앱 시작 시 `GET /profile` 한 번으로 만든다(실패해도 앱은 뜬다).
- `LocalCareerRecord.ownerProfileId`는 Phase 1에서 채우지 않는다(null). 소유는 서버 세션이 판정하고, 마지막으로 본 프로필 id는 LocalStore kv `profile:id`에 둔다. 프로필이 바뀌는 복구(D-20)는 이 값과 서버 목록으로 대조한다.
- 표시: 상태 7종(IDLE·SCHEDULED/SYNCING·RETRYING·OFFLINE·LOCAL_ONLY·CONFLICT·FAILED)을 한국어 문구+아이콘+색으로 허브 카드·커리어 헤더·설정에 보여 준다. 브랜드 어휘 없음. LOCAL_ONLY는 ADR-002의 "서버 동기화 불가 표시"다.
- 충돌: `CONFLICT`면 커리어 화면 위에 대화상자. "다른 기기 진행 가져오기" = `resolveConflict('REMOTE')`(Phase 0 구현). "이 기기 진행 유지" = 포크: 로컬 명령 로그 전체를 새 careerId로 엔진에서 재실행한다(결정 로그의 후보 (a) 채택. `PUT` 강제 플래그(b)는 서버 로그 계보가 섞여 기각). 결과 커리어는 careerId만 다르고 나머지 상태가 같다(결정론). 포크 뒤 원본은 REMOTE로 해소하고 새 커리어는 baseRevision 0으로 동기화한다. 커리어가 둘이 되는 것을 사용자에게 문장으로 알린다. "나중에"는 로컬 진행을 막지 않는다.
- 커리어 삭제는 로컬 삭제 + `DELETE /careers/{id}`. 재시도 가능한 실패는 kv `sync:pending-delete`에 두고 다음 시작·온라인 복귀 때 재시도한다.

### D-20 SCR-030 데이터 섹션 (T-1-012)

- 복구 코드: 서버는 해시만 가지므로 "다시 보기"는 없다(SCR-030 문서의 "다시 보기"는 발급일 표시로 읽는다). 행에는 발급일과 "재발급"(미발급이면 "발급"). 재발급 전 "이전 코드는 즉시 쓸 수 없게 됩니다" 확인. 결과는 대화상자에 한 번만 표시하고 복사 버튼을 둔다. 코드는 로컬·분석 어디에도 저장하지 않는다.
- 프로필 복구: 코드 입력 → `POST /profile/recover`. `RECOVERY_CONFLICT`면 선택 대화상자(현재 기기 커리어 n개 옮기기 = `MOVE_TO_LINKED` / 복구할 프로필만 사용 = `KEEP_LINKED_ONLY`). 성공 뒤 로컬 대조: KEEP이면 서버 목록에 없는 로컬 커리어를 로컬에서 삭제, MOVE면 로컬을 두고 미전송분을 전송. 서버 목록 중 로컬에 없거나 로컬이 뒤처졌고 미전송분이 없는 커리어는 `GET /careers/{id}`로 받아 `decodeSnapshot` 검증 뒤 로컬에 넣는다(engine-client `importCareerFromServer`). 미전송분이 있는 커리어는 덮어쓰지 않는다.
- 로그아웃: Google 연결 프로필에서만 활성(익명 프로필은 로그아웃하면 복구 수단이 사라진다). Phase 1(T-1-013 전)에는 항상 비활성이고 이유를 문장으로 보여 준다. 동작은 `POST /auth/logout` → 로컬은 그대로(ADR-008).
- 이 기기 데이터 삭제: platform에 `clearLocalData()` 추가(web: Dexie DB 삭제). 확인 대화상자에 미전송 커리어 수와 복구 코드 미발급 경고. 실행 뒤 온보딩으로.
- 프로필 삭제: D-15의 2단계. 1단계 응답의 `confirmToken`을 대화상자가 들고 있다가 "삭제"로 2단계. 204 뒤 이 기기 데이터 삭제와 같은 절차.
- 데이터 내보내기는 Phase 1 범위 밖(01 문서: Phase 7). 행을 두지 않는다. Google 행은 T-1-013.
- 법적 문서: 약관·개인정보 처리방침 본문은 ADR-002·ADR-008·09 "개인정보와 보존"의 사실만으로 초안을 쓴다. 사업자명·연락처·시행일은 `apps/web/src/legal/operator.ts` 상수 한 곳에 두고 값이 비면 "준비 중"으로 표시한다. 최종 문안·사업자 정보는 U-010(사용자)이다.
- api의 복구·삭제 라우트는 T-1-012에서 contracts 스키마(`RecoverProfileBodySchema` 등)를 쓰도록 바꾼다(T-1-004 결정 로그의 후속).

### D-21 Google OIDC 연결·병합 (T-1-013)

- 구현은 ADR-008대로 `arctic` + 자체 세션. `GoogleOidc` 포트(인가 URL 생성·코드 교환) 뒤에 arctic 구현과 가짜 구현을 두고, 로컬(`ENVIRONMENT=local`, `GOOGLE_FAKE=1`)에서는 가짜가 콜백으로 바로 돌아온다. 그래서 U-003 전에도 전 흐름을 E2E로 검사한다. 클라이언트 ID가 없으면 start는 503이고 앱은 그대로 뜬다.
- ID 토큰은 토큰 엔드포인트와 직접 TLS로 받으므로 서명 검증 없이 `iss`·`aud`·`exp`만 검사한다(OIDC Core 3.1.3.7 비고). scope는 `openid email`.
- `state`·PKCE verifier는 10분짜리 HttpOnly 쿠키(`offside_oauth`, Path `/v1/auth/google`)에 둔다. 서버 저장소 없음.
- 콜백 결과는 `WEB_APP_URL/settings?google=linked|switched|merge_required|error`로 돌려준다. `merge_required`면 세션에 `pending_merge_profile_id`(10분)를 기록하고 `POST /auth/merge`가 그것을 소비한다. 커리어 이동 배치는 복구(`recover.ts`)와 같은 함수를 쓴다.
- API-AUTH-006 `POST /auth/google/unlink`를 07에 추가한다(SCR-030 "연결 해제"). 프로필 삭제는 `google_sub`·`email`도 비운다(unique index가 재연결을 막던 문제).
- 화면에는 이메일 전체 대신 마스킹(`a***@도메인`)만 보여 준다(`ProfileSchema.googleEmailMasked`). 로그·분석·오류 details에 이메일·sub 금지.
- toss 채널의 Google 숨김은 `platform.features.googleLink`로 한다(채널 리터럴 비교 금지).
- 실 Google 계정 검증은 U-003 뒤 오케스트레이터가 한다. Phase 1 완료 조건 표에서 그 한 줄만 대기로 남긴다.

### D-22 Phase 1 완료 판정 측정 (T-1-014)

- 완료 조건 표는 `docs/tracking/phase-1-completion.md`(T-1-014가 쓰는 유일한 문서). 행 = phase-01 완료 조건 11개 + ADR-008 국외 이전 명시 1개 + Google 실검증(U-003 대기) 1개. 열 = 조건 / 측정값 / 통과 / 근거 / 비고.
- "최소 조작 시간"(08)은 화면 1.0초·선택 2.0초·텍스트 입력 4.0초·확정 1.5초의 고정 단가로 계산하고, 실제 자동화 시간과 함께 기록한다. 5분 조건은 자동화 시간으로 판정한다.
- 키보드 전용 주 여정은 별도 스펙으로 `click()` 없이 끝낸다(출시 차단 기준 "키보드로 P0 흐름 완료 불가").
- 허브 LCP·CLS는 `vite preview` 빌드에서 CDP 4G 에뮬레이션으로 3회 중앙값을 기록하고 assert하지 않는다. T-0-013 기준선과 비교 문장을 남긴다.
- E2E는 세 묶음: 기본(스텁 API), `E2E_WITH_API=1`(로컬 wrangler), `E2E_PREVIEW=1`(성능). CI 연결은 T-0-010.
- 버그는 T-1-014가 고치지 않고 표와 PR 본문에 적는다. 수정은 오케스트레이터가 별도 작업으로 낸다.

## 3. 작업 분해

| ID | 패키지 | 작업 | 선행 | Wave |
|---|---|---|---|---|
| T-1-001 | domain | Player 모델·룰셋 입력·DRAFT→CONFIRM_PLAYER·Base OVR golden·타임라인·`ADVANCE` 이벤트 제시(pending) (D-1~D-8, D-10, D-12, D-13) | Phase 0 종료 | 1 |
| T-1-002 | content | 룰셋 1.0.0 데이터·`RulesetSchema`·`loadRuleset`·검증 CLI 확장, 팩 0.1.0 태그 수정 (D-2, D-5, D-8, D-9 데이터, D-11) | Phase 0 종료 | 1 |
| T-1-003 | ui | 컴포넌트 키트: Radix RadioGroup·Dialog·Tabs 래핑, Stepper, ChoiceCard, CompareCards, StatusStrip, PlayerHeader, ResultCard, DashboardSection, CareerTimeline, Toast | Phase 0 종료 | 1 |
| T-1-004 | api | 복구 코드 발급·복구(RECOVERY_CONFLICT)·프로필 삭제 2단계·로그아웃·커리어 삭제·rate limit (D-14, D-15) | Phase 0 종료 | 1 |
| T-1-005 | domain | `ADVANCE` 3단계 제안 생성(offerRules), `ACCEPT_OFFER`·Contract, golden 확장(계약까지) (D-9) | T-1-001, T-1-002 | 2 |
| T-1-015 | content | `buildConditionContext(state)`·`selectEligibleEvents(pack, state)`(조건·exclusionTags·resolvedEventIds·phases·나이·weight), `RulesetSchema satisfies z.ZodType<Ruleset>` 바인딩, fixtures에 content 룰셋 ↔ ruleset-proto 일치 테스트 | T-1-001, T-1-002 | 2 |
| T-1-006 | contracts | 명령 payload 판별 유니온(6종), `PlayerPublic`·`Offer`·`Contract`·`Pending`·`Timeline` 스키마, 복구·삭제·로그아웃·MergeChoice 스키마, `CareerStateSchema` 갱신 | T-1-005 | 2 |
| T-1-007 | web | 엔진 배선(engine-client + platform LocalStore + Worker), 룰셋·팩 로딩, 온보딩 SCR-034, 허브 SCR-001 커리어 카드·이어하기·삭제, 전 화면 라우트 골격, ui-store 영속화, SCR-030 로컬 설정 부분 | T-1-001, T-1-003, T-1-015 | 2 |
| T-1-010 | web(e2e) | Playwright + axe 도입, 허브·법적 문서 스모크·접근성, 브라우저 Web Worker state hash 일치 테스트(T-0-011 잔여, dev 전용 probe 라우트) | Phase 0 종료(Wave 1 첫 머지 후 5번째 슬롯) | 1 |
| T-1-008 | web | 선수 만들기 SCR-002·003·004 + 복구 코드 발급 단계(SCR-004) | T-1-002, T-1-004, T-1-006, T-1-007 | 3 |
| T-1-009 | web | 진로 선택 SCR-007, 입단 테스트 SCR-013·014, 제안 비교 SCR-009, 계약 SCR-010, 대시보드 SCR-029(잠금 표시 포함) | T-1-005, T-1-006, T-1-007 | 3 |
| T-1-011 | web + engine-client | T-0-015 동기화 클라이언트 배선, 동기화 상태 표시, 충돌 화면("이 기기/다른 기기"), LOCAL 선택은 fork-by-replay 새 careerId (D-19) | T-0-015, T-1-007, T-1-008(`src/api/client.ts`) | 3 |
| T-1-012 | web + platform + engine-client + api(작게) | SCR-030 데이터 섹션: 복구 코드 재발급·복구 입력(RECOVERY_CONFLICT 선택)·복구 뒤 대조, 프로필 삭제, 로그아웃, 이 기기 데이터 삭제; 법적 문서 본문; api 복구·삭제 라우트의 contracts 스키마 채택 (D-20) | T-1-004, T-1-006, T-1-007, T-1-011 | 4 |
| T-1-013 | api + web + platform + contracts | Google OIDC start/callback/merge/unlink(가짜 OIDC로 E2E), SCR-030 Google 연결 행, 병합 선택 화면 (D-21, 실검증 U-003) | T-1-004, T-1-012 | 4 |
| T-1-014 | web(e2e) + docs | TEST-E2E-007·008·009, 키보드 전용 주 여정, 5분 세션 측정, 허브 LCP·폰트 CLS 재측정, Phase 1 완료 조건 표 (D-22) | T-1-008, T-1-009, T-1-011, T-1-012 | 4 |

Wave 1은 4개가 서로 다른 패키지라 동시에 띄운다. T-1-005·T-1-015는 T-1-001과 T-1-002가 모두 머지된 직후, T-1-006은 T-1-005 머지 직후 띄운다(짧은 작업). 남은 U-00x: U-002(CI, T-0-010), U-003(Google, T-1-013 실검증).

## 4. Phase 1 완료 판정

`phase-01` 문서의 완료 조건을 T-1-014가 표로 채운다. 항목마다 "측정값 / 통과 여부 / 근거(테스트 이름 또는 PR)"를 적는다. Google 실검증 한 줄만 U-003 대기로 남길 수 있다.
