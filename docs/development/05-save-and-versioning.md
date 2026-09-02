# 05. 저장·버전·서비스 시즌

## 저장 원칙

- 로컬 우선 저장이다. 플레이 중 정본은 브라우저 IndexedDB이고, 서버는 checkpoint Snapshot과 명령 로그를 동기화 받아 복구·보관 정본이 된다([ADR-002](../adr/ADR-002-persistence-and-identity.md)).
- 명령 처리 전후의 Career revision을 낙관적 잠금으로 검증한다. 로컬 엔진과 서버 동기화 모두 같은 규칙을 쓴다.
- 시즌 시작, 결정이 열린 step 경계, 이벤트 선택 직전, 챕터 판단 확정 직후, 시즌 결산 직후, 계약·이적·은퇴 확정 직후 Snapshot을 남긴다. CheckpointType에 `STEP_BOUNDARY`와 `CHAPTER_DECISION`을 둔다.
- seed, event definition version, ruleset version을 기록해 버그를 재현한다.

## Snapshot 계약

```ts
type CareerSnapshot = {
  id: string;
  careerId: string;
  revision: number;
  checkpoint: CheckpointType;
  state: SerializedCareerState;
  stateHash: string;
  rulesetVersion: string;
  contentPackVersion: string;
  rngState: RngState;
  createdAt: string;
};
```

Snapshot은 화면 애니메이션 진행률을 저장하지 않는다. 확정된 숫자와 표시 중인 숫자를 UI에서 분리한다.

## 서비스 시즌과 축구 시즌

| 구분 | FootballSeason | ServiceSeason |
|---|---|---|
| 의미 | 선수 세계의 리그 한 해 | 모든 플레이어의 콘텐츠 운영 기간 |
| 진행 | 프리시즌→대회→이적시장→결산 | PRESEASON→ACTIVE→LOCKED→ARCHIVED |
| 결과 | 기록·능력·계약·팀 성적 | 규칙 버전·도전·개인 시즌 결산 |
| 종료 | 나이 증가, 다음 해 | 신규 커리어의 콘텐츠 팩 변경 |

서비스 시즌 종료는 Career 삭제나 강제 은퇴가 아니다.

## 상태 전환

```text
PRESEASON
  - 테스트 커리어만 생성
  - 밸런스 변경 가능, 랭킹 미집계
ACTIVE
  - 신규 시즌 Career 생성
  - ruleset 고정, 결과 집계
LOCKED
  - 신규 시즌 Career 생성 중단
  - 진행 중 Career 마무리와 결과 검증
ARCHIVED
  - 결산·배지·선수 보관함 열람
  - 다음 시즌 활성화
```

## 버전 정책

| 버전 | 변경 예 | 기존 Career |
|---|---|---|
| `schemaVersion` | 필드·테이블 변경 | 마이그레이션 |
| `rulesetVersion` | OVR 가중치, 성장, 확률 | 생성 당시 버전 유지 |
| `contentPackVersion` | 이벤트 정의·문구·팀 데이터 | 생성 당시 pack 유지 |
| `clientMinVersion` | 호환 불가능 UI/API | 업데이트 안내 |

핫픽스가 결과를 바꾸면 patch ruleset을 새로 만든다. 단순 오탈자는 같은 content pack에서 수정할 수 있으나 이미 확정된 narrative Snapshot은 유지한다.

## 시즌 진행 데이터

```ts
type ServiceSeasonProgress = {
  ownerProfileId: string;
  serviceSeasonId: string;
  eligibleCareerIds: string[];
  completedChallengeIds: string[];
  rewardClaims: RewardClaim[];
  personalBest: Record<string, number | string>;
};
```

보상 수령은 `serviceSeasonId + challengeId + ownerProfileId` unique key로 한 번만 처리한다.

## 마이그레이션

1. 새 코드는 구/신 스키마를 읽는다.
2. additive migration을 먼저 배포한다.
3. 백필은 작은 배치와 재시도 가능한 cursor로 수행한다.
4. 읽기 경로가 새 필드를 검증한 후 쓰기를 전환한다.
5. 충분한 관찰 기간 후 구 필드를 제거한다.

ruleset 데이터는 마이그레이션하지 않고 불변 아티팩트로 보존한다.

## 복구 시나리오

- 브라우저 새로고침: 마지막 확정 Snapshot과 pending offer 복원.
- 응답 유실: commandId 조회로 확정 결과 복구.
- 손상 Snapshot: 직전 정상 Snapshot + event log로 재구축.
- 시즌 전환 중 장애: ACTIVE 시즌 포인터를 원자적으로 교체하고 이전 시즌을 유지.
- 사용자 캐시 삭제: 설정(SCR-030)에서 복구 코드를 입력하면 같은 LocalProfile과 모든 Career를 다른 브라우저에서 복원한다. 복구 코드가 없는 로컬 전용 저장은 복구 불가임을 명확히 안내.
- 복구 코드 분실: 재발급은 기존 프로필에 접근 가능한 브라우저에서만 가능하다. 분실과 접근 불가가 동시에 일어나면 복구할 수 없음을 온보딩과 발급 화면에서 미리 알린다.

## 무결성 테스트

- 동일 commandId 100회 병렬 제출 시 결과 1개.
- 구 ruleset Career를 최신 서버에서 재개.
- ACTIVE→LOCKED 전환 중 진행 중 명령 처리.
- Snapshot hash 변조 감지.
- 시즌 보상 중복 수령 차단.

