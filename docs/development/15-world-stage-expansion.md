# 15. WORLD STAGE 세계관 확장

## 목적과 경계

이 문서는 국내에서 시작한 한 선수의 커리어가 해외 리그, 대륙 클럽 대회, 국가대표 국제대회까지 이어지는 확장 계약의 정본이다. 개발 순서의 Phase 8은 선수 인생의 마지막 시기를 뜻하지 않는다. 운영 기반을 안정시킨 뒤 새 ruleset으로 Phase 3~5의 이적·시즌·대표팀 흐름을 넓힌다는 뜻이다.

첫 WORLD STAGE 릴리스는 실명 리그·구단·선수·엠블럼·유니폼을 사용하지 않는다. 유명 리그의 경기 문화와 커리어 선택 구조를 참고하되 명칭, 시각 자산, 역사, 라이벌 구도는 OFFSIDE의 독자적인 가상 세계관으로 제작한다.

## 사용자 약속

- 국내 잔류도 실패가 아니며 해외 진출과 동등한 엔딩 가치를 가진다.
- 해외 명문 벤치, 해외 중소 구단 주전, 국내 우승 경쟁 중 어느 하나도 항상 정답이 아니다.
- Base OVR은 국경이나 리그를 이동해도 바뀌지 않는다.
- 해외 성공은 OVR만이 아니라 전술 적합도, 출전 약속, 등록 가능성, 언어·문화 적응, 체력, 감독·에이전트 관계로 설명한다.
- 선수에게 공개하지 않은 자격 조건이나 확률로 계약을 무효화하지 않는다.

## 출시 슬라이스

| 슬라이스        | 범위                                         | 출시 게이트                |
| --------------- | -------------------------------------------- | -------------------------- |
| 8A 세계 모델    | 국가·리그·대회·구단 스키마, 구 Team 변환기   | 구 Snapshot 재생 hash 불변 |
| 8B 첫 해외 이적 | 해외 관심, 제안 비교, 등록 판정, 적응 계획   | 국내 잔류 포함 3경로 E2E   |
| 8C 국제 무대    | 대륙 클럽 대회와 대표팀 국제대회 챕터        | 일정 충돌·중복 통계 0건    |
| 8D 리그 확장    | 서로 다른 축구 문화를 가진 가상 리그 팩 추가 | 리그별 선택·완주 분포 검토 |

8B의 최소 콘텐츠는 해외 국가 2개, 국가별 2개 디비전, 디비전별 6개 구단, 대륙 클럽 대회 1개다. 8D에서 최대 5개 리그 스타일로 넓힌다. 모든 구단의 전체 경기를 개별 시뮬레이션하지 않고, 선수 소속 팀과 이적시장에 필요한 순위·대진만 결정론적으로 생성한다.

## 세계 데이터 모델

### DATA-WLD-001 Country

```ts
type Country = {
  id: string;
  nameKey: string;
  confederationId: string;
  currencyCode: string;
  languageGroupIds: string[];
  economicsIndex: number; // 0~100, 급여·시장 규모 보정
  registrationPolicyId: string;
};
```

### DATA-WLD-002 League

```ts
type League = {
  id: string;
  countryId: string;
  nameKey: string;
  tier: number;
  seasonModel: 'AUTUMN_SPRING' | 'SPRING_AUTUMN';
  leagueStrength: number; // 0~100, 기록·시장가치 정규화 입력
  registrationPolicyId: string;
  promotionLeagueId?: string;
  relegationLeagueId?: string;
};
```

### DATA-WLD-003 Competition

```ts
type Competition = {
  id: string;
  nameKey: string;
  scope: 'LEAGUE' | 'DOMESTIC_CUP' | 'CONTINENTAL_CLUB' | 'INTERNATIONAL';
  countryId?: string;
  confederationId?: string;
  competitionLevel: number; // 0~100
  schedulePriority: number;
  qualificationRuleId: string;
  formatId: string;
};
```

### DATA-WLD-004 Team 확장

기존 `Team` ID와 참조는 유지하고 `Club`로 일괄 개명하지 않는다. 콘텐츠 로더는 구 입력과 WORLD STAGE 입력을 모두 받은 뒤 도메인에는 정규화된 `WorldTeam`만 전달한다.

```ts
type LegacyTeam = {
  id: string;
  name: string;
  leagueTier: 'YOUTH' | 1 | 2 | 3;
  reputation: number;
  wageBandId: string;
};

type WorldTeam = {
  id: string;
  nameKey: string;
  shortNameKey: string;
  countryId: string;
  leagueId: string;
  reputation: number;
  wageBandId: string;
  financeBand: 'MODEST' | 'STABLE' | 'WEALTHY' | 'ELITE';
  tacticalIdentityId: string;
  squadPolicyId: string;
  brandAssetId: string;
};

type TeamInput = LegacyTeam | WorldTeam;
```

