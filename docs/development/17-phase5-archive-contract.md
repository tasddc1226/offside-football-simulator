# 17. Phase 5 Archive 코어·버전·저장 계약

상태: T-5-002 독립 도메인 코어 구현, 저장 어댑터·API·은퇴 명령 미연결.
선행: [T-5-001](../tracking/briefs/T-5-001.md), [Phase 5 실행 계획](../tracking/phase-5-plan.md).
근거: FR-LEG-001, [저장·버전 정책](05-save-and-versioning.md), [Legacy 정본](14-legacy-score-and-endings.md), API-CAR-004·API-LEG-001~003.

## 1. 목적과 비목표

은퇴가 확정된 선수의 기록을 생성 당시 서비스 시즌·ruleset·content pack과 함께 봉인한다. 같은 요청의 재시도는 기존 기록을 재사용하고, 다른 내용을 덮어쓰지 않는다. Legacy 재평가는 새 버전의 별도 기록으로 남긴다.

이번 코드는 `packages/domain/src/legacy/`에만 존재하며 공통 domain barrel에 연결하지 않는다. DB 테이블·IndexedDB·HTTP endpoint·RETIRE 명령·화면은 구현하지 않는다. 기존 ACTIVE Career의 상태를 바꾸지도 않는다.

`CareerArchiveCore`는 최종 공개 Archive 응답이나 완전한 LegacyResult가 아니다. 런타임 Object.freeze와 순수 write policy는 DB 원자성·인가·부정행위 방지를 대신하지 않는다.

## 2. 데이터 경계

### CareerArchiveCore

| 필드                                        | 의미·소유권                                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| archiveSchemaVersion                        | 봉투 구조 버전. 현재 1만 지원                                                                                                       |
| archiveBuilderVersion                       | 집계·정규화 직렬화 알고리즘 버전. 현재 `1.0.0`만 지원                                                                               |
| archiveId                                   | Career ID와 Archive schema 1에서 결정론적으로 생성한 식별자. 동일 Career 내용 변경으로 새 ID를 발급해 덮어쓰기 제한을 우회하지 않음 |
| binding.careerId                            | 소유권 검증을 마친 Career 저장소의 ID                                                                                               |
| binding.createdServiceSeasonId              | 생성 당시 서비스 시즌. ACTIVE 포인터가 아니라 기존 Career 저장소에서 읽음                                                           |
| binding.rulesetVersion / contentPackVersion | Career 생성 당시 고정 버전                                                                                                          |
| artifacts                                   | 신뢰 가능한 불변 레지스트리에서 조회한 ruleset·pack 버전과 SHA-256 checksum                                                         |
| source                                      | 은퇴 revision, RETIREMENT checkpoint, stateHash, canonical state 문자열                                                             |
| records                                     | T-5-001의 확정 시즌 기반 통산·구단·포지션별 projection                                                                              |
| hash                                        | hash 자체를 제외한 코어 본문의 canonical JSON SHA-256                                                                               |

`source.state`에는 능력치·truePotential·관계·태그·계약·연대기 등 비공개 시뮬레이션 데이터가 포함된다. **GET 공개 선수 카드, 로그, analytics, 공유 이미지에 이 문자열을 그대로 내보내면 안 된다.** API·UI에서는 목적에 맞는 별도 projection을 만든다.

`ownerProfileId`, 수신 시각, UI 표시 엔딩, 동기화 상태는 코어 hash 밖의 저장 메타데이터다. 계정 병합으로 소유권을 이전해도 코어는 변경하지 않는다. 접근 허용은 별도 인증·인가 계층이 결정한다.

시각 입력을 빌더 안에서 생성하지 않는다. 최초 저장 시각은 저장 어댑터가 한 번 정하고 재시도 응답에서 기존 시각을 재사용한다.

### Legacy 평가 binding

`ArchiveLegacyBinding`은 미래 LegacyResult 행의 주소·버전 메타데이터다. 아직 점수·밴드·엔딩·기여 문구를 포함하지 않는다.

- 키: `archiveId + legacyVersion`에서 생성한 `evaluationId`.
- 보존: archiveId, archiveHash, rulesetVersion, legacyVersion, definitionChecksum, referencePopulationId, referencePopulationChecksum.
- 같은 버전에 정의 checksum·참조 분포 ID/체크섬이 바뀌면 conflict다. 새 버전을 발급해야 한다.
- 새 legacyVersion은 새 행에 저장한다. 코어와 이전 결과는 수정하거나 삭제하지 않는다.
- 표시용 엔딩 선택은 평가 결과와 별도로 저장하며 허용된 대표/후보 ID에서만 고른다.

