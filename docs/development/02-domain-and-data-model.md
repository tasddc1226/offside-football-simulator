# 02. 도메인·데이터 모델

## 집합과 소유권

| 집합 | 정본 책임 | 대표 ID |
|---|---|---|
| LocalProfile | 비로그인 사용자와 커리어 목록 | `profileId` |
| Career | 한 선수 인생의 현재 상태·revision | `careerId` |
| Player | 정체성, 능력치, 포지션, 관계 | `playerId` |
| FootballSeason | 리그 한 해의 일정과 결산 | `footballSeasonId` |
| ServiceSeason | 서비스 콘텐츠 운영 기간 | `serviceSeasonId` |
| Contract | 소속·기간·보상·약속 | `contractId` |
| CareerEvent | 제시·선택·결과·효과 | `careerEventId` |
| Snapshot | 재개·재현 가능한 확정 상태 | `snapshotId` |
| Archive | 은퇴·시즌 결산 불변 기록 | `archiveId` |

## 핵심 엔터티

### DATA-PLY-001 Player

```ts
type Player = {
  id: string;
  name: string;
  birthDate: string;
  nationalityCode: string;
  preferredFoot: 'RIGHT' | 'LEFT' | 'BOTH';
  primaryPosition: Position;
  positionFamiliarity: Record<Position, number>;
  archetypeId: string;
  attributes: PlayerAttributes;
  truePotential: number;
  scoutedPotentialMin: number;
  scoutedPotentialMax: number;
  baseOvr: number;
  form: number;
  fitness: number;
  morale: number;
};
```

`truePotential`은 서버 정본이며 사용자에게 직접 노출하지 않는다. 정찰 정확도가 올라갈수록 공개 범위만 좁아진다.

### DATA-CAR-001 Career

```ts
type Career = {
  id: string;
  ownerProfileId: string;
  playerId: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED' | 'ARCHIVED';
  revision: number;
  currentDate: string;
  currentTeamId?: string;
  currentRole?: SquadRole;
  footballSeasonId?: string;
  createdServiceSeasonId: string;
  rulesetVersion: string;
  contentPackVersion: string;
  rngState: RngState;
  nationalityRuleState: Record<string, unknown>;
  ageReferenceDate: string;
  createdAt: string;
  updatedAt: string;
};
```

Career가 생성되면 세 버전 필드는 불변이다. 운영 시즌 전환은 기존 Career의 버전을 덮어쓰지 않는다.

```ts
type SquadRole = 'STARTER' | 'ROTATION' | 'BENCH' | 'RESERVE';
```

`SquadRole`은 시즌 단위의 스쿼드 지위다. 경기 단위의 선발·교체 출전·결장(RULE-SEL-001 결과)은 `MatchAppearance`(`START`, `SUB`, `OUT`)로 따로 기록하며 둘을 섞지 않는다.

`nationalityRuleState`는 국적 규칙 모듈이 소유하는 상태다. 한국 모듈은 병역 상태와 특례 이력을 여기에 둔다. 모듈이 없는 국적은 빈 객체다. `ageReferenceDate`는 [시간 모델](11-time-model-and-pacing.md)의 나이 기준일이다.

### DATA-PRO-001 LocalProfile

```ts
type LocalProfile = {
  id: string;
  recoveryCodeHash?: string;
  recoveryCodeIssuedAt?: string;
  googleSub?: string;
  email?: string;
  linkedAt?: string;
  tossAnonKeyHash?: string; // 앱인토스 식별키의 서버 측 해시. 원문은 저장하지 않는다
  tossLinkedAt?: string;
  settings: ProfileSettings;
  createdAt: string;
  lastSeenAt: string;
};

type CommandLogEntry = {
  careerId: string;
  revision: number;
  commandId: string;
  commandType: string;
  payload: Record<string, unknown>;
  resultHash: string;
  createdAt: string;
};

type ProfileSettings = {
  reducedMotion: 'SYSTEM' | 'ON' | 'OFF';
  textScale: 100 | 125 | 150;
  theme: 'SYSTEM' | 'LIGHT' | 'DARK';
  defaultSimulationMode: 'FAST' | 'CHAPTER';
};
```

복구 코드 원문은 저장하지 않는다. 해시만 저장하고 발급 시각으로 재발급 여부를 판단한다. Google 연결 필드는 [ADR-008](../adr/ADR-008-auth-and-account-merge.md)을 따른다. `CommandLogEntry`는 로컬과 서버에 같은 형태로 저장되며 리플레이 검증의 입력이다.

### DATA-SEA-001 FootballSeason