ruleset 1.x 변환기는 기존 `name`을 번역 fallback으로 보존하고 모든 팀을 `country-domestic`, `league-domestic-youth|1|2|3`에 결정론적으로 매핑한다. 변환 결과는 저장하지 않고 ruleset 로드 시 만든다. ruleset 2.x부터는 `WorldTeam`만 허용한다.

### DATA-WLD-005 RegistrationPolicy

```ts
type RegistrationPolicy = {
  id: string;
  foreignPlayerMode: 'OPEN' | 'SQUAD_QUOTA' | 'POINTS';
  squadQuota?: number;
  pointsRuleId?: string;
  minimumAge: number;
  registrationWindows: Array<{ startStep: number; endStep: number }>;
};
```

실제 국가의 법률을 실시간으로 복제하지 않는다. 게임 안에서 설명 가능하고 장기간 유지할 수 있는 가상 규칙을 사용한다.

### DATA-WLD-006 AdaptationContext

```ts
type AdaptationContext = {
  countryId: string;
  languageFamiliarity: number; // 0~100
  cultureFamiliarity: number; // 0~100
  relocationStability: number; // 0~100
  stepsInCountry: number;
  supportPlan: 'CLUB_SUPPORT' | 'PERSONAL_TUTOR' | 'FOOTBALL_FIRST';
};
```

적응은 `CONTEXT` 상태다. Base OVR, truePotential, 영구 능력을 직접 변경하지 않는다. 적응 실패는 Expected Performance, Morale, 감독 신뢰 획득 속도, 이벤트 조건에만 영향을 준다.

### DATA-WLD-007 해외 Offer·Contract 확장

해외 Offer는 기존 계약 정보에 다음 미리보기를 추가한다.

```ts
type OverseasOfferPreview = {
  countryId: string;
  leagueId: string;
  currencyCode: string;
  wageMinorPerWeek: number;
  normalizedWageIndex: number;
  registration: {
    status: 'ELIGIBLE' | 'CONDITIONAL' | 'INELIGIBLE';
    reasonCodes: string[];
    resolvesAtStep?: number;
  };
  adaptationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  playingTimeOutlook: number;
  nationalTeamOutlook: number;
};
```

계약 확정 뒤에도 원 통화와 등록 판정 근거를 재현할 수 있어야 한다.

```ts
type OverseasContractContext = {
  countryId: string;
  leagueId: string;
  currencyCode: string;
  wageMinorPerWeek: number;
  signingBonusMinor: number;
  registrationDecision: {
    policyId: string;
    status: 'ELIGIBLE';
    reasonCodes: string[];
    inputRevision: number;
  };
};
```

- `INELIGIBLE` 제안은 생성하지 않는다. 관심·루머 화면에서만 불가 사유를 보여줄 수 있다.
- `CONDITIONAL` 제안은 충족 조건, 판정 시점, 실패 시 안전한 대안을 계약 확정 전에 보여준다.
- `ACCEPT_OFFER`는 등록 재검증, 기존 계약 종료/정지, 새 계약, 팀·국가 변경, 적응 상태 생성, Timeline 기록을 하나의 결정론적 명령으로 확정한다.
- 조건부 등록이 실패하면 명령 전체를 롤백하고 Offer를 `REGISTRATION_FAILED`로 닫는다. 기존 계약과 팀은 유지한다.
- 서로 다른 통화의 숫자를 직접 크기만으로 비교하지 않는다. 원 통화 금액과 `normalizedWageIndex`를 함께 보여준다.

## 시뮬레이션 규칙

### RULE-WLD-001 OVR 불변

팀·국가·리그·대회 이동은 Base OVR을 직접 변경하지 않는다. 포지션 전환이나 훈련으로 영구 능력이 변했을 때만 기존 OVR 규칙으로 다시 계산한다.

### RULE-WLD-002 난이도 정규화

```text
NormalizedContribution = RawContribution
                       × LeagueStrengthFactor
                       × CompetitionLevelFactor
                       × ParticipationFactor
```

정규화는 시장가치, 수상 가치, Legacy 성취 입력에만 사용한다. 경기 당일 Expected Performance에는 상대 강도와 전술 맥락을 별도로 사용하며, `leagueStrength`를 이중 적용하지 않는다.

### RULE-WLD-003 적응 분리

```text
AdaptationModifier = language + culture + relocation + clubSupport + elapsedTime
```

적응 보정은 공개 가능한 원인 태그와 함께 Expected Performance에 적용한다. 성별, 국적 자체, 실제 인종을 능력 우열 보정에 사용하지 않는다. 국적은 등록 자격과 대표팀 자격의 입력일 뿐이다.

### RULE-WLD-004 자격 재검증

Offer 생성과 계약 확정 시 같은 ruleset의 등록 정책으로 자격을 계산한다. 판정 입력 Snapshot과 reason code를 저장하며 확정 후 재추첨하지 않는다.

### RULE-WLD-005 일정 우선순위

같은 step에 일정이 겹치면 `INTERNATIONAL > CONTINENTAL_CLUB > DOMESTIC_CUP > LEAGUE` 순서를 기본으로 하되, 차출 거부나 휴식 선택이 열린 경우 먼저 결정 화면을 제시한다. 한 출전이 두 대회 기록에 중복 집계되지 않아야 한다.

