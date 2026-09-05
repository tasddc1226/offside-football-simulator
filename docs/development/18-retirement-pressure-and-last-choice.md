# 18. 은퇴 압력과 마지막 선택 — 독립 코어

상태: T-5-003의 독립 판정·선택 계획 구현. 실제 명령·저장·이벤트·화면 연결 전.
선행: [Phase 5 계획](../tracking/phase-5-plan.md), [Archive 계약](17-phase5-archive-contract.md).
근거: [Phase 5 은퇴 판정](../phases/phase-05-retirement-and-legacy.md), [성장·노쇠 정본](03-game-simulation-engine.md#성장과-노쇠).

## 1. 범위와 기존 성장식

`packages/domain/src/legacy/retirement.ts`는 은퇴 압력과 마지막 선택의 **계획**만 만든다. 공통 domain export·simulate·types·ruleset·contracts·content·DB·웹·기존 golden은 수정하지 않는다.

기존 `growth.ts:computeGrowth`와 시즌 결산에는 능력군별 연령 계수·연령 하락·훈련·출전·경험·잠재력 상한·centi 이월이 이미 있다. 새로운 노쇠 감소를 추가하면 기존 감소와 중복 적용되므로 이번에는 성장식을 변경하지 않는다. 20년 실제 엔진 완주, 성장 곡선 장기 밸런스 검증은 아직 남아 있다.

압력의 REVIEW는 RETIRED가 아니다. 단일 나이 또는 부상 요인만으로 REVIEW가 되도록 설정한 정책은 거부한다. 어떤 점수에서도 이 함수가 은퇴를 자동 확정하거나 능력치·OVR·RNG를 변경하지 않는다.

## 2. 입력 정본과 결측 구분

`RetirementFacts`는 호출자가 동일한 결산 평가 시점의 검증된 근거로 구성한다. 현재 CareerState에서 자동으로 만들어 주는 어댑터는 없다.

| 입력 | 단위·계약 |
| --- | --- |
| age / durability | 만 나이 정수 / 내구성 0~100. 성별·국적·숨은 Potential은 압력 입력이 아니다 |
| injuryMissedMatches / scheduledMatches | 해당 평가 시즌의 부상 원인 결장 / 해당 시즌의 선수 대상 경기 수. 벤치·미사용 교체·부상 에피소드 수를 결장으로 대체하지 않는다 |
| minutes / possibleMinutes | 같은 시즌·대회 범위에서 집계한 실제 출전 분 / 가능 분. 비율 0은 관측된 무출전이며 분모 0은 근거 부족이다 |
| eligibleOfferCount | 일반 시장 평가를 완료한 뒤의 유효 제안 수. 미평가·로딩·데이터 없음은 null이며 0으로 변환하지 않는다 |
| contractRemainingSeasons | 평가 시점에서 남은 계약 시즌 수. 임대 원소속/현 소속 계약을 검증한 어댑터가 산출한다 |
| intent | CONTINUE / UNDECIDED / RETIRE. 실제 선수 선택에서 읽으며 나이·부상으로 추론하지 않는다 |

부상 원인별 결장 분모는 현재 통산 projection에 없으므로 `outMatches`, `injurySubstitutions` 등을 대신 넣지 않는다. 시장의 미평가 상태도 독립적으로 보존한다. 모든 수치는 안전 정수여야 하고 출전·결장은 각 분모를 넘을 수 없다.

시장 평가가 없거나 경기/분 노출 분모가 0이면 `INSUFFICIENT_EVIDENCE`, total=null, factors=null과 결측 이유 목록을 반환한다. 선수의 명시적 은퇴 의향은 근거 부족과 별개로 마지막 선택 계획을 열 수 있으나, 진행 중 시즌이나 pending을 버릴 수는 없다.

## 3. 버전 정책과 설명 가능한 산식

운영 기본값을 코드에 넣지 않는다. 호출자는 생성 ruleset에 연결된 불변 `RetirementPolicy`를 제공해야 한다. 정책은 version, 연령 구간, 5축 가중치, 부상 결장 가중치, 미정 의향 값, WATCH/REVIEW 경계를 가진다.

```text
age         = 나이에 해당하는 fromAge 구간의 pressure
injury      = round(부상 결장률 × 결장 가중치 + (100 - 내구성) × 잔여 가중치)
market      = 유효 일반 제안 또는 잔여 계약이 있으면 0, 모두 없으면 100
opportunity = 100 - 출전 분 비율
intent      = CONTINUE 0 / UNDECIDED 정책값 / RETIRE 100
total       = round(sum(각 요소 × 해당 가중치) / 100)
```

비율은 0~100 정수로 먼저 반올림한다. 부상 내부 가중치 역시 /100을 적용한다. 최종 합산은 요소별 가중 점수를 미리 반올림하지 않는다. 비율 곱셈은 BigInt로 계산해 안전 정수 상한 근처에서도 정수 정밀도를 보존한다. 출력은 JSON 가능한 number·string만 사용한다.

- 가중치 합 100, 연령 구간 시작 0, 나이 증가·압력 비감소, 0~100 범위와 WATCH < REVIEW를 검사한다.
- total < WATCH는 CONTINUE, WATCH 이상 REVIEW 미만은 WATCH, REVIEW 이상은 REVIEW다.
- `factors`와 `contributions`에 원인별 수치와 정확한 가중 분자를 보존한다. 정책 version/hash와 facts hash를 함께 기록한다.
- 같은 version의 정책 hash 변경은 저장/레지스트리 계층에서 거부해야 한다. 순수 함수의 hash는 서명이나 레지스트리를 대신하지 않는다.

테스트 전용 표: age 0/30/34/38세부터 0/25/60/100, 가중치 25/20/20/20/15, 결장 가중치 70, 미정 의향 50, WATCH 40, REVIEW 65. **이 값은 단위 테스트 fixture이며 운영 밸런스 확정값이 아니다.** 실제 규칙 배포 전 포지션군·연령·계약·부상 시나리오별 분포를 검증하고 별도 정책 버전을 등록해야 한다.

## 4. 마지막 선택 계획

`createRetirementDecision`은 ACTIVE, pending 없음, 활성 시즌 없음인 안전한 경계에서만 동작한다. settledSeasonIndex=0은 첫 시즌 전 자발적 은퇴의 계획을 표현할 수 있지만 실제 저장 허용 여부는 후속 RETIRE 명령이 결정한다.

REVIEW 또는 명시적 RETIRE 의향일 때만 선택을 열고, 다음 순서로 옵션을 제공한다.

1. LAST_CONTRACT: 검증된 마지막 계약 제안 ID가 있을 때.
2. LOWER_LEAGUE: 검증된 하부리그 제안 ID가 있을 때.
3. COACH_EPILOGUE: 선수 생활 종료 후 코치 전환 서사. 코치 직장 계약이나 감독 시뮬레이션을 생성하는 기능이 아니다.
4. RETIRE: 은퇴 확인으로 진행.

일반 시장 수요와 마지막 기회를 위해 별도로 확보한 제안은 구분한다. 같은 offerId를 두 경로로 중복 노출하지 않는다. 제안이 존재하거나 하부리그 조건을 충족하는지는 문자열만 받는 이 모듈이 아니라 신뢰된 어댑터가 검증해야 한다. `lastChanceConsumed=true`이면 계약 연장 경로를 다시 열지 않는다.

decisionId는 커리어·평가 revision·시즌·근거·정책·옵션 전체를 hash한 ID다. 옵션이 바뀌거나 다른 revision이면 이전 선택을 새 계획에 적용할 수 없다. 반환값과 중첩 객체는 입력에서 분리해 freeze한다.

`resolveRetirementDecision`은 request의 decisionId와 expectedRevision을 계획에 대조한다. 허용되지 않은 선택, 다른 revision, 이미 결정한 다른 선택은 거부한다. 동일 선택 재요청은 REUSE다. INSERT/REUSE는 메모리상의 저장 계획이며 실제 저장이나 락이 아니다.

계약 선택은 CONTRACT_CONFIRMATION으로 이동할 계획만 만든다. `consumesLastChance`는 **계약이 실제 성공한 트랜잭션에서** 저장할 값이다. 미리보기·제안 거절·만료·실패 시에는 소비하지 않는다. 코치/은퇴 선택도 RETIREMENT_CONFIRMATION일 뿐 Archive 생성 완료가 아니다.

## 5. 엔진·저장 통합의 필수 조건

- 결산 1회당 압력 평가 1회, 실제 정책과 facts 생성 시점 고정. 같은 revision에 다른 입력으로 재평가 금지.
- 원본 Snapshot에서 boundary/facts를 생성하고 불변 정책 레지스트리로 plan을 재구성한다. 클라이언트가 보낸 plan·hash·offerId를 신뢰하지 않는다.
- 현재 저장 revision과 명령의 expectedRevision을 CAS로 대조한다. 이 순수 함수는 요청 revision을 **계획**과 대조할 뿐 최신 DB revision을 알지 못한다.
- 마지막 제안이 만료되면 이전 결정 레코드를 삭제하지 않고 명령 실패/재계획 계약으로 회수한다. 요청 재시도는 기존 명령 결과를 먼저 조회한다.
- 계약 성공·기회 소비·새 revision의 원자 저장, 응답 유실 재시도, 두 기기의 서로 다른 선택 경합을 검증한다.
- 마지막 계약의 기간 상한, 기회 소비 후 다음 시즌 평가 및 종료 조건, 자발적 은퇴 취소 시점은 실제 RETIRE·이벤트 구현 전에 확정한다. 현재 코어가 자동 종료 시기를 결정하지 않는다.
- 중도 은퇴는 미결산 시즌을 삭제하지 않도록 부분 시즌 결산 정책을 먼저 설계한다. 현재 코어의 경계 거부가 제품의 영구 금지 규칙은 아니다.
- RETIRE 성공 시 확정 기록 보존 → RETIRED snapshot → Archive/완전한 LegacyResult/ARCHIVED 상태의 원자 저장 계약을 적용한다. 은퇴 후 일반 명령 거부를 회귀 검증한다.

## 6. 검증 범위

단위 검증은 경계 나이·정수/결측·비율·합산, 단독 나이/부상 억제, 정책 drift, 무제안·기회 소진·자발적 은퇴, pending/활성 시즌 차단, 오래된 선택·다른 선택 충돌, 100회 재현성과 불변 입력을 포함한다.

실제 RETIRE 명령, 20년 엔진 플레이, DB 동시성, 서버 replay, 은퇴 화면·Legacy 엔딩을 테스트한 것은 아니다. Phase 5 전체 완료 조건은 그대로 남는다.
