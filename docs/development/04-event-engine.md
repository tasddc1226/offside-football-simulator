# 04. 이벤트 엔진

## 목적

이벤트를 코드 분기문이 아니라 버전 관리되는 데이터로 정의해 커리어 다양성, 공정성, 후속 서사를 확보한다.

## 이벤트 정의

```ts
type EventDefinition = {
  id: string;
  version: number;
  phases: CareerPhase[];
  triggers: Condition[];
  exclusionTags: string[];
  cooldown?: CooldownRule;
  weight: number;
  choices: EventChoice[];
  narrative: NarrativeTemplate;
};

type EventChoice = {
  id: string;
  riskLabel: 'LOW' | 'MEDIUM' | 'HIGH';
  previewEffects: EffectPreview[];
  outcomes: WeightedOutcome[];
};
```

## EVT 상태 전이

```text
ELIGIBLE → OFFERED → COMMITTING → RESOLVED
              └──────────────→ EXPIRED
```

- OFFERED 시점에 trigger context와 event definition version을 Snapshot한다.
- 결과 확정 후 definition이 바뀌어도 과거 결과는 변하지 않는다.
- 선택 가능 시간이 없는 싱글플레이 이벤트는 EXPIRED를 사용하지 않아도 된다.
- `FAST` 모드에서 열리지 않은 선택 이벤트는 ELIGIBLE에 머문 것으로 기록하며 roll을 소비하지 않는다. 노출되지 않은 이벤트는 cooldown을 시작하지 않는다.
- 이벤트 배치는 [시간 모델](11-time-model-and-pacing.md)의 step 결정 슬롯과 결정 예산 안에서만 일어난다.

`phases`의 값은 `CareerPhase`다.

```ts
type CareerPhase =
  | 'YOUTH' | 'PRESEASON' | 'IN_SEASON' | 'TRANSFER_WINDOW'
  | 'NATIONAL_TEAM' | 'REHAB' | 'SETTLEMENT';
```

`CareerPhase`는 이벤트 노출 창이고 `FootballSeason.phase`는 시즌 진행 상태다. 둘을 섞지 않는다. `REHAB`은 부상 재활 중에만 열리는 이벤트를 위한 값이다.

## 조건 DSL

최소 연산자는 `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `hasTag`, `all`, `any`, `not`이다. 허용 필드는 화이트리스트로 관리한다.

초기 화이트리스트:

| 접두 | 필드 예 |
|---|---|
| `career.*` | age, stage(`YOUTH`/`PRO`), currentRole, pathDecision, tags, proSeasons |
| `player.*` | preferredPosition, primaryPosition, positionGroup, archetypeId, baseOvr, attributes.* |
| `state.*` | form, fitness, morale |
| `context.*` | tacticalFit, managerTrust, squadStatus, competitionRank |
| `relationships.*` | managerTrust, captain, rival, fans, agent |
| `season.*` | step, phase, simulationMode, tags, stats.*, chapterHighlights |
| `contract.*` | monthsRemaining, rolePromise, wageBand |
| `health.*` | injuryEpisode, recurrenceRisk |
| `rng.*` | injuryRoll 같은 사전 추첨 값 |

종이 프로토타입이 쓰는 필드는 [콘텐츠 README](../content/README.md)에 있으며 pack으로 옮길 때 이 표에 없는 필드는 먼저 등록한다. 화이트리스트 상수는 `packages/content`가 소유하고 이 표와 같은 순서로 적는다. 나이는 `career.age` 하나만 쓴다(`player.age` 없음).

`player.gender`는 조건 DSL 화이트리스트와 Effect target에 넣지 않는다(RULE-PLY-001). 성별에 따라 사건의 성공 확률·보상·위험·계약 경로를 나누지 않는다. 포지션 전환처럼 최초 선호와 현재 역할의 차이가 서사 핵심인 이벤트만 `preferredPosition`과 `primaryPosition`을 함께 읽을 수 있다.

예시:

```json
{
  "all": [
    { "gte": ["career.age", 20] },
    { "eq": ["career.currentRole", "BENCH"] },
    { "gte": ["relationships.managerTrust", 40] }
  ]
}
```

임의 스크립트 실행과 DB 쿼리 문자열은 금지한다.

## 결과 해결

1. 선택 시점의 context hash를 확인한다.
2. 선택지의 조건부 outcome 가중치를 계산한다.
3. 고정 RNG stream에서 roll 하나를 소비한다.
4. outcome과 EffectQueue를 생성한다.
5. 후속 이벤트를 예약한다.
6. narrative token을 확정 값으로 렌더링한다. 조사 토큰 `{name:이/가}`, `{team:과/와}`는 렌더러가 받침을 판정한다.
7. Event, Career, Snapshot을 한 트랜잭션으로 저장한다.

## 공정성 규칙

- 선택 전 위험과 예상 효과를 알린다.
- 한 번의 강제 사건으로 커리어가 사실상 종료되지 않는다.
- 같은 사건 반복은 cooldown과 memory tag로 제한한다.
- 결과가 0이면 0과 미확정 애니메이션 값을 구분한다.
- 성공·중립·실패 모두 플레이어가 이해할 원인 문구를 가진다.
- 관계나 평판 효과가 Base OVR을 직접 변경하지 않는다.

## 이벤트군

| 군 | 예시 | 주요 효과 |
|---|---|---|
| 감독 | 면담, 전술 역할, 보직 변경 | 신뢰, 역할, 출전 경쟁 |
| 계약 | 재계약, 임대, 바이아웃 | 계약, 팀, 약속 |
| 관계 | 라커룸 갈등, 주장 중재 | 동료·주장 관계, 태그 |
| 부상 | 조기 복귀, 단계 재활 | Fitness, 재발 위험, 영구 능력 |
| 경기 | 데뷔, 더비, 결승 | 평판, 핵심 기록, 관계 |
| 미디어 | SNS, 인터뷰, 루머 | 팬·언론·감독 반응 |
| 국가대표 | 차출, 체력 관리, 국적별 특례 | 명성, Fitness, 커리어 태그, nationalityRuleState |
| 성장 | 포지션 고유 능력 추세, 재훈련, 역할 보완 | 세부 능력, 숙련도, 아키타입 표시 |

국가대표 이벤트는 Phase 4가 소유한다. 국적별 특례(예: 한국 병역)는 Phase 5의 국적 규칙 모듈이 조건과 효과를 제공하며, 모듈이 없는 국적에서는 특례 선택지가 생성되지 않는다.

## 콘텐츠 검증

배포 전에 자동 검사한다.

- ID와 version 중복 없음.
- 최소 하나의 outcome과 모든 가중치 합 > 0.
- 존재하지 않는 Effect·필드·narrative token 참조 없음.
- 후속 이벤트 순환은 명시적 최대 깊이 없이는 금지.
- cooldown 없는 고빈도 이벤트 경고.
- 선택지 간 동일 문구·동일 효과 경고.

## 운영 지표

- 이벤트 노출·선택·결과 비율.
- 조건을 만족하지만 한 번도 노출되지 않은 이벤트.
- 실패 결과 후 이탈률과 재시도율.
- 이벤트별 평균 OVR·관계·시장가치 delta.

지표는 밸런스 진단용이며 개인 결과를 서버에서 임의 교정하지 않는다.