### RULE-WLD-006 경로 가치

해외 진출 여부 자체에는 Legacy 보너스를 주지 않는다. 대회의 수준, 실제 출전 비율, 역할, 성취를 평가한다. 국내 원클럽·국내 우승·해외 중소 구단 주장도 독립 엔딩 조건이 될 수 있다.

## 플레이 흐름

```text
SCR-029 커리어 대시보드
→ SCR-035 세계 무대·관심 현황
→ SCR-019 이적 루머 또는 기존 국내 제안
→ SCR-036 해외 제안 비교
→ CMD-CON-002 ACCEPT_OFFER
→ SCR-037 등록·이적 결과
→ SCR-038 현지 적응 계획
→ 기존 시즌 흐름 + SCR-039 국제 경기 챕터
→ SCR-040 월드 커리어 결산
```

해외 제안이 없거나 거절해도 SCR-017~020의 국내 경로로 계속 진행한다. 해외 진출은 엔딩을 여는 필수 관문이 아니다.

## 콘텐츠 저작 계약

- 리그별 차이는 단순 `leagueStrength` 숫자가 아니라 경기 템포, 압박, 기술, 수비 조직, 유소년 기회, 언론 압력의 조합으로 작성한다.
- 특정 실제 리그·구단의 이름, 약칭, 엠블럼, 유니폼 패턴, 경기장 외형, 역사적 별칭을 복제하지 않는다.
- 가상 국가를 만들 필요는 없지만 리그와 구단은 가상 브랜드를 기본값으로 한다.
- 해외 이벤트 선택지는 문화에 대한 고정관념을 웃음거리나 능력 페널티로 쓰지 않는다.
- 각 리그 팩에는 GK/DF/MF/FW별 유효 이벤트, 주전·로테이션·유망주 역할별 경로가 모두 있어야 한다.
- 번역 키가 없는 문구는 콘텐츠 검증에서 실패한다. 첫 출시는 한국어지만 모든 이름·설명은 `nameKey`로 참조한다.

## 버전·마이그레이션

- 세계 데이터와 판정 규칙 추가는 `schemaVersion`과 `rulesetVersion`을 올린다.
- 리그·구단·대회·이벤트 추가는 `contentPackVersion`을 올린다.
- ruleset 1.x Career는 기존 국내 세계에 고정해 그대로 재개한다. 플레이 중인 Career를 WORLD STAGE로 자동 승격하지 않는다.
- WORLD STAGE는 새 ruleset으로 만든 신규 Career부터 활성화한다. 구 Career를 복제해 새 규칙으로 시작하는 기능은 별도 명령 로그와 새 `careerId`를 요구하며 8A 범위에서 제외한다.
- Archive의 과거 팀 이름과 기록은 생성 당시 번들을 사용해 렌더링한다.

## 관측과 밸런스

개인 식별 정보 없이 아래 지표를 ruleset·리그·포지션별로 집계한다.

- 해외 관심 도달률, Offer 생성·수락·등록 실패율.
- 국내 잔류/해외 주전/해외 후보 경로 선택률.
- 이적 후 3·6·12 step의 출전 시간, Morale, 감독 신뢰, 재이적률.
- 리그별 시즌 완주율과 은퇴 전 이탈률.
- OVR band별 대회 출전·수상·Legacy 분포.
- 특정 국적·성별·포지션에 설명되지 않는 성공률 격차.

## 필수 검증

- `TEST-E2E-011`: 국내 첫 계약→해외 관심→조건 비교→등록 성공→현지 첫 시즌.
- `TEST-E2E-012`: 조건부 등록 실패→기존 계약·팀·revision 안전 복구.
- `TEST-E2E-013`: 리그·컵·대륙대회·대표팀 일정 충돌→한 경기만 집계.
- 구 ruleset 1.x 전체 fixture의 state hash가 확장 코드 도입 전과 같다.
- 같은 선수의 국내→해외 이동 직전·직후 Base OVR이 같다.
- 같은 선수에서 언어·문화 적응 값만 바꿔도 Base OVR과 영구 능력은 같다.
- 5개 리그 스타일 모두에서 네 포지션군이 한 시즌을 완주한다.
- 360px에서 세 해외 Offer의 급여·역할·등록·적응 비교가 가로 스크롤 없이 이해 가능하다.

## 범위 밖

- 실시간 환율·세금·이민 법률 연동.
- 실명 리그·구단·선수 라이선스.
- 전 세계 모든 경기와 순위의 완전 시뮬레이션.
- 실시간 PvP 이적시장과 다른 플레이어의 선수 거래.
- 국적 변경, 복수 대표팀 자격과 귀화의 고급 규칙.
- 여성·남성 대회를 능력 배율로 비교하는 모델. 별도 대회 세계관을 확장할 때도 동일한 OVR 원칙과 독립 밸런스 데이터를 사용한다.
