# 진행 관리

이 디렉터리는 OFFSIDE(풀타임) 개발의 진행 상태·결정·작업 위임 규칙의 정본이다.

> **2026-09-24 Phase 9 풀타임 전환**: 원작 OFFSIDE(결정론적 Web Worker 시뮬레이터)를
> 새 게임 풀타임으로 전면 교체했다. 배경은 [ADR-013](../adr/ADR-013-fulltime-replacement.md),
> 현재 상태는 [board.md](board.md) 상단 "Phase 9" 절, 결정은
> [decision-log.md](decision-log.md) 2026-09-23/24 항목을 본다. 원작의 진행 보드·
> 워커 브리프·시뮬레이션 증거는 [`docs/archive/offside/tracking/`](../archive/offside/README.md)에
> 보존돼 있다.

## 역할

| 역할 | 담당 | 하는 일 | 하지 않는 일 |
|---|---|---|---|
| 프로덕트 오너 | 사용자 | 우선순위, 외부 계정·도메인·결제, 범위 변경 승인 | 개별 PR 머지 승인(기술 책임자에게 위임) |
| 기술 책임자·구현 | Claude (Claude Code 메인 세션) | 명세·ADR·보드 관리, 코드·문서 직접 구현, 검증 체인 실행, 리뷰, 머지, 운영 배포(오너 지시 때) | 오너 승인 없는 범위 변경 |
| 보조 워커 | 서브에이전트 | 서로 독립적이라 병렬로 돌릴 수 있는 작업(문구 작성, 테스트 보강, 무관한 기능)만 직접 구현 | 재위임, 범위 밖 수정 |

구현은 Claude Code 메인 세션이 직접 한다(2026-09-24, ADR-013의 "Sonnet 5 서브에이전트 위임" 규칙을
대체). 서브에이전트는 병렬로 돌릴 수 있는 독립 작업에만 쓴다. 자세한 규칙은
[`AGENTS.md`](../../AGENTS.md)와 [`CLAUDE.md`](../../CLAUDE.md)를 본다.

## 작업 단위

- 작업 ID는 `T-<Phase>-<번호>`다(서브트랙이 있으면 `T-<Phase>-<번호><글자>`, 예: `T-9-001d`).
- 작업 하나는 워커 한 명이 한 워크트리에서 커밋(또는 PR) 하나로 끝낼 수 있는 크기다.
- 보드는 [`board.md`](board.md), 결정은 [`decision-log.md`](decision-log.md)다.

## 문서 정본 우선순위

문서 충돌 시: [`docs/adr/`](../adr/README.md) > `docs/tracking/`(이 디렉터리) >
`docs/operations/` 순이다. 기술 스택·인프라 확정 결정은 ADR이 다른 문서의 "권장"보다
우선한다. 진행 상태는 `board.md`, 결정은 `decision-log.md`가 정본이다.

원작 OFFSIDE의 개발 명세·화면 계약·콘텐츠 저작 문서(`development/`, `phases/`,
`screens/`, `content/`)는 [`docs/archive/offside/`](../archive/offside/README.md)로
옮겨졌고 더 이상 정본이 아니다. 참고용으로만 연다.

## 브랜치·PR·머지 규칙

- 브랜치 이름은 작업 ID로 시작한다. 예: `T-9-001d-docs`.
- PR 제목·커밋 메시지는 `T-9-001d: <설명>` 형식이다(한국어).
- 머지는 squash. main 직접 푸시는 오케스트레이터의 문서 커밋만 허용한다.
- PR 직전 `git fetch origin && git merge origin/main`으로 최신 main을 합친다.
  `pnpm-lock.yaml` 충돌은 손으로 고치지 말고
  `git checkout origin/main -- pnpm-lock.yaml && pnpm install --no-frozen-lockfile`로
  재생성한 뒤 전체 검증 체인을 다시 돌린다.

## 리뷰 체크리스트

- [ ] 브리프의 요구사항·범위가 코드·문서·커밋에 연결돼 있다.
- [ ] 세이브 마이그레이션 코드(`apps/web/src/game`)가 예전 버전 저장 데이터를
      계속 로드할 수 있다(아래 "저장·밸런스 규칙" 참조).
- [ ] 밸런스에 영향을 주는 변경은 `tooling/fulltime-sim`을 돌려 확인했다.
- [ ] 정상·빈 상태·오류를 테스트한다.
- [ ] UI 문자열에 원작의 폐기 어휘(`VAR CHECK` 등)가 남아 있지 않다.
- [ ] 로그에 쿠키·복구 코드·선수명 원문이 없다.
- [ ] 범위 밖 파일을 건드리지 않았다.
- [ ] CI 전체 통과.

## 저장·밸런스 규칙 (풀타임)

원작의 "불변 콘텐츠 팩"·"ruleset 버전 고정"·"리플레이 결정론" 규칙은 새 게임
구조와 맞지 않아 폐기됐다(ADR-013). 대신:

- **세이브는 `localStorage`에만 저장된다.** 저장 포맷을 바꿀 때는
  `apps/web/src/game`의 마이그레이션 코드가 이전 버전 세이브를 계속 읽을 수
  있어야 한다. 기존 세이브를 깨뜨리는 변경은 마이그레이션 없이 배포하지 않는다.
- **밸런스를 바꾸는 변경은 `tooling/fulltime-sim`을 돌려야 한다.** 이 시뮬레이터가
  원작 풀타임 v4와의 패리티 기준선
  (`tooling/fulltime-sim/reference/random.json`)을 유지하는지 확인한다.

## 상태 보고

오케스트레이터는 작업이 상태를 바꿀 때마다 보드를 갱신하고, 사용자에게는
Phase 게이트·차단·결정 필요 시점에만 보고한다. 보고는 "현재 N건 진행 중, 차단 M건,
결정 필요 K건" 형식으로 시작한다.
