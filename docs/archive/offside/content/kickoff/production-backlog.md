# KICKOFF 콘텐츠 제작 백로그

이 문서는 [`event-catalog.md`](event-catalog.md)의 48개 항목을 실행 pack으로 옮기기 위한 순서와 인수 기준이다. 개발 세션과의 충돌을 피하기 위해 이 브랜치에서는 JSON, schema, 엔진 코드를 수정하지 않는다.

## 상태 흐름

```text
CONCEPT → PROTOTYPE → CANDIDATE → PLAYTESTED → SHIPPABLE → PACKED
```

| 상태 | 필요한 증거 | 다음 상태 승인 |
|---|---|---|
| `CONCEPT` | 한 줄 판타지와 대상 경로 | 콘텐츠 기획 |
| `PROTOTYPE` | 상황, 2~3 선택, 대가, 결과 원인 | 콘텐츠 기획 |
| `CANDIDATE` | 정식 ID, trigger, cooldown, Effect 분류, 안전 검토 | 기획+시스템 |
| `PLAYTESTED` | 사람 테스트 로그 3회, 미선택·오해 수정 | 콘텐츠 리드 |
| `SHIPPABLE` | 스키마·token·결정론·회귀 fixture 통과 | 개발+QA |
| `PACKED` | manifest와 checksum에 포함, 버전 고정 | 릴리스 담당 |

`PLAYTESTED`는 작성자가 문서를 읽어 본 것으로 대체할 수 없다. `PACKED` 뒤 결과가 달라지는 수정은 event version과 content pack version을 올린다.

## Wave 0 — U-005와 현재 10개 안정화

목표는 새 이벤트 추가가 아니라 현재 pack의 `playtested: false`를 사람 검증으로 닫는 것이다.

| 작업 | 대상 | 크기 | 완료 증거 |
|---|---|---|---|
| 세 회차 진행 | EVT-DEV-001/002, MGR-001, REL-001/002, INJ-001, CON-001/002/003, MEDIA-001 | L | 플레이테스트 로그 3회 |
| 선택 사각지대 수정 | 세 회차에서 선택 0회인 choice | M | 재테스트에서 자연 선택 1회 이상 |
| 문구·token 정리 | 현재 10개 전체 | S | 조사 결합 snapshot, 미정의 token 0 |
| Effect 감사 | 현재 10개 전체 | M | 관계·맥락이 Base OVR을 바꾸는 항목 0 |
| manifest 승격 판단 | pack 0.1.0 | S | U-005 판정과 checksum 기록 |

Wave 0가 닫히기 전에는 기존 이벤트 수치와 신규 이벤트를 한 번에 섞어 테스트하지 않는다.

## Wave 1 — 첫 계약과 낮은 OVR의 자리 경쟁

KICKOFF의 약속을 가장 짧은 세션에서 증명하는 필수 묶음이다.

| 우선 | 이벤트 | 이유 | 선행 조건 |
|---:|---|---|---|
| 1 | EVT-MATCH-001 데뷔전 첫 판단 | 첫 핵심 경기 기억 | 챕터 최소 구현 |
| 2 | EVT-MGR-002 첫 팀 조커 역할 제안 | Fit과 신뢰의 충돌 | 역할·신뢰 피드백 |
| 3 | EVT-MATCH-007 종료 직전 수비 | 수비 역할의 핵심 경기 기억 | 포지션별 판단 변형 |
| 4 | EVT-CON-004 첫 계약 역할 조항 | 계약 가치 충돌 | 제안 상세 화면 |
| 5 | EVT-CON-003 입단 테스트 결과 | 계약 없는 dead end 제거 | 테스트 계약 상태 |
| 6 | EVT-REL-004 경쟁자와 훈련 정보 공유 | 경쟁을 관계로 전환 | 경쟁자 관계 |
| 7 | EVT-DEV-003 반대발 훈련 | 아키타입 tradeoff | 세부 능력 성장 |
| 8 | EVT-MEDIA-002 데뷔·첫 기록 인터뷰 | 평판과 경기력 분리 | 미디어 건너뛰기 |

Wave 1 출구 조건:

- 계약 제안이 없는 Career에도 입단 테스트 또는 단기 계약 경로가 있다.
- Base OVR이 2 낮은 선수가 맥락으로 경쟁자를 앞서는 fixture가 존재한다.
- GK·DF·MF·FW에서 같은 흐름을 실행할 수 있고, 공격 기록을 요구하는 공통 조건이 없다.

## Wave 2 — 포지션군별 핵심 경기

| 묶음 | 우선 이벤트 | 포지션별 저작 초점 |
|---|---|---|
| GK | EVT-MATCH-001 데뷔, MATCH-007 종료 직전 수비, MATCH-008 승부차기 | 라인 컨트롤, 캐칭/펀칭, 방향 선점/반응 |
| DF | EVT-MATCH-002 더비, MATCH-003 컵 결승, MATCH-007 종료 직전 수비 | 커버/압박, 카드·공간 대가, 세트피스 |
| MF | EVT-MATCH-001 데뷔, MATCH-004 승격 결정전, MATCH-005 강등 탈출전 | 안전한 순환/전진 패스/볼 운반, 경기 템포 |
| FW | EVT-MATCH-002 더비, MATCH-003 컵 결승, MATCH-008 승부차기 | 슈팅 위치/동료 활용/오프사이드 위험 |
| 공통 | EVT-MATCH-006 국가대표 데뷔 | 단순 역할/개성/동료 연결을 포지션별 행동으로 번역 |

각 포지션군은 최소 3개의 전용 이벤트와 2개의 핵심 경기 챕터를 가진 뒤 출시 후보가 된다. 이름만 바꾼 동일 choice 세트를 포지션 전용으로 세지 않는다.

