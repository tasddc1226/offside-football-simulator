# 08. 테스트 전략

## 품질 목표

가장 위험한 오류는 화려한 화면 문제가 아니라 장기 커리어 저장 손상, 결과 재추첨, 버전 전환 후 재현 실패다. 테스트 우선순위를 이 위험에 맞춘다.

## 테스트 층

2026-09-05 CI 경량화 승인: 아래 표는 검증 종류의 기준이고, 자동 실행 빈도는
[CI와 staging 운영 정책](../operations/ci-and-staging.md)이 우선한다. PR은 정적 검사만,
main은 기존 핵심 저장/재생 검사와 빌드 후 staging 배포·작은 API/UI 스모크를 수행한다.
전체 회귀·기본 E2E·밸런스 배치는 필요 시 수동/릴리스 전 실행하며 기존 테스트를 삭제하지 않는다.

| 층 | 대상 | 실행 시점 |
|---|---|---|
| Unit | OVR, 성장, 조건 DSL, Effect | 매 커밋 |
| Property | 범위·불변식·확률·결정론 | 매 PR |
| Contract | API, 콘텐츠 스키마, 저장소 | 매 PR |
| Integration | 명령→도메인→DB 트랜잭션 | 매 PR |
| E2E | Phase별 사용자 여정 | main/배포 전 |
| Migration | 구 Snapshot과 스키마 | 배포 전 |
| Accessibility | 키보드·스크린리더·모션 | PR/릴리스 |
| Performance | 시즌 결산, 목록, 초기 로드 | 릴리스 후보 |
| Channel (toss) | `platform/toss` 어댑터 모킹(`@apps-in-toss/devtools`), `.ait` 빌드, QR 실기기 체크리스트 | PR(모킹)/릴리스 후보(실기기) |

## 필수 불변식

- 모든 능력·상태가 정의 범위에 있다.
- 동일 입력·seed·버전의 state hash가 같다.
- 이미 해결된 이벤트는 새 roll을 소비하지 않는다.
- Career revision은 확정 명령마다 정확히 1 증가한다.
- 계약 기간과 활성 FootballSeason이 중복되지 않는다.
- 은퇴 후 일반 진행 명령이 거부된다.
- 서비스 시즌 변경이 기존 Career 버전을 바꾸지 않는다.
- `currentStep`은 시즌 안에서 되돌아가지 않고, 결정이 없는 step은 roll을 소비하지 않는다.
- 같은 fixture의 state hash가 브라우저 Web Worker, Node(Vitest), Cloudflare Workers(Miniflare)에서 모두 같다.
- 명령 로그를 처음부터 재생한 결과가 저장된 Snapshot의 hash와 같다.
- 관계·평판·챕터 결과가 Base OVR을 직접 바꾸지 않는다.
- 같은 seed와 나머지 생성 입력에서 `gender`만 바꿔도 능력·잠재력·RNG draw 수·제안·Legacy 결과가 같다.
- 포지션 전환 뒤 `preferredPosition`은 불변이고 `primaryPosition`과 숙련도만 바뀐다.
- 같은 Archive와 legacyVersion의 Legacy 결과가 같고 모든 Career가 엔딩을 받는다.
- 국가·리그 이동 전후 Base OVR과 영구 능력이 같다.
- 등록 실패는 기존 계약·팀·적응 상태를 변경하지 않는다.
- 한 출전은 리그·컵·대륙대회·대표팀 중 정확히 한 CompetitionRecord에만 집계된다.
- ruleset 1.x Team 호환 어댑터 적용 전후 구 Career state hash가 같다.

## Golden fixtures

`fixtures/`에 다음을 버전 관리한다.

- 포지션·역할별 OVR 계산 선수.
- RULE-SEL-001 계산 예의 선수 A·B 선발 비교 시즌.
- 종이 프로토타입의 선수·팀·이벤트 10개·챕터 3개를 content pack으로 옮긴 fixture.
- 전체 벤치, 부상, 퇴장, 임대가 포함된 시즌.
- 10시즌 성장·노쇠 커리어.
- ruleset 1.0.0으로 생성한 은퇴 Career Snapshot.
- KICKOFF 도전 6개를 각각 완료/미완료한 사례.

