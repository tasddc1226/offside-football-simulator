# 08. 테스트 전략

## 품질 목표

가장 위험한 오류는 화려한 화면 문제가 아니라 장기 커리어 저장 손상, 결과 재추첨, 버전 전환 후 재현 실패다. 테스트 우선순위를 이 위험에 맞춘다.

## 테스트 층

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

## 필수 불변식

- 모든 능력·상태가 정의 범위에 있다.
- 동일 입력·seed·버전의 state hash가 같다.
- 이미 해결된 이벤트는 새 roll을 소비하지 않는다.
- Career revision은 확정 명령마다 정확히 1 증가한다.
- 계약 기간과 활성 FootballSeason이 중복되지 않는다.
- 은퇴 후 일반 진행 명령이 거부된다.
- 서비스 시즌 변경이 기존 Career 버전을 바꾸지 않는다.

## Golden fixtures

`fixtures/`에 다음을 버전 관리한다.

- 포지션·역할별 OVR 계산 선수.
- 낮은 OVR/높은 전술 적합도 선발 사례.
- 전체 벤치, 부상, 퇴장, 임대가 포함된 시즌.
- 10시즌 성장·노쇠 커리어.
- ruleset 1.0.0으로 생성한 은퇴 Career Snapshot.
- KICKOFF 도전 6개를 각각 완료/미완료한 사례.

fixture에는 개인 입력이나 운영 DB 데이터를 사용하지 않는다.

## Phase E2E

| 테스트 ID | 여정 |
|---|---|
| TEST-E2E-001 | 새 선수 생성→입단 테스트→첫 계약 |
| TEST-E2E-002 | 프리시즌→핵심 경기→시즌 결산 |
| TEST-E2E-003 | 제안 비교→협상→임대/이적 확정 |
| TEST-E2E-004 | 부상 선택→재활→복귀와 재발 위험 |
| TEST-E2E-005 | 장기 진행→은퇴→Legacy·연대기 |
| TEST-E2E-006 | KICKOFF 도전→LOCKED→시즌 결산 |
| TEST-E2E-007 | 새로고침·응답 유실·중복 클릭 복구 |

## 확률 테스트

개별 결과를 기대하지 않고 큰 표본의 분포를 검사한다. 허용 오차는 시나리오와 표본 수에 따라 문서화하고 flaky test가 되지 않도록 고정 seed 묶음을 사용한다.

## 접근성 체크리스트

- 포커스 순서와 포커스 표시.
- 라디오/선택 카드 이름·상태·설명.
- 결과 변화의 한 번만 낭독되는 live region.
- 확대 200%, 360px, 긴 한국어/영어 문구.
- prefers-reduced-motion.
- 대비와 비색상 상태 표현.

## 출시 차단 기준

- 데이터 손상 또는 재현 실패 1건 이상.
- P0 흐름 E2E 실패.
- 마이그레이션 실패 또는 롤백/roll-forward 절차 없음.
- 키보드로 P0 흐름 완료 불가.
- 시즌 결산 p95가 성능 예산의 2배 초과.

## 버그 보고 필수 정보

`careerId`, `revision`, `commandId`, `rulesetVersion`, `contentPackVersion`, `seed reference`, `requestId`, 기대/실제 상태 hash를 포함한다. 민감한 프로필 키와 선수명은 제외한다.