## Wave 3 — 장기 경로와 시즌 도전

| 경로 | 현재 카탈로그에서 쓸 이벤트 | 추가 제작 갭 | 연결 도전/태그 |
|---|---|---|---|
| 임대와 복귀 | MGR-006, CON-006, REL-004 | 임대 결산과 원소속 복귀 면담 2종 | CH-KO-002, TAG-LOAN-LEGEND |
| 포지션 전환 | MGR-005, DEV-004, MATCH 포지션 변형 | 전환 완료 확인과 대표팀 포지션 판정 | CH-KO-003 |
| 부상과 복귀 | INJ-002~006 | 복귀 뒤 선발 경쟁 후속 1종 | CH-KO-004, TAG-COMEBACK |
| 원클럽 경로 | CON-007 재계약 | 주장·재계약·후배 멘토링 장기 후속 3종 | CH-KO-005, TAG-ONE-CLUB |
| 무관의 기여 | REL-005/006, MEDIA-003/004, MATCH-003~005 | 우승 없이 남는 선택을 회수하는 결산 문구 | CH-KO-006, TAG-UNCROWNED |
| 국가대표 | NAT-001/002, MATCH-006 | 포지션 전환 이력에 반응하는 차출 변형 | CH-KO-003, END-NATIONAL-HERO |

장기 경로는 단일 이벤트로 태그를 즉시 주지 않는다. 서로 다른 시즌의 최소 2개 `sourceId` 또는 결산 통계가 조건을 뒷받침해야 한다.

위 추가 제작 갭은 48개 목표에 억지로 끼워 넣지 않는다. 사람 테스트 뒤 유지 가치가 확인되면 새 ID를 부여하고 카탈로그 총량과 커버리지 표를 함께 갱신한다.

## Wave 4 — 희귀도와 재방문성

- 같은 사건의 역할·배경별 문구 변형을 추가하되 효과만 같은 복제본은 만들지 않는다.
- 아키타입 24종 각각에 전용 서사 훅 최소 2개를 연결한다.
- 첫 계약 경로 4개, 공통 이벤트 24개, 포지션군별 전용 이벤트 5개를 목표로 확장한다.
- Career 한 개에는 콘텐츠를 모두 보여주지 않는다. cooldown, exclusion tag, event budget으로 경로 정체성을 유지한다.

## 이벤트 한 건의 산출물

파일 또는 이슈에는 아래가 함께 있어야 한다.

1. `EVT-군-번호`와 version, 상태.
2. 대상 phase·포지션·아키타입·나이·배경.
3. trigger, exclusion tag, cooldown, weight.
4. 상황 문장과 2~3개의 choice.
5. choice별 risk label, preview Effect, outcome weight.
6. outcome별 Effect 전체 메타데이터와 원인 문구.
7. 후속 event ID와 최대 깊이.
8. 성공·중립·부정 fixture와 경계값.
9. 안전·조사 token·실명 검토.
10. 연결 challenge/tag/ending과 중복 가산 방지 메모.

권장 이슈 제목:

```text
[CONTENT][KICKOFF][EVT-MATCH-002] 골키퍼 일대일 판단 후보 작성
```

## 개발 인계 계약

콘텐츠가 `SHIPPABLE`이 되기 전에는 개발자에게 JSON 구현을 요청하지 않는다. 인계 시 다음을 한 묶음으로 전달한다.

- 승인된 이벤트 표와 변경 불가한 ID/version.
- schema에 이미 존재하는 필드만 사용했는지 여부. 새 필드가 필요하면 별도 ADR/스키마 작업으로 분리.
- 세 개 이상의 deterministic fixture와 예상 hash 대상 상태.
- 필요한 narrative token과 한국어 조사 쌍.
- 분석 이벤트 속성. 자유 입력과 선수 이름은 제외.
- 연결된 화면 ID, challenge ID, tag/ending ID.

개발자는 문구를 임의로 축약하거나 Effect 분류를 바꾸지 않는다. 구현 제약이 있으면 JSON을 변형하기 전에 콘텐츠 상태를 `CANDIDATE`로 되돌리고 재검토한다.

## 병렬 작업 경계

| 콘텐츠 브랜치가 소유 | 개발 브랜치가 소유 |
|---|---|
| 콘텐츠 바이블, 카탈로그, 선택·문구 초안, 테스트 시나리오 | schema, API, DB, 엔진, UI, 실행 JSON |
| 사람 플레이 로그와 밸런스 제안 | 자동 fixture, checksum, 런타임 검증 |
| challenge 의도·조건 계약 | evaluator와 보상 idempotency |

이 브랜치는 검토되기 전까지 개발 세션이 가져갈 필요가 없다. 승인 뒤 이벤트 단위로 작은 구현 이슈를 만들고, 문서와 실행 JSON의 ID를 추적한다.

## 출시 전 최종 체크

- [ ] 현재 10개 이벤트의 U-005 사람 테스트 완료.
- [ ] 출시 대상 이벤트가 모두 `SHIPPABLE`이고 상태 근거가 있다.
- [ ] 이벤트별 선택률·노출률·결과 이해도가 목표 범위다.
- [ ] 네 포지션군의 전용 사건 최소량과 결정 시간이 비슷하다.
- [ ] 중대한 부상·정신건강·미성년 안전 규칙을 통과한다.
- [ ] 실제 구단·선수·감독 이름과 외부 URL이 없다.
- [ ] 관계·폼·평판이 Base OVR을 직접 바꾸지 않는다.
- [ ] challenge/tag/Legacy에 같은 source가 중복 가산되지 않는다.
- [ ] pack schema, narrative token, cooldown, follow-up cycle 검사가 통과한다.
- [ ] manifest version, ruleset 호환 범위, checksum, `playtested` 값이 증거와 일치한다.