아직 실제 Legacy 정의 manifest·참조 모집단 레지스트리는 없다. 테스트의 checksum과 참조 분포 ID는 명시적 fixture이며 실서비스 데이터로 사용하지 않는다.

## 3. 빌더·검증 규칙

`createCareerArchiveCore(snapshot, context)`의 전제는 기존 contracts 검증을 통과한 Snapshot이다. 전체 CareerState의 HTTP 스키마 validator를 이 순수 모듈에 중복 구현하지 않는다.

1. schemaVersion 1과 안전한 양의 revision만 받는다.
2. Career 저장소 binding, Snapshot 래퍼, 내부 state, artifact registry의 버전이 모두 일치해야 한다.
3. 내부 state를 canonical hash한 값이 Snapshot stateHash와 일치해야 한다.
4. checkpoint=RETIREMENT, status=RETIRED이어야 한다. ACTIVE/DRAFT/ARCHIVED를 자동 변환하지 않는다.
5. 확인된 선수 프로필이 존재하고 pending 및 진행 중 season이 없어야 한다. 진행 중 시즌을 버리고 은퇴시키지 않는다.
6. seasonHistory는 1부터 연속된 확정 기록이어야 한다. 중복·누락·재정렬은 거부한다.
7. timeline의 SEASON_STARTED/SEASON_SETTLED 개수가 seasonHistory와 일치해야 한다. 시작→결산→다음 시작의 revision 순서, 결산 revision과 해당 summary의 일치, 은퇴 revision 이전 확정을 검증한다.
8. 기존 T-5-001의 summary/result/hash 및 통산 집계 정합 검사도 수행한다.
9. 원본에서 완전히 분리한 깊은 readonly + 재귀 freeze 결과를 반환한다.

`verifyCareerArchiveCore`는 원본 state에서 코어를 재구성해 전체 canonical 내용과 비교한다. 공격자가 통산 수치를 고치고 바깥 hash까지 다시 계산해도 원본과 다른 projection은 거부한다. 그러나 공격자가 원본까지 일관되게 조작한 경우를 이 hash가 인증하지는 않는다. 보상 자격은 기존 검증 모드의 서버 재생·소유권 정책을 따른다.

이 검증은 보존된 history와 timeline 사이의 일치를 증명한다. 양쪽이 모두 삭제된 자료가 진짜 전체 커리어인지 증명하려면 저장소의 최종 revision·명령 로그·검증된 checkpoint가 필요하다. 따라서 API는 요청 본문의 binding을 믿거나 이 함수의 `ok`만으로 보상을 허용하면 안 된다.

초기 코어는 정산되지 않은 부분 시즌을 받지 않는다. 중도 은퇴 허용 여부와 부분 시즌 결산 방식은 T-5-003의 RETIRE 설계에서 확정한다. 지금의 거부 규칙을 “게임에서 시즌 중 은퇴가 영구 금지”라는 제품 결정으로 해석하지 않는다.

## 4. 저장 어댑터 계약 — 다음 통합 작업의 요구사항

`planCareerArchiveWrite(existing, candidate, context)`는 INSERT 또는 REUSE 계획만 반환한다. 네트워크·DB·락이 없다.

| 저장 상태                    | 요청                          | 결과                                                       |
| ---------------------------- | ----------------------------- | ---------------------------------------------------------- |
| 없음                         | 검증된 코어                   | INSERT 계획                                                |
| 동일 코어 존재               | 동일 내용 재시도              | REUSE, 기존 코어 반환                                      |
| 동일 Career에 다른 내용 존재 | 새 은퇴 revision/다른 기록 등 | ARCHIVE_CONFLICT, 덮어쓰기 금지                            |
| 기존 코어 손상               | 정상 새 내용                  | 기존 손상을 오류로 보고 복구 절차로 분기, 조용한 교체 금지 |
| 같은 Legacy 키 존재          | 다른 정의/참조 분포           | LEGACY_DEFINITION_CONFLICT                                 |

실제 어댑터가 구현해야 하는 순서:

