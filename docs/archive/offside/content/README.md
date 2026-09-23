# OFFSIDE 콘텐츠 정본

이 디렉터리는 이벤트·문구·룰셋 콘텐츠의 정본이다. 콘텐츠는 코드 분기가 아니라 버전 관리되는 데이터로 저작하며, 실행 규칙은 [`../development/04-event-engine.md`](../development/04-event-engine.md)를 따른다. 코드보다 먼저 종이로 플레이해 재미와 결정 밀도를 검증한다.

## 디렉터리 구조

```text
docs/content/
├─ README.md                        저작 형식과 체크리스트
├─ kickoff/                         SEASON 1 콘텐츠 제작·밸런스 패키지
│   ├─ README.md                    시즌 판타지, 최소량, 정본 우선순위
│   ├─ archetype-bible.md           ruleset 1.0.0 아키타입 24종
│   ├─ event-catalog.md             기존 10개 + 후보 38개 카탈로그
│   ├─ season-challenges-and-album.md 도전 10종과 개인 시즌 앨범
│   ├─ balance-targets.md           계약·선발·성장·Legacy 출시 게이트
│   ├─ paper-playtest-kit.md        U-005 사람 테스트 3회 진행 키트
│   └─ production-backlog.md        실행 pack 승격 순서와 인계 계약
├─ prototype/                       종이 프로토타입(코드 이전 검증)
│   ├─ season-01-inside-forward.md  아키타입 1개 · U18 한 시즌 · 이벤트 10개 · 챕터 3개
│   └─ playtest-log.md              (예정) 플레이 기록, 회차별 결정 수·시간·미선택 선택지
└─ (저작 문서만 둔다)

packages/content/                   실행용 원본([ADR-004](../adr/ADR-004-content-format.md))
├─ src/schema/                      Zod 스키마(정본)와 조건 DSL 화이트리스트
├─ packs/<contentPackVersion>/      content pack
│   ├─ manifest.json                pack 버전, 호환 rulesetVersion, checksum, playtested
│   ├─ events/*.json                EventDefinition
│   └─ narrative/*.json             token 사전
└─ rulesets/<rulesetVersion>/       역할 가중치, 성장 곡선, 선발 규칙 상수
```

## 이벤트 ID 체계

정식 ID는 `EVT-<군>-<번호>`다. 프로토타입 문서는 `EVT-P##` 임시 ID를 쓰며 pack으로 옮길 때 정식 ID를 재부여한다.

| 군 | 의미 | 예 |
|---|---|---|
| MGR | 감독 면담, 역할·보직 제안 | EVT-MGR-001 |
| CON | 계약, 임대, 이적, 입단 테스트 | EVT-CON-001 |
| REL | 라커룸, 주장, 경쟁자, 가족·에이전트 | EVT-REL-001 |
| INJ | 부상, 재활, 재발 | EVT-INJ-001 |
| MATCH | 핵심 경기 챕터와 경기 중 판단 | EVT-MATCH-001 |
| MEDIA | 언론, SNS, 팬 반응 | EVT-MEDIA-001 |
| NAT | 국가대표 차출, 대회 | EVT-NAT-001 |
| DEV | 성장 이슈, 슬럼프, 훈련 초점 | EVT-DEV-001 |

핵심 경기 챕터는 `CH-<번호>`로 별도 관리하며, 챕터 안의 경기 중 판단은 MATCH 군 이벤트로 저장한다.

## 이벤트 정의 필드

| 필드 | 필수 | 규칙 |
|---|---|---|
| id, version | MUST | pack 안에서 유일. 결과에 영향을 주는 수정은 version 증가 |
| phases | MUST | `CareerPhase`(YOUTH, PRESEASON, IN_SEASON, TRANSFER_WINDOW, NATIONAL_TEAM, REHAB, SETTLEMENT) 중 하나 이상. 시즌 step·phase 조건은 triggers의 `season.step`, `season.phase`로 쓴다 |
| triggers | MUST | 조건 DSL. 연산자는 eq, neq, gt, gte, lt, lte, in, notIn, hasTag, all, any, not |
| exclusionTags | SHOULD | 이 태그가 있으면 노출하지 않음 |
| cooldown | SHOULD | 같은 이벤트 재노출까지 최소 step 수 또는 시즌 수 |
| weight | MUST | 후보 간 추첨 가중치, 0 초과 |
| choices | MUST | 2~3개. 각각 id, riskLabel(LOW, MEDIUM, HIGH), previewEffects, outcomes |
| outcomes | MUST | 선택지마다 1개 이상. weight 합 0 초과. effects와 narrative 포함 |
| narrative | MUST | 상황 문장, 결과 제목, 원인 문구 |
| followUpEventIds | MAY | 예약할 후속 이벤트. 순환은 최대 깊이 명시 없이는 금지 |