```ts
type FootballSeason = {
  id: string;
  careerId: string;
  label: string;
  yearStart: number;
  phase: 'PRESEASON' | 'LEAGUE' | 'CUP' | 'TRANSFER_WINDOW' | 'SETTLEMENT';
  simulationMode: 'FAST' | 'CHAPTER';
  currentStep: number;
  steps: SeasonStep[];
  teamId: string;
  squadRole: SquadRole;
  competitionRecords: CompetitionRecord[];
  effectQueue: Effect[];
  result?: SeasonResult;
};

type SeasonStep = {
  index: number;
  phase: FootballSeason['phase'];
  windowOpen: boolean;
  decisionSlots: DecisionSlot[];
  summary?: StepSummary;
};

type DecisionSlot = {
  kind: 'EVENT' | 'CHAPTER' | 'CONTRACT' | 'ROLE' | 'INJURY' | 'NATIONAL_TEAM' | 'SETTLEMENT';
  required: boolean;
  importance?: 'MAJOR' | 'MINOR';
  refId?: string;
};
```

step과 모드의 의미는 [시간 모델](11-time-model-and-pacing.md)을 따른다. `steps`는 시즌 시작 시 리그 캘린더로 생성되며 이후 슬롯의 `refId`만 채워진다.

### DATA-SVC-001 ServiceSeason

```ts
type ServiceSeason = {
  id: string;
  name: string;
  status: 'PRESEASON' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED';
  startsAt: string;
  endsAt: string;
  rulesetVersion: string;
  contentPackVersion: string;
  challengeSetId: string;
};
```

### DATA-EVT-001 CareerEvent

```ts
type CareerEvent = {
  id: string;
  definitionId: string;
  careerId: string;
  status: 'OFFERED' | 'RESOLVED' | 'EXPIRED';
  contextSnapshot: Record<string, unknown>;
  choiceId?: string;
  roll?: number;
  outcomeId?: string;
  effects: Effect[];
  followUpEventIds: string[];
};
```

## 능력과 상태의 분리

- 영구 능력: 기술(슈팅, 패스, 드리블, 태클, 퍼스트터치, 크로스, 골키핑), 신체(속도, 가속, 민첩, 점프, 체력, 몸싸움, 내구성), 정신(판단, 집중, 침착, 위치선정, 리더십, 꾸준함)의 세 묶음만 `attributes`에 둔다. 관계는 능력치 묶음이 아니다.
- 단기 상태: Form, Fitness, Morale.
- 맥락 상태: 전술 적합도, 포지션 숙련도, 감독 신뢰, 주전 경쟁 순위.
- 관계 상태: 감독·동료·경쟁자·팬·에이전트 관계.
- 계산 값: Base OVR, Expected Performance, Market Value Index, Legacy Score.

계산 값은 입력 정본과 사용한 규칙 버전을 함께 저장하거나 재현 가능해야 한다.

## EffectQueue

| 분류 | 예 | 적용 시점 |
|---|---|---|
| PERMANENT | 영구 세부 능력 변화 | 훈련·재활 확정 |
| CURRENT | 폼·체력·사기 | 즉시·경기 후 |
| CONTEXT | 전술·역할·팀 | 감독/팀 변경 |
| RELATION | 감독·동료·팬 | 이벤트 결과 |
| DEFERRED | 다음 시즌 보정 | 지정 시즌 시작 |

모든 Effect는 `sourceId`, `delta`, `clamp`, `appliesAt`, `expiresAt`, `stackingRule`을 가져야 한다.

## 주요 불변 조건

- OVR과 모든 0~100 상태는 정의된 범위를 벗어나지 않는다.
- 한 Career에는 동시에 하나의 활성 FootballSeason만 있다.
- 확정된 CareerEvent는 다시 추첨하지 않는다.
- Contract 기간은 겹칠 수 없으며 임대는 원소속 계약을 참조한다.
- RETIRED Career는 일반 진행 명령을 받지 않는다.
- Archive는 생성 후 불변이며 정정은 새 버전으로 남긴다.
- `currentStep`은 시즌 안에서 단조 증가하며 되돌아가지 않는다.
- 한 LocalProfile의 유효한 복구 코드는 동시에 하나다.

## 인덱스와 보존

- `Career(ownerProfileId, updatedAt)`
- `Career(createdServiceSeasonId, status)`
- `Snapshot(careerId, revision unique)`
- `CareerEvent(careerId, status)`
- `Idempotency(ownerProfileId, idempotencyKey unique)` — 서버는 HTTP `Idempotency-Key` 단위로 최초 응답을 저장한다. 명령 단위 멱등성은 로컬 엔진의 idempotency 테이블과 `CommandLog(careerId, revision unique)`가 맡는다(T-0-005, 2026-09-02)
- `CommandLog(careerId, revision unique)`
- `LocalProfile(googleSub unique)`
- `LocalProfile(tossAnonKeyHash unique)`
- `SeasonArchive(serviceSeasonId, ownerProfileId unique)`

서버는 Career당 최신 Snapshot과 최근 checkpoint 5개, 전체 명령 로그를 D1에 두고, 오래된 Snapshot과 은퇴 커리어의 명령 로그는 R2로 옮긴다.

익명 프로필 삭제 요청 시 활성 데이터는 삭제하되, 집계 데이터는 개인 식별이 불가능한 형태만 유지한다.