1. 요청자의 Career 소유권과 저장소에 보존된 생성 당시 binding을 확인한다.
2. 원본 JSON의 엄격한 schema·바이트 상한을 검사하고, 생성 당시 artifact 버전/체크섬을 레지스트리에서 조회한다. 지원하지 않는 버전은 현재 버전으로 대체하지 않는다.
3. 은퇴 revision의 검증된 Snapshot과 요청 source가 일치하는지 확인한다. 이전 ACTIVE revision에 대한 요청·경합 중인 PUT을 막는다.
4. 저장소의 unique 제약으로 `careerId`/`archiveId`에 대해 insert-if-absent를 원자적으로 수행한다. 읽고 난 뒤 조건 없는 INSERT/UPSERT를 사용하지 않는다.
5. 경합으로 이미 행이 생겼으면 다시 읽고 write policy를 적용한다. 동일 내용은 기존 응답, 다른 내용은 conflict다.
6. 완전한 LegacyResult까지 준비된 후 코어·평가 결과·Career의 ARCHIVED 상태를 일관된 원자적 절차로 확정한다. 코어만 준비된 현재 모듈로 최종 은퇴 API를 활성화하지 않는다.
7. 계정 복구·병합은 소유권 메타데이터만 이전한다. 서비스 시즌 ID·ruleset·pack·Archive 본문은 그대로 둔다.

필수 어댑터 테스트: 동시 100회 동일 요청, 다른 내용 경합, DB write 실패/응답 유실, 코어 저장과 상태 전환 중간 실패, 구버전 복구, profile 병합, 다른 소유자 접근, 은퇴 이후 PUT 거부. **이번 순수 함수 테스트는 이 동시성·트랜잭션 테스트를 대신하지 않는다.**

## 5. 업적·통계 정본 및 남은 수집 공백

| 향후 Legacy 입력      | 현재 보존되는 근거                                       | 부족한 부분·다음 책임                                                      |
| --------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| 출전·평점·포지션 통계 | seasonHistory.result와 통산 projection                   | 포지션별 정규화 상한표(T-5-004)                                            |
| 임대·소속·계약        | result.teamId, clubHistory, 계약, timeline               | 실제 지급 수입은 별도 원장 필요. 계약액을 수입으로 대체하지 않음           |
| 팀 우승·승격·개인상   | 시즌 대회 결과 보존                                      | 승격·개인상 생성 기록과 증거 ID 소유권 확정 필요                           |
| 대표팀                | 차출 이력·데뷔 관련 상태·챕터                            | 소집≠출전. 실제 통산 A매치·국제대회 기록은 별도 필요                       |
| 부상·복귀             | health.episodes, timeline                                | 기간별 결장 분모·복귀 뒤 주전 시즌 판정은 evaluator에서 근거 연결          |
| 관계                  | 현재 관계·제한 길이 relationshipLog·시즌 감독 신뢰 delta | 전체 커리어의 5축 관계 평균은 아직 복원 불가. 시즌별 요약 수집 계약 필요   |
| 서사·태그             | careerTagGrants, timeline, 시즌 챕터                     | 같은 사건의 태그/챕터/트로피 중복을 막는 의미상 sourceId 매핑(T-5-004·005) |

raw state 보존을 “모든 업적 정본 수집 완료”로 간주하지 않는다. 없는 값은 0이라는 사실과 구별한다. 이 문서는 의미상 sourceId를 임의로 발명하거나 미발생 업적을 생성하지 않는다.

## 6. 버전·정정·크기

- 지원하지 않는 schema/builder는 명시적으로 거부한다. 향후 다른 버전을 지원할 때 기존 builder와 집계 알고리즘을 보존하고 버전별로 dispatch한다.
- 출력이 달라지는 집계 변경은 새 builder 버전이다. T-5-001의 집계 함수를 수정하면서 v1 검증에 새 계산을 몰래 적용하면 안 된다. 구버전 코드/fixture 보존은 다음 버전 추가의 필수 조건이다.
- 같은 ID의 코어 내용 정정·교체는 현재 미지원이며 conflict로 막는다. 정정이 필요하면 원본을 남기는 새 revision/supersedes 계약을 별도로 설계한다.
- 20개 시즌을 복제한 합성 fixture의 코어 크기를 테스트한다. 실제 20년 플레이의 이벤트·관계·로그가 포함된 크기 검증은 아직 없다.
- 기존 256KiB 요청 예산을 넘으면 코어를 잘라내지 않는다. 원본 보관 방식·전송 분할·사이즈 계약을 별도로 정해야 하며 이 작업은 요청 상한을 확대하지 않는다.

## 7. 이번 작업의 완료 범위

코어 생성·검증·동일 기록 재사용/충돌 판정, Legacy 버전 binding, 타입·단위 검증을 제공한다. DB·API·UI·실제 RETIRE·서버 replay·장기 업적 요약 수집은 미연결이다. T-5-002는 **독립 코어 완료와 실제 저장 통합 완료를 나눠 추적**한다.