모든 Effect는 `sourceId`, `delta`, `clamp`, `appliesAt`, `expiresAt`, `stackingRule`을 가진다. 분류는 PERMANENT, CURRENT, CONTEXT, RELATION, DEFERRED이며 RELATION과 CONTEXT는 Base OVR을 바꿀 수 없다.

## 저작 체크리스트

배포 전 자동 검사 항목은 04 이벤트 엔진과 같다. 저작자는 아래를 추가로 확인한다.

- [ ] ID와 version이 중복되지 않는다.
- [ ] 모든 선택지에 위험 라벨과 예상 효과 미리보기가 있다.
- [ ] 성공·중립·실패 결과 모두에 플레이어가 이해할 원인 문구가 있다.
- [ ] 선택지 간 문구와 효과가 동일하지 않다. 사실상 정답이 하나인 이벤트는 반려한다.
- [ ] 한 번의 강제 사건으로 커리어가 사실상 끝나지 않는다. 실패 결과도 다음 경로를 남긴다.
- [ ] 관계·평판·슬럼프 효과가 PERMANENT로 분류되지 않았다.
- [ ] 존재하지 않는 Effect 대상, 조건 필드, narrative token을 참조하지 않는다.
- [ ] 고빈도 이벤트에 cooldown이 있다.
- [ ] 후속 이벤트가 순환하지 않는다.
- [ ] 포지션 전용 이벤트가 다른 포지션에 같은 선택지로 나오지 않는다.
- [ ] 성별을 trigger·Effect·성공 확률·보상 차이에 사용하지 않았다. 서사는 성별 대명사 대신 `{name}`을 사용한다.
- [ ] 최초 선호 포지션과 현재 주포지션을 읽는 이벤트는 포지션 전환 서사이며, 두 필드를 혼동하지 않는다.

## narrative token 규칙

문장은 템플릿과 token으로 저작하고, 조사는 렌더러가 후처리한다. "팔콘스과" 같은 오류를 막기 위해 조사가 붙는 token은 반드시 조사 쌍을 명시한다.

| token | 예 | 렌더 결과 |
|---|---|---|
| `{name}` | `{name}` | 김서준 |
| `{name:이/가}` | `{name:이/가} 득점했다` | 김서준이 득점했다 |
| `{club:을/를}` | `{club:을/를} 떠난다` | 한강 FC를 떠난다 |
| `{manager}` | `{manager} 감독` | 정우성 감독 |
| `{delta:formatted}` | `폼 {delta:formatted}` | 폼 +8 |

token은 확정 값으로 렌더링한 뒤 Snapshot에 저장한다. 이후 정의가 바뀌어도 확정 문장은 유지한다.

## 안전 규칙

- 미성년 선수(18세 미만) 대상 이벤트에는 도박, 음주, 성적 맥락, 승부조작 가담 선택지를 넣지 않는다.
- 윤리·위기 이벤트는 희화화하지 않으며 설정에서 건너뛰기를 제공한다.
- 정신건강·장기 부진 묘사는 낙인 없이 쓰고 회복 경로를 반드시 남긴다.
- 실제 구단·선수·감독 실명을 쓰지 않는다.
- 외부 SNS 전송이나 실제 URL을 생성하지 않는다.

## 프로토타입

- [`prototype/season-01-inside-forward.md`](prototype/season-01-inside-forward.md): 종이·스프레드시트로 U18 한 시즌부터 첫 프로 제안까지 플레이하는 완결 콘텐츠.
- 플레이 결과는 `prototype/playtest-log.md`에 회차별로 기록한다. 기록 항목은 프로토타입 문서의 검증 질문과 같다.
- 프로토타입에서 검증한 이벤트만 pack으로 옮긴다. 옮길 때 임시 ID를 정식 ID로 바꾸고 04 검증 규칙을 통과해야 한다.

## SEASON 1: KICKOFF 제작 패키지

- [`kickoff/README.md`](kickoff/README.md): 시즌 1에서 제작할 콘텐츠의 범위와 완료 정의.
- [`kickoff/archetype-bible.md`](kickoff/archetype-bible.md): 24개 아키타입의 플레이 감각, 환경, 대가, 서사 훅.
- [`kickoff/event-catalog.md`](kickoff/event-catalog.md): 현재 구현 10개와 제작 후보 38개의 커버리지.
- [`kickoff/season-challenges-and-album.md`](kickoff/season-challenges-and-album.md): 개인 도전 10종, 판정 계약, 결산 앨범.
- [`kickoff/balance-targets.md`](kickoff/balance-targets.md): OVR·계약·선발·성장·부상·Legacy의 목표와 출시 중단선.
- [`kickoff/paper-playtest-kit.md`](kickoff/paper-playtest-kit.md): 고정 seed 3회 진행 절차와 인터뷰·합격 기준.
- [`kickoff/production-backlog.md`](kickoff/production-backlog.md): 사람 검증부터 실행 JSON까지의 단계별 인계 기준.

이 패키지는 실행 코드가 아니다. 개발 세션은 `SHIPPABLE`로 승인된 이벤트만 `packages/content/`에 옮긴다.