fixture에는 개인 입력이나 운영 DB 데이터를 사용하지 않는다.

## Phase E2E

| 테스트 ID | 여정 |
|---|---|
| TEST-E2E-001 | 이름·성별·선호 포지션으로 새 선수 생성→입단 테스트→첫 계약 |
| TEST-E2E-002 | 프리시즌→핵심 경기→시즌 결산 |
| TEST-E2E-003 | 제안 비교→협상→임대/이적 확정 |
| TEST-E2E-004 | 부상 선택→재활→복귀와 재발 위험 |
| TEST-E2E-005 | 장기 진행→은퇴→Legacy·연대기 |
| TEST-E2E-006 | KICKOFF 도전→LOCKED→시즌 결산 |
| TEST-E2E-007 | 새로고침·응답 유실·중복 클릭 복구 |
| TEST-E2E-008 | 복구 코드 발급→다른 브라우저 복구→충돌 선택 |
| TEST-E2E-009 | 온보딩 건너뛰기→첫 프로 계약 5분 이내 도달 |
| TEST-E2E-010 | 핵심 경기 챕터 판단 3개→새로고침→확정 판단 재생 |
| TEST-E2E-011 | 국내 첫 계약→해외 관심→제안 비교→등록 성공→현지 첫 시즌 |
| TEST-E2E-012 | 조건부 등록 실패→기존 계약·팀·revision 안전 복구 |
| TEST-E2E-013 | 리그·컵·대륙대회·대표팀 일정 충돌→단일 출전·정확한 집계 |

## 세션 길이·결정 예산 테스트

[시간 모델](11-time-model-and-pacing.md)의 목표를 스크립트 플레이로 측정한다. 서버 latency가 아니라 화면 수·결정 수·필수 입력 수로 계산한 "최소 조작 시간"과 실제 브라우저 자동화 시간을 모두 기록한다. 결정 예산 상한 초과는 콘텐츠 검증 실패로 취급한다.

## 확률 테스트

개별 결과를 기대하지 않고 큰 표본의 분포를 검사한다. 허용 오차는 시나리오와 표본 수에 따라 문서화하고 flaky test가 되지 않도록 고정 seed 묶음을 사용한다.

## 접근성 체크리스트

- 포커스 순서와 포커스 표시.
- 라디오/선택 카드 이름·상태·설명.
- 성별 선택은 기본값이 없고 세 항목 모두 키보드로 고를 수 있으며, 능력에 영향을 주지 않는다는 설명이 그룹의 접근성 설명에 연결된다.
- 결과 변화의 한 번만 낭독되는 live region.
- 확대 200%, 360px, 긴 한국어/영어 문구.
- prefers-reduced-motion.
- 대비와 비색상 상태 표현.
- 시각 디자인 시스템 토큰 외 색상 사용 0건, 고정폭 자릿수 미적용 숫자 0건.
- UI 문자열에 `VAR CHECK`, 하위 백분위 표현 0건.

## 출시 차단 기준

- 데이터 손상 또는 재현 실패 1건 이상.
- P0 흐름 E2E 실패.
- 마이그레이션 실패 또는 롤백/roll-forward 절차 없음.
- 키보드로 P0 흐름 완료 불가.
- 시즌 결산 p95가 성능 예산의 2배 초과.
- toss 채널: QR 실기기 체크리스트 미완료(식별키 발급, Bearer 세션, 동기화, SafeArea·X 버튼 겹침 없음, 압축 해제 100MB 이하, HTTPS·CORS).

## 버그 보고 필수 정보

`careerId`, `revision`, `commandId`, `rulesetVersion`, `contentPackVersion`, `seed reference`, `requestId`, 기대/실제 상태 hash를 포함한다. 민감한 프로필 키와 선수명은 제외한다.
