# Phase 3·4 실행 계획 — 계약·임대·이적(트랙 A)과 부상·관계·평판(트랙 B)

정본: [`docs/phases/phase-03-contract-and-transfer.md`](../phases/phase-03-contract-and-transfer.md), [`docs/phases/phase-04-injury-and-relationships.md`](../phases/phase-04-injury-and-relationships.md), [ADR-010 공유 계약](../adr/ADR-010-shared-contracts.md), [로드맵 "Phase 3 이후 병렬화"](../development/00-development-roadmap.md#phase-3-이후-병렬화). 이 문서는 두 Phase를 워커 작업(T-3-xxx·T-4-xxx)으로 쪼개고, 설계 문서에 비어 있던 항목을 오케스트레이터 결정(D-43~D-53)으로 채운다. Phase 2 계획([phase-2-plan.md](phase-2-plan.md))과 같은 방식이다. 결정을 바꾸려면 결정 로그에 사유를 남긴다.

투입 규칙: Phase 2 보드가 모두 done(또는 U-00x 대기 blocked)이고 **U-012(ADR-010 승인)가 닫힌 뒤** 트랙 A·B를 나란히 띄운다(D-32). 동시 워커 최대 3개(2026-09-05 D-59로 상한 해제 — 파일 소유권으로만 제한). 두 트랙은 서로 다른 상태 필드에만 쓰고, 공유 필드(Effect 규칙·시장가치 입력·CareerTag)는 ADR-010을 통해서만 바꾼다(D-53). 밸런스 수치는 LINE TEST 기준선 뒤로 조정할 수 있게 전부 룰셋 데이터로 둔다(로드맵 4번). 브리프는 웨이브가 열리기 전에 미리 쓴다.

## 1. 끝나면 보이는 것

**트랙 A**: 계약 마지막 시즌의 step 7 이적시장 창에서 SCR-017(계약 상태·사전 협상)과 SCR-019(루머·관심 태도)가 열린다. 시즌 결산 뒤 이적시장에서 역할·전술 적합도·출전 약속·경쟁 상황·리그 수준이 서로 다른 제안 최소 3개(재계약·완전 이적·임대·자유계약)를 비교하고, 한 제안에 한 번 협상한 뒤 확정하면 SCR-020(이적·임대 결과)이 이전/새 팀·계약·전술·경쟁자·남겨진 관계 변화를 보여주고 새 팀 프리시즌(SCR-005)으로 이어진다. 거절·만료·협상 실패에도 잔류 최소 제안이 항상 있다. 임대는 한 시즌 뒤 원소속 복귀 또는 완전 이적 옵션으로 닫힌다. 리그 이동이 Base OVR을 바꾸지 않는다.

**트랙 B**: 경기 중 부상이 MODERATE 이상이면 SCR-022(부상·재활)가 열려 조기 복귀·표준·보수 재활의 대가(복귀 범위·재발 위험·출전 기회)를 선택 전에 본다. 영구 능력 변화는 재활·재발 결과가 확정될 때만 생긴다. 슬럼프(SCR-021), 라커룸 갈등·주장 중재(SCR-018), 윤리·위기(SCR-016), SNS·평판(SCR-024)이 관계와 평판을 바꾸되 OVR을 직접 바꾸지 않고 source·이유 태그를 남긴다. 결산 때 감독이 바뀔 수 있고 새 감독이 선호 역할·신뢰·선발 순위를 다시 매긴다. step 8 대표팀 소집 창(SCR-032)에서 참가·사양의 대가를 고르고 대표팀 데뷔 챕터(MAJOR)가 예약된다. 대시보드 라커룸·휴대폰 구역이 관계 수치를 3단계로 점진 공개한다.

**교차**: 트랙 B의 `popularityCenti`가 트랙 A의 시장가치 입력이 되고(ADR-010 D-41 표), 트랙 A의 계약 약속 위반이 트랙 B의 관계 이벤트 입력(`contract.promiseBreaches`, 태그 `약속_위반`)이 된다. Phase 3·4 태그 10종의 평가기가 붙어 결산마다 부여된다.

## 2. 트랙과 작업

| ID | 트랙 | 패키지 | 작업 | 선행 | 웨이브 |
|---|---|---|---|---|---|
| T-3-001 | A | domain + contracts + content(스키마) | 계약·제안 v2 타입: `Offer.kind`(RENEWAL/TRANSFER/LOAN/FREE_AGENT)·유효기간·출전 약속·포지션 계획·`negotiation`, `Contract.loan`·`promiseBreaches`, `clubHistory[]`, 제안 상태기계(D-44), 타임라인 kind 예약(D-53), 조건 DSL `contract.*` 화이트리스트, `NEGOTIATE`·`REJECT_OFFER`·`LOAN_RETURN` payload 스키마(`UnknownPayloadSchema` 교체), golden hash 재생성 | U-012 | A1 |
| T-3-002 | A | domain + content(룰셋) | 결산 뒤 이적시장 생성(D-43): 시장가치 지수·구단 수요(`squadStrength`·tier·`reputation`)·태도 태그로 제안 4종 생성, 잔류 최소 제안 보장, 재계약 사전 협상(step 7), `offerRulesV2`·`transferRules` 룰셋 데이터, 제안 3개 비교 조건 골든 | T-3-001 | A2 |
| T-3-003 | A | domain | 명령 CMD-CON-001~004(D-44·D-45·D-46): `NEGOTIATE` 1회(roll 1)·역제안/철회, `ACCEPT_OFFER` v2 원자 전환(계약 종료·새 계약·팀 변경·context 재설정·관계 이월·`clubHistory`), `REJECT_OFFER`(개별/전부 → 잔류), 임대 계약·`LOAN_RETURN`(복귀/완전 이적), 약속 위반 → `promiseBreaches`·태그·관계 Effect(D-47), Phase 3 태그 평가기 5종(D-48), golden career-10-transfer·career-11-loan(3시즌) | T-3-002 | A3 |
| T-3-004 | A | contracts + api + engine-client | payload·상태 스키마 strict 검증, 동기화 3경로·Miniflare 회귀, Snapshot 크기 재측정(임대·clubHistory 포함), replay·fork 골든 | T-3-003 | A3 (T-3-003 뒤 짧게) |
| T-3-005 | A | web | SCR-017 계약 상태·FA(휴대폰 탭 상태 + step 7 사전 협상 결정 화면 + 결산 뒤 제안 비교 화면: CompareCards로 역할·전술 적합도·출전 약속·경쟁·리그·급여, 협상 1회, 유효기간 표시), SCR-019 루머·관심(EVT-CON 이벤트 변형 렌더링), SCR-020 이적·임대 결과(원자 저장·뒤로 가기 재협상 불가), 새 팀 프리시즌 진입(CHAPTER 기본), 응답 유실 복구, e2e TEST-E2E-003·axe | T-3-003, T-3-004 | A4 |
| T-3-006 | A | content | 팩 0.2.x: 루머·잔류 선언·에이전트 이벤트(EVT-CON), 협상·이적 결과 문구 토큰, 팀 풀 8→12 확장(U-013 확정) — 워커 작성분은 `PROTOTYPE`·`playtested: false` 표시(U-013 (A)) | T-3-001 | A2 (T-3-002와 병행 가능) |
| T-4-001 | B | domain + contracts + content(스키마) | 관계·부상·평판 타입(D-49·D-50): `relationshipLog[]`·`memoryTags`, `season.manager`(id·이름·선호 아키타입·재직 시즌), `health`(`InjuryEpisode`·`RehabPlan`·`recurrenceRiskBp`), `reputation.popularityCenti`, Effect kind `HEALTH`와 타깃(ADR-010 소유권 표 갱신), `RESOLVE_EVENT`가 `INJURY`·`NATIONAL_TEAM` pending을 닫는 규칙(D-52), 타임라인 kind 예약, DSL `health.*`·`relationships.*`·`season.manager.*` 화이트리스트, 확장 훅(`onMatchInjury`·`onSettlementRelations`) 골격 | U-012, **T-3-001 머지 뒤 리베이스** | B1 |
| T-4-002 | B | domain + content | 부상 모델(D-49): 경기 `injuredOff` → 심각도·부위 roll(matchRng), 진단 범위 → INJURY pending(MODERATE+)·EVT-INJ 이벤트 선택, 조기/표준/보수 재활 → 복귀 범위·재발 위험·`availability`, 재발 판정, 후유증 확정(PERMANENT, 재활 종료 시), 시즌당 강제 사건 상한, 재발 fixture 결정론, 복귀 첫 경기 MINOR 챕터 후보 | T-4-001 | B2 |
| T-4-003 | B | domain + content | 관계·평판 모델(D-50): 감독 교체(결산 판정·새 감독 생성·tacticalFit/managerTrust/선발 재평가), 라커룸·주장 중재·슬럼프·윤리·SNS 이벤트 pool과 조건(슬럼프는 최근 5경기 폼 파생 조건), `popularityCenti` 갱신 규칙, 관계 변화 source·reasonTag 로그·중복 Edge 금지, 단일 실패 이벤트 안전장치, Phase 4 태그 평가기 5종 | T-4-001 | B2 (T-4-002와 병행, 파일 분리: `injury.ts` vs `relationships.ts`·`manager.ts`) |
| T-4-004 | B | domain + content | 대표팀 차출 기본 모듈(D-51): step 8 자격 판정, NATIONAL_TEAM pending → EVT-NAT 이벤트(참가/사양/조건부), 부상 중 자동 사양, 체력 비용·협회(`agent`)·팬 관계·태그, 대표팀 데뷔 챕터 트리거 `NATIONAL_DEBUT`(MAJOR) 예약, `nationalityRuleState` 기본값(특례 없음) | T-4-002, T-4-003 | B3 |
| T-4-005 | B | web | SCR-022 부상·재활, SCR-021 슬럼프, SCR-018 라커룸(관계 방향·기억 태그·맥락 효과), SCR-016 윤리·위기, SCR-024 SNS·평판(외부 전송 없음), SCR-032 대표팀, 대시보드 라커룸·휴대폰 관계 수치 점진 공개 3단계, SCR-023 경기 판단 변형(챕터 옵션의 포지션군 표시), e2e TEST-E2E-004·axe | T-4-004 | B4 |
| T-4-006 | A+B | domain + web(e2e) | 트랙 통합 검증: 3시즌 fixture(이적 + 부상 + 감독 교체 + 대표팀) 결정론·hash, 리그 이동 전후 Base OVR 불변, 관계·평판이 OVR을 직접 바꾸지 않음(property), 시즌당 결정 수 예산(RULE-TIME-004) 측정, FAST/CHAPTER 세션 길이 재측정, Snapshot 크기, e2e 3회 무결점, Phase 3·4 완료 조건 표 | T-3-005, T-4-005 | 종료 |
| T-4-007 | B | web + ui | 디자인 PR #66 재통합(D-58): `design/tds-game-screens`에 최신 main merge, 충돌 3+파일 해결, T-3-005·T-4-004 화면의 새 디자인 정합, `check:contrast`·양쪽 e2e 통과 | T-4-004 | B4 앞(T-4-005 선행) |

투입 순서: T-3-001 → (T-4-001 리베이스, T-3-002, T-3-006) → (T-3-003, T-4-002, T-4-003) → (T-3-004 → T-3-005, T-4-004) → (T-4-007 ‖ T-4-006 domain) → (T-4-005) → T-4-006 e2e(D-58, 2026-09-05 갱신). 동시 3개를 넘지 않게 트랙 A의 A3·A4가 먼저 흐르고 트랙 B의 B2가 그 뒤 슬롯을 채운다. `packages/domain`의 `simulate.ts`·`types.ts`·`packages/contracts/career-state.ts`는 두 트랙이 다 만지므로 **타입 슬라이스(T-3-001, T-4-001)는 순차**로, 그 뒤 작업은 트랙별 새 파일(`transfer.ts`·`negotiation.ts` / `injury.ts`·`relationships.ts`·`manager.ts`·`national-team.ts`)에 두고 `simulate.ts`에는 훅 호출 한 줄씩만 추가한다.

## 3. 설계 결정 (초안 — 각 웨이브 투입 전 확정)

### D-43 팀 변경은 결산 뒤 이적시장에서만

- 한 FootballSeason 동안 `teamId`는 불변이다(02 문서 "동시에 하나의 활성 FootballSeason", 일정·경쟁자·경기 기록이 팀에 묶여 있음). 완전 이적·임대·자유계약·재계약 확정은 모두 `SETTLE_SEASON` 뒤 `START_SEASON` 전의 **이적시장 단계**에서 일어난다. 시즌 중 이적은 Phase 3 범위 밖(Phase 8 WORLD STAGE의 등록 창과 함께 재검토).
- step 7 이적시장 창(`leagueCalendar.transferWindowStep`)의 CONTRACT 슬롯은 두 가지만 연다: (a) 계약 마지막 시즌이면 **재계약 사전 협상**(현 구단의 RENEWAL 제안 1건, 수락하면 결산 뒤 시장을 건너뛰고 잔류 확정), (b) 관심 구단이 있으면 **루머·관심 태도** 이벤트(EVT-CON, SCR-019: 관심 표명/침묵/잔류 선언 → 태그 `이적_희망`·`잔류_선언`, 팬·감독 신뢰 소폭). 둘 다 없으면 슬롯은 지금처럼 자동 통과.
- 결산 뒤 이적시장은 `pending = { kind: 'OFFERS', market: {...}, offers: Offer[] }`로 연다(Phase 1 첫 계약과 같은 pending 종류, `nextAction: 'DECISION'`). 계약이 남아 있고(잔여 ≥ 1시즌) 관심 구단이 없으면 시장을 열지 않고 곧장 다음 시즌 준비로 간다.
- 계약 잔여 시즌은 ADR-010 유도식(`lengthSeasons − 서명 이후 SEASON_STARTED 횟수`)을 그대로 쓰고, 결산 시점 잔여 0이면 **만료**(FA)다. 만료 시즌의 결산 뒤 시장은 반드시 열린다.

### D-44 제안 v2·유효기간·협상 1회·안전 잔류

- `Offer` 확장: `kind`, `fromTeamId`(현 구단이면 RENEWAL), `validUntilRevision`(시장 pending 안에서 `NEGOTIATE`/`REJECT_OFFER` 한 번마다 revision이 오르므로 "revision 기준 유효기간"으로 만료를 표현, 기본 = 시장 열린 revision + 3), `appearancePromise: { squadRole, minutesShareBp }`, `positionPlan: Position`, `tacticalFitEstimate`, `competitorSummary: { rank, ovrGap }`(D-34 경쟁자 생성기를 미리 돌린 요약), `leagueTier`, `negotiable: { wage: boolean; role: boolean; length: boolean }`, `negotiationState: 'OPEN' | 'COUNTERED' | 'WITHDRAWN'`, 임대면 `loan: { parentTeamId, seasons: 1, wageShareBp, buyOptionMinor | null }`. 금액·비율은 정수(D-36).
- 시장 생성(T-3-002): 후보 팀 = 룰셋 `teams` 중 현 구단 제외, tier·`squadStrength`가 시장가치 지수(D-41) 구간에 맞는 팀. 제안 수 = `1 + 관심 구단 수(루머 태도 반영) + hasTag('에이전트_계약')`, 최소 1·최대 4, 종류 배분은 룰셋 `transferRules.kindWeights`(BENCH/RESERVE면 LOAN 가중 ↑, 잔여 계약 있으면 TRANSFER는 이적료 조건, 만료면 FREE_AGENT). rng 소비 순서는 D-9처럼 고정해 문서화한다.
- **안전 잔류 제안**: 시장이 열릴 때 항상 `RENEWAL`(계약 남았으면 "현 계약 유지" 0비용 항목, 만료면 현 구단 또는 tier 3 최저 조건 1시즌)이 목록에 있고 만료되지 않는다. 모든 제안을 거절해도 이 항목으로 닫힌다(Phase 3 완료 조건 2).
- **협상 1회**: `NEGOTIATE { offerId, ask: 'WAGE' | 'ROLE' | 'LENGTH' }`는 제안당 한 번. roll 1회를 `transferRules.negotiation[kind][ask]`의 성공 확률(구단 `reputation`·시장가치 대비 급여 위치로 보정)과 비교해 성공이면 `COUNTERED`(해당 항목 개선), 실패면 `WITHDRAWN`(그 제안 소멸, 다른 제안·잔류는 유지). 재시도 불가, cooldown은 같은 시장 안에서 같은 구단 재제안 없음.
- 상태기계는 phase-03 문서 그대로: GENERATED(시장 생성) → OFFERED → NEGOTIATING(명령 처리 중 개념, 저장 상태로는 COUNTERED/WITHDRAWN) → ACCEPTED / REJECTED / EXPIRED(유효 revision 초과 시 `ADVANCE`·다음 명령 처리 전에 정리).

### D-45 ACCEPTED 원자 전환

`ACCEPT_OFFER` 하나가 한 트랜잭션으로: 기존 계약 종료(`clubHistory`에 `{ teamId, fromSeasonIndex, toSeasonIndex, kind: 'PERMANENT' | 'LOAN', endReason: 'EXPIRED' | 'TRANSFERRED' | 'LOANED' | 'RETURNED' }`) → 새 `Contract`(임대면 원소속 계약은 `suspended: true`로 보존) → 팀·리그 변경 → `context` 재설정(`tacticalFit ← tacticalFitEstimate`, `squadStatus ← contractRules.squadStatusByRole[rolePromise]`, `positionProficiency`는 포지션 계획이 현재 주포지션이면 유지, 아니면 룰셋 `imposedProficiency`) → 관계 이월 표(감독 신뢰 ← `relationshipRules.newManagerTrustBase`, 주장·라이벌 ← 초기값, 팬 ← `이전 팬 × carryBp` ± 라이벌 구단 직행이면 급락, 에이전트 유지) → 타임라인 `TRANSFERRED`/`LOANED`/`CONTRACT_RENEWED`/`CONTRACT_SIGNED` → `pending = null`, nextAction `'ADVANCE'`(다음 시즌 준비). 재계약(RENEWAL)은 팀·context·관계를 건드리지 않고 계약만 바꾼다. 경쟁자·감독은 다음 `START_SEASON`이 새 팀 기준으로 생성한다(현행 구조 유지). 중복 명령(같은 `commandId`·revision 충돌)은 기존 멱등 규칙으로 계약이 겹치지 않는다(완료 조건 3).

### D-46 임대

- 기간 1시즌 고정(룰셋 `transferRules.loan.seasons`), 급여는 임대 구단이 `wageShareBp`만큼 부담(표시용, 계산에는 급여 총액만), 원소속 계약 잔여는 임대 시즌만큼 계속 소비된다(임대 뒤 잔여 0이면 복귀 대신 FA).
- 임대 시즌 결산 뒤 `pending = { kind: 'LOAN_RETURN', options: ['RETURN', 'PERMANENT'?] }` → `LOAN_RETURN { decision }`. `PERMANENT`는 제안에 `buyOptionMinor`가 있었고 임대 시즌 출전 비율이 `transferRules.loan.buyMinShareBp` 이상일 때만 열린다. 복귀하면 원소속 계약이 `suspended: false`로 돌아오고 새 시즌 준비, 완전 이적이면 D-45 전환.
- 임대 중 `squadRole`·경쟁자는 임대 구단 기준, `careerTags` TAG-LOAN-LEGEND 조건은 `clubHistory`의 LOAN 항목 + 그 시즌 `SeasonResult`로 판정.

### D-47 약속 위반과 이적의 관계·평판·시장가치 Effect

- `SeasonResult.promiseFulfilment.fulfilled === false`면 결산에서 `contract.promiseBreaches += 1`, 태그 `약속_위반`(시즌 태그) 부여, `RELATION managerTrust −8`(SUM, `reasonTag: 'PROMISE_BREACH'`). 이 값은 트랙 B 이벤트 조건(`contract.promiseBreaches ≥ 1`)의 입력이다(완료 조건 6).
- 이적 시: 라이벌 구단 직행이면 `RELATION fans` 급락(룰셋 `transferRules.rivalMoveFansDelta`)과 태그 `배신_이적`(TAG-TRAITOR 입력), 약속 위반 상태에서 이적하면 팬 관계 추가 하락. 잔류 선언 뒤 이적도 같은 취급.
- 시장가치는 상태에 저장하지 않고 요청 시 계산(ADR-010). 이적 결과 화면은 "이적 전/후 시장가치 지수"를 두 번 계산해 보여준다.

### D-48 Phase 3 태그 평가기

| 태그 | 코드화 조건 | 입력 |
|---|---|---|
| TAG-ONE-CLUB | `clubHistory` PERMANENT 항목이 하나뿐이고 프로 시즌 ≥ 8 | clubHistory, seasonHistory |
| TAG-JOURNEYMAN | PERMANENT 이적 횟수 ≥ 5 또는 서로 다른 구단 ≥ 6(임대 포함) | clubHistory |
| TAG-LOAN-LEGEND | LOAN 시즌 출전 비율 ≥ 70%·평균 평점 상위(`ratingTenths ≥ 70`), 복귀 다음 시즌 `squadRoleAtEnd === 'STARTER'` | clubHistory, seasonHistory |
| TAG-PROMOTION-EXPERT | 팀 최종 순위가 리그 `promotionSlots` 안인 시즌 ≥ 2, 그 시즌 `squadRoleAtEnd === 'STARTER'` (구단 tier 실제 변경은 Phase 6·8) | seasonHistory, leagues |
| TAG-TRAITOR | 태그 `배신_이적` 뒤 다음 시즌 팬 관계 ≤ 30 | clubHistory, relationships |

### D-49 부상 모델

- 발생: T-2-003의 `injuredOff`가 참인 경기에서 `matchRng`로 심각도 `MINOR`(1~2경기, 현행 availability만) / `MODERATE`(3~6) / `MAJOR`(7~14, 시즌 잔여 초과 가능) 와 부위(`KNEE`·`ANKLE`·`HAMSTRING`·`SHOULDER`·`HEAD`, 부위별 재발·후유증 표)를 뽑는다. 확률 표는 룰셋 `injuryRules`(`durability`·연령·fitness 보정).
- MODERATE 이상이면 그 step에 `pending = { kind: 'INJURY', step, episodeId, eventId, version }`(RULE-TIME-002 우선순위대로 챕터·이벤트보다 먼저), `RESOLVE_EVENT`가 이 pending을 닫는다(D-52). 선택지는 EVT-INJ 정의의 `rehabPlan: 'EARLY' | 'STANDARD' | 'CONSERVATIVE'`로 매핑되며 previewEffects에 복귀 범위·재발 위험·출전 기회를 반드시 표기한다.
- `health.episodes[]`: `{ id, severity, bodyPart, occurredAt: { seasonIndex, step, matchId }, diagnosisRange: { minMatches, maxMatches }, rehab, recurrenceRiskBp, status: 'ACTIVE' | 'REHAB' | 'RECOVERED' | 'RECURRED', permanentDelta: Array<{ key, delta }> | null }`. 복귀 날짜는 범위로 시작하고 재활 진행(step마다)으로 좁힌다. `availability.matchesRemaining`은 이 범위의 확정값을 따라간다(Effect kind `HEALTH`, 타깃 `availability.matchesRemaining`·`health.recurrenceRiskBp`).
- 재발: 복귀 뒤 `recurrenceWindowMatches` 안의 경기마다 `recurrenceRiskBp`로 판정(matchRng), 재발 시 심각도 한 단계 ↑. 후유증(PERMANENT ±1~2, `durability`·부위별 능력)은 **재활 종료(RECOVERED) 또는 재발 확정 시점에만** 적용한다(03 "큰 부상도 즉시 고정폭 감소시키지 않음").
- 시즌당 강제 사건(INJURY pending) 상한 2(RULE-TIME-004): 초과분은 pending 없이 STANDARD 재활로 자동 처리하고 타임라인에 남긴다. 단일 부상이 커리어를 끝내지 않는다(MAJOR 연속 상한·은퇴 판정은 Phase 5).

### D-50 관계·감독·평판 모델

- `relationships` 5축(감독·주장·라이벌·팬·에이전트, 0~100 정수)은 유지한다. `relationshipLog[]`(최근 40건: `{ target, delta, sourceId, reasonTag, seasonIndex, step }`)와 `memoryTags: Record<target, string[]>`(최근 3개)를 추가해 "같은 인물 관계 변화가 중복 Edge를 만들지 않는다"를 "축당 값 하나 + 로그"로 만족시킨다. 관계 Effect는 SUM만, OVR 타깃 금지(ADR-010 표).
- 감독: `season.manager = { id, name, preferredArchetypeIds, tenureSeasons, trustBase }`. 결산에서 `managerRules.changeProbability`(팀 최종 순위 vs `squadStrength` 기대 순위 차, 재직 기간)로 교체를 판정(결정 스트림 roll 1회)하고 새 감독을 생성하면 다음 `START_SEASON`이 `tacticalFit`(선호 아키타입 재평가)·`managerTrust ← trustBase`·선발 순위를 재평가한다(RULE-SEL-001 "감독 교체" 조항). 교체 직후 첫 경기는 MINOR 챕터 후보(03 표). TAG-MANAGER-FAVOURITE는 같은 `manager.id` 아래 신뢰 ≥ 80 시즌 3회.
- 평판: `reputation = { popularityCenti (0~10000), mediaCenti }`. 갱신 규칙은 결산(출전·평점·팀 성적)과 미디어·SNS 이벤트 Effect(신규 타깃 `reputation.popularityCenti`, kind `RELATION`의 타깃 확장 — ADR-010 표 갱신). `buildMarketValueInput`이 5000 고정 대신 이 값을 읽는다.
- 슬럼프: 조건 DSL `season.stats.recentFormAvg`(최근 5경기 평점 평균) 파생 필드를 추가하고 EVT-SLUMP 이벤트가 CURRENT/CONTEXT Effect로만 대응한다(Base OVR 직접 감소 금지).
- 윤리·위기·SNS: EVT-ETH·EVT-MEDIA 이벤트, 결과는 팬·감독·평판·태그. 실패 결과가 커리어를 막지 않도록 outcome 검증기가 "모든 FAIL outcome에 회복 경로(후속 이벤트 또는 만료)"를 요구한다.
- Phase 4 태그: GLASS-GENIUS(정찰 잠재력 상위 밴드 + MAJOR 부상 ≥ 3), MANAGER-FAVOURITE, LOCKER-LEADER(주장·부주장 3시즌 + `captain` ≥ 75 — 주장 임명은 결산 관계 판정으로 추가), COMEBACK(MAJOR 부상 뒤 다음 시즌 STARTER), CONTROVERSIAL(미디어·윤리 FAIL outcome ≥ 3).

### D-51 대표팀 차출 기본 모듈

- step 8 슬롯: 자격 = `baseOvr ≥ nationalTeamRules.minOvr[tier]` 또는 시즌 평점 상위 + `popularityCenti` 기준. 자격이면 `pending = { kind: 'NATIONAL_TEAM', step, eventId, version }`, 부상 중이면 자동 사양(타임라인 `NATIONAL_TEAM_DECLINED`, 이유 `INJURY`).
- 선택: 참가(체력 −, 팬·에이전트(협회 대리) +, 태그 `대표팀_소집`, `NATIONAL_DEBUT` 챕터 후보를 다음 챕터 슬롯에 예약) / 사양(협회·팬 관계 −, 감독 신뢰 불변 — 완료 조건 7) / 조건부(체력 −절반, 관계 +절반). 첫 참가는 대표팀 데뷔 챕터(MAJOR)를 연다(ChapterTrigger에 `NATIONAL_DEBUT` 추가, 상대는 `nationalTeamRules.opponents`).
- `nationalityRuleState`는 기본 모듈에서 빈 객체, 특례(병역 등)는 Phase 5 모듈이 붙기 전까지 선택지에 나타나지 않는다.

### D-52 명령 표면

- 새 서버 명령은 CMD-CON-001~004(`NEGOTIATE`·`ACCEPT_OFFER`·`REJECT_OFFER`·`LOAN_RETURN`)뿐이다(07 문서 표). 부상·슬럼프·관계·윤리·SNS·대표팀 결정은 모두 콘텐츠 이벤트 + `RESOLVE_EVENT`(CMD-EVT-001)로 닫는다. 이를 위해 `RESOLVE_EVENT`는 `pending.kind`가 `EVENT`뿐 아니라 `INJURY`·`NATIONAL_TEAM`(둘 다 `eventId`·`version`을 갖는다)일 때도 받는다. 화면(SCR-016/018/021/022/024/032)은 이벤트 정의의 `presentation`(신규 필드, `'INJURY' | 'SLUMP' | 'LOCKER_ROOM' | 'ETHICS' | 'MEDIA' | 'NATIONAL_TEAM' | 'RUMOUR'`)로 변형을 고른다.
- 이벤트 선택기(`selectEligibleEvents`)가 INJURY·NATIONAL_TEAM·RUMOUR 이벤트를 일반 EVENT 슬롯에 넣지 않도록 `presentation`이 있는 정의는 해당 pending 생성기만 고른다.

### D-53 트랙 경계·파일 소유권·타입 슬라이스

| 영역 | 트랙 A가 쓰는 곳 | 트랙 B가 쓰는 곳 |
|---|---|---|
| CareerState | `contract`, `clubHistory`, `pending OFFERS/CONTRACT/LOAN_RETURN`, `context.*`(이적 시 REPLACE — ADR-010 표대로) | `relationships.*`(SUM), `relationshipLog`, `memoryTags`, `health`, `reputation`, `pending INJURY/NATIONAL_TEAM` |
| FootballSeason | `market`(결산 뒤 시장 요약) | `manager`, `injuryCount`(강제 사건 상한) |
| 타임라인 kind(예약, T-3-001이 한꺼번에 추가) | `CONTRACT_RENEWED`, `TRANSFERRED`, `LOANED`, `LOAN_RETURNED`, `OFFER_REJECTED`, `OFFER_EXPIRED`, `NEGOTIATED` | `INJURED`, `REHAB_CHOSEN`, `RECOVERED`, `INJURY_RECURRED`, `MANAGER_CHANGED`, `NATIONAL_TEAM_CALLED`, `NATIONAL_TEAM_DECLINED`, `CAPTAIN_APPOINTED` |
| 룰셋 | `offerRulesV2`, `transferRules`, `relationshipRules.transferCarry` | `injuryRules`, `managerRules`, `relationshipRules`(나머지), `reputationRules`, `nationalTeamRules` |
| 새 파일 | `transfer.ts`, `negotiation.ts`, `market.ts` | `injury.ts`, `relationships.ts`, `manager.ts`, `reputation.ts`, `national-team.ts` |
| 공용(순차 수정만) | `types.ts`, `simulate.ts`(훅 호출), `settlement.ts`, contracts `career-state.ts`·`commands.ts`, content `condition.ts` 화이트리스트, `effect.ts` | 같음 |

- T-3-001이 두 트랙의 타임라인 kind·pending 필드·화이트리스트 항목을 **한 번에** 예약해 T-4-001이 타입 충돌 없이 리베이스한다. 이후 공용 파일 수정은 PR마다 `git merge origin/main` 뒤 전체 체인으로 확인한다(T-2-009 선례).
- 새 Effect 타깃(`reputation.popularityCenti`, `availability.matchesRemaining`, `health.recurrenceRiskBp`)은 트랙 B가 ADR-010 소유권 표를 갱신하는 커밋과 함께만 추가한다.
- `schemaVersion`은 1 유지(공개 출시 전, D-11·Phase 1 관례) — 새 필드는 전부 기본값이 있는 additive 필드로 두고 골든은 hash·신규 필드만 바뀌게 한다. 저장 상태는 정수만(D-36).

### D-56 DEV 전용 콘텐츠 팩 오버라이드 (2026-09-05, T-4-005)

- 활성 팩은 `0.1.0`(`apps/web/src/engine/versions.ts`)으로 유지한다 — LINE TEST(9/8~) 기준선이며 골든·밸런스를 바꾸지 않는다. Phase 4 이벤트(`SLUMP`·`LOCKER_ROOM`·`ETHICS`·`MEDIA`)와 `RUMOUR`는 0.2.0에만 있으므로, 화면 도달성은 **DEV 서버 전용** 오버라이드 `localStorage['offside:e2e-content-pack']`(`PACK_VERSIONS`에 있는 값만, `import.meta.env.DEV` 밖에서는 죽은 코드)로 만든다. 엔진 팩 로딩과 읽기 전용 팩 싱글턴은 같은 함수로 팩을 고른다. 오버라이드로 만든 커리어는 `contentPackVersion: '0.2.0'`을 저장하고 기존 0.1.0 커리어는 자기 팩으로 replay된다.
- 0.2.0의 실제 활성화(새 커리어 기본값)는 LINE TEST 기준선 확보 뒤 별도 결정으로 남긴다(T-3-005 보드 메모의 "RUMOUR 도달성 게이트"와 같은 항목).

### D-57 대시보드 관계·평판 점진 공개 3단계 (2026-09-05, T-4-005)

상태에서 파생하며 새 저장 필드는 없다. (1) 계약 전(`contract === null`): 라커룸은 기억 태그만, 휴대폰 잠김. (2) 첫 프로 계약 후 첫 결산 전(`seasonHistory.length === 0`): 관계 5축을 방향(↑/→/↓)·단계 라벨로만, 축별 `memoryTags`, 최근 관계 변화 3건, 휴대폰에 계약 요약·평판 단계. (3) 첫 결산 후(`seasonHistory.length >= 1`): 관계 0~100 정수와 인기(`popularityCenti/100`) 숫자 공개, 감독·재직 시즌·주장단 상태. 라벨 함수는 화면 한 곳(`shared/labels.ts`)에 두고 룰셋 상수로 만들지 않는다.

### D-58 디자인 PR #66 재통합 순서와 방식 (2026-09-05, T-4-007)

- 사용자의 디자인 PR #66(`design/tds-game-screens`, 19개 화면 480px 모바일 개편·앱형 모션, 기준 main `27292d4`)은 T-4-004(PR #68) 머지 뒤 **T-4-007**로 재통합한다: 같은 head 브랜치에 `origin/main`을 merge 커밋으로 합치고(rebase·force 금지, 사용자 커밋 SHA 보존) 충돌은 "기능은 main, 시각 구조는 design"으로 푼다. main에만 있는 T-3-005·T-4-004 화면은 새 디자인 계약으로 맞춘다. 워커는 PR 본문을 `PR_BODY.md`로 남기고 오케스트레이터가 PR #66 본문에 옮긴 뒤 squash 머지한다.
- 순서: T-4-007 → T-4-005(새 화면은 개편 디자인 위에서) → T-4-006. T-4-006의 domain·contracts 부분(1~4절)은 #68 뒤 T-4-007과 병행할 수 있고 web e2e 부분(5절)은 T-4-005 뒤에만 한다.

### D-59 병렬 투입 상한 해제와 파일 소유권 분할 (2026-09-05, 사용자 지시)

- 사용자 지시 "병렬 진행을 최대로"에 따라 동시 워커 수 상한(3개)을 없앤다. 병렬 조건은 파일 소유권뿐이다: 같은 파일을 만지는 작업은 순서를 정하고 뒤 작업이 `origin/main`을 merge한다.
- Phase 4 남은 작업을 소유권으로 쪼갠다: T-4-007(라우트·`packages/ui`·디자인 문서) ‖ T-4-006 domain(domain·contracts 테스트·fixture) ‖ T-4-008(`packages/content` 팩 0.3.0 신규 — 0.1.0·0.2.0 무변경으로 병행 fixture 보호) ‖ T-4-009(`apps/web/src/engine`·`shared/labels.ts`·e2e helper 신규) ‖ T-2-016(staging 리허설 config·spec). T-4-007·T-4-009 머지 뒤 T-4-005는 화면 묶음 3개로 다시 쪼개 병행한다: (a) SCR-022 부상·SCR-032 대표팀(pending INJURY·NATIONAL_TEAM), (b) SCR-016·018·021·024(EVENT presentation), (c) 대시보드 점진 공개·SCR-023 변형·SCR-014 결과 카드 — 공유 파일(`career-route.ts` 분기 맵)은 (a)가 먼저 등록하고 (b)·(c)는 그 뒤 merge한다.
- 감사·리뷰는 읽기 전용 워크플로(관점별 finder → 반박 검증)로 코드 작업과 병행한다.

### D-60 감사 정정: 감독 교체 roll·시장 파생 시드·재계약 시점 (2026-09-05, Phase 3·4 코드 감사)

- **D-50 정정(감독 교체 roll)**: "결정 스트림 roll 1회" 대신 `startSeason`의 match 스트림 선례처럼 **독립 파생 시드** `seedRng('manager:<seasonIndex>:<결정 스트림 상태>')`로 1회 roll한다. 메인 결정 스트림은 소비하지 않아 기존 골든의 `draws`·hash가 유지되고, 결정 스트림 상태 word를 복사해 재사용하는 방식(PR #67)은 금지한다 — 감독 교체 여부와 시장 첫 팀 추첨이 같은 word에서 나오는 상관을 없앤다(감사 C1).
- **T-3-002 §2 정정(시장 경쟁자 요약 시드)**: `market:${careerId}:${revision}:${teamId}`에서 careerId를 뺀다(결정 스트림 상태 기반). T-2-006 fork-by-replay 불변식("careerId만 다르다")을 시장 골든에도 적용하고 fork 골든 순회에 career-10을 넣는다(감사 C3). 시장 골든은 재기록.
- **D-43 (a) 구현 규칙**: step 7 재계약 수락은 다음 시즌 계약(`nextContract`)으로 보관했다가 결산의 약속 판정(D-47)이 기존 계약으로 끝난 뒤 교체하고, 재계약한 시즌의 결산은 시장을 열지 않는다(감사 F7·F8). EXPIRED 시장의 전부 거절은 안전 잔류 제안 체결과 같은 결과이고, FIRST_CONTRACT 시장은 전부 거절을 거부한다(감사 C4·C10·F6·C6). 빈 CONTRACT pending은 nextAction `'ADVANCE'`로 닫힌다(C7·F11).
- **D-45·D-46 보강**: 임대 뒤 원소속 만료 FA 경로는 원소속 stint를 다시 열지 않고 팬 이월은 1회만, `clubHistory` 불변식 `toSeasonIndex >= fromSeasonIndex`를 contracts에 추가한다(C5). 임대 복귀 시 원소속 감독 이력을 보존한다(F10).
- 작업: [T-4-012](briefs/T-4-012.md)(domain). 웹 문구(C8 RETURN 관계 문구)와 content(F1·F2·F4·C14)는 각 소유권 묶음에서 처리한다.

## 4. 완료 조건 → 작업

| 조건(phase 문서) | 검증 작업 |
|---|---|
| P3-1 역할·전술이 다른 최소 3개 제안 비교 | T-3-002 골든(제안 3개 이상, 역할·tacticalFitEstimate 상이) + T-3-005 e2e |
| P3-2 만료·거절·협상 실패에도 안전한 잔류/대안 | T-3-002 안전 잔류 제안, T-3-003 전부 거절·협상 실패 fixture |
| P3-3 이적 중 중복 명령으로 계약이 겹치지 않음 | T-3-003 멱등·revision 충돌 테스트, T-3-004 api 회귀 |
| P3-4 임대와 원소속 계약의 기간·급여 규칙 | T-3-003 career-11-loan 골든, `suspended` 불변식 |
| P3-5 리그 이동이 Base OVR을 직접 변경하지 않음 | T-3-003 property, T-4-006 3시즌 fixture |
| P3-6 계약 약속 위반이 다음 시즌 관계 이벤트 입력 | T-3-003 `promiseBreaches`·태그, T-4-003 조건 DSL 이벤트, T-4-006 |
| P4-1 같은 인물 관계 변화가 중복 Edge를 만들지 않음 | T-4-001·003 relationshipLog 불변식 |
| P4-2 감독 교체가 선호 역할·신뢰·출전 경쟁을 재평가 | T-4-003 골든(교체 전후 선발 순위) |
| P4-3 조기 복귀·단계 재활의 대가가 선택 전에 보임 | T-4-002 previewEffects 검증기, T-4-005 SCR-022 e2e |
| P4-4 부상 재발 fixture가 결정론적으로 재현 | T-4-002 career-12-injury 골든 |
| P4-5 관계·평판이 Base OVR을 직접 바꾸지 않음 | T-4-001 Effect 타깃 스키마, T-4-006 property |
| P4-6 단일 실패 이벤트가 강제 커리어 종료를 만들지 않음 | T-4-003 outcome 검증기(FAIL 회복 경로) |
| P4-7 대표팀 사양이 감독 신뢰가 아니라 협회·팬 관계에만 작용 | T-4-004 테스트 |
| 공통: 세션 길이·결정 예산 | T-4-006 측정(FAST 6분·CHAPTER 12분, 시즌당 결정 수 상한) |

## 5. 열린 질문 (트랙 투입 전에 닫는다)

| 질문 | 제안 | 담당 |
|---|---|---|
| U-012 ADR-010 승인 | **승인(2026-09-04 오전, 사용자)** → T-3-001 투입 | 사용자 |
| 워커가 Phase 3·4 이벤트 문구를 `PROTOTYPE`으로 작성해도 되는가(콘텐츠 백로그 "SHIPPABLE 전 JSON 요청 금지"와의 관계) | **(A) 확정(2026-09-04 오전, U-013)**: 메커니즘 검증용 최소 문구는 워커가 쓰고 `playtested: false`·`PROTOTYPE` 표시, 정식 문구는 콘텐츠 승격 뒤 교체(D-11 선례) | 사용자 |
| 팀 풀 8개로 시장 다양성이 충분한가 | **12개로 확정(2026-09-04 오전, U-013)**: tier별 가상 구단 추가(브랜드 어휘 준수)를 T-3-006에 포함, `squadStrength`·`reputation`·전술 스타일은 T-3-002 시장 생성이 읽는다 | 사용자·콘텐츠 |
| 시즌 중 이적(step 7 완전 이적) | Phase 3 제외(D-43), Phase 8 등록 창과 함께 재검토 | 오케스트레이터 |
| 부상 부위·심각도 확률, 감독 교체 확률, 협상 성공률 등 밸런스 수치 | 전부 룰셋 데이터, 초기값은 브리프 표로 제시하고 LINE TEST 기준선 뒤 조정 | 오케스트레이터 |
| 주장 임명 규칙(LOCKER-LEADER 입력) | 결산에서 `captain ≥ 70`·프로 시즌 ≥ 3·STARTER면 부주장 → 주장 승격, T-4-003에 포함 | 오케스트레이터 |
| 결산 뒤 다이어리 step 요약 유실(PR #45 후속) | **T-3-001에서 추가(PR #48)**: `SeasonResult.stepSummaries[]`(결산 step 제외 11개, `season.steps[].summary`와 동일 값) | 완료 |
