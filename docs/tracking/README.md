# 진행 관리

이 디렉터리는 OFFSIDE 개발의 진행 상태·결정·작업 위임 규칙의 정본이다.

## 역할

> **현재 인계(2026-09-07)**: 운영 서비스가 열렸다. 2026-09-06 12:33 `Production Release`
> run 34009144236(`82a46fc`)으로 첫 운영 배포, 9/7 01:51~01:52 `939fe48` 재배포.
> [offside-lab.com](https://offside-lab.com)에서 시즌 1(`svc_season_1`, 테스트 아님, 종료일 미정,
> 룰셋 1.3.0·팩 0.5.0)이 ACTIVE다. Phase 5(PR #103·#106)·Phase 6은 종결, Phase 7 운영·밸런스가
> 진행 중이다 — 현황은 [board.md](board.md) 상단과 Phase 5·6·7 표, 결정은 [decision-log.md](decision-log.md)
> 2026-09-07 항목. 9/5 밤부터 코드 PR은 사용자 세션(Codex·Sol·Luna)이 열고 머지하며 Claude 세션은
> 문서·현황판·CI 검토만 맡는다.
>
> 이전 인계(2026-09-06): Phase 5와 게임 경험 새로고침 PR
> [#103](https://github.com/tasddc1226/offside-football-simulator/pull/103)은 main
> `fb8b78260377c838947ae43caa3290481c3a4999`로 병합됐다. PR quick checks
> [run 34002089936](https://github.com/tasddc1226/offside-football-simulator/actions/runs/34002089936)은
> 54초에 성공했다. main staging run 34002153036(2분), expanded 수동 deploy run
> 34002280639(1분 19초)도 성공했다(expanded 환경은 9/6 PR #122로 삭제됨). expanded 신규 1.1 커리어의
> 실제 은퇴·보관·강제 새로고침까지 확인해 staging 인수를 완료했다.
> 합성 grade 비율은 관찰 목표이며 단독 merge hard gate가 아니다. 저장 호환성, 동일 품질 포지션
> 공정성, Archive 근거의 고득점 도달성, population 무결성은 필수다. 아래 Claude 전담·Phase 5
> 보류·항상 squash 문구는 당시 운영 이력이며 현재 상태는 [통합 기록](game-experience-refresh-2026-09-06.md)을 따른다.

| 역할 | 담당 | 하는 일 | 하지 않는 일 |
|---|---|---|---|
| 프로덕트 오너 | 사용자 | 우선순위, 외부 계정·도메인·결제, 범위 변경 승인 | 개별 PR 머지 승인(오케스트레이터에게 위임) |
| 기술 책임자·오케스트레이터 | Claude (Claude Code 세션, 2026-09-05 복귀) | 명세·ADR·보드 관리, 작업 브리프 작성, 워커 투입, 검증 체인 실행, 리뷰(화면은 ego-browser로 실제 확인), 머지 판단 | 앱 코드 직접 수정 |
| 구현 워커 | Sonnet 5 (Claude Code `Workflow` 에이전트, `model: sonnet`, 격리 worktree) | 브리프 범위의 코드 구현, PR (2026-09-05 D-61부터 새 테스트 코드는 쓰지 않고 기존 테스트·골든 갱신만) | 명세 변경, 범위 밖 수정, 리뷰용 서브에이전트 |

오케스트레이터는 `apps/`, `packages/`, `tooling/`을 편집하지 않는다. 코드 변경이 필요하면 브리프를 써서 워커에게 넘긴다. 문서(`docs/`)와 CI 설정 리뷰는 오케스트레이터가 직접 한다.

## 작업 단위

- 작업 ID는 `T-<Phase>-<번호>`다. 예: `T-0-003`.
- 작업 하나는 워커 한 명이 한 워크트리에서 PR 하나로 끝낼 수 있는 크기다. 하루 이내를 목표로 한다.
- 모든 작업은 요구사항 ID(FR·RULE·SCR·API·DATA·TEST)를 하나 이상 참조한다.
- 보드는 [`board.md`](board.md), 결정은 [`decision-log.md`](decision-log.md), 브리프 양식은 [`worker-brief-template.md`](worker-brief-template.md)다.

## 위임 워크플로 (Claude Code Workflow, 2026-09-05~)

1. 보드에서 작업을 `in-progress`로 옮기고 브리프를 `docs/tracking/briefs/T-x-xxx.md`에 저장한다(양식은 [`worker-brief-template.md`](worker-brief-template.md)). 브리프는 웨이브가 열리기 전에 미리 쓴다.
2. 오케스트레이터가 `Workflow` 도구로 작업당 스크립트 하나를 띄운다. 구현 에이전트는 `agent(prompt, { model: 'sonnet', effort: 'xhigh', isolation: 'worktree', schema })`로 만들고, 프롬프트에는 브리프 경로·README·브리프 양식·브랜치 이름·e2e 포트·결과 스키마(`status`·`branch`·`sha`·`prNumber`·`prBodyPath`·`summary`·`questions`)를 넣는다. 에이전트는 자기 worktree에서 `git fetch origin && git checkout -B <branch> origin/main`으로 시작하고 `pnpm install --frozen-lockfile` 뒤 브리프대로 구현·전체 체인·push·PR 생성까지 한다. 병렬 투입 수에 상한을 두지 않는다(2026-09-05 사용자 지시 "병렬 진행을 최대로", D-59). 서로 다른 파일 소유권(D-53)을 가진 작업만 나란히 띄우고, 같은 파일을 만지는 작업은 머지 순서를 정해 뒤 작업이 `git merge origin/main`으로 따라간다. 콘텐츠 확장은 새 팩 버전으로 만들어 병행 중인 fixture·golden에 영향을 주지 않는다.
3. 워크플로가 끝나면 오케스트레이터가 검증한다: 임시 worktree에 `origin/main` + PR head를 merge해 전체 체인(`pnpm install --frozen-lockfile && pnpm lint && pnpm lint:deps && pnpm typecheck && pnpm test && pnpm build && pnpm --filter @offside/web check:bundle && e2e`)을 돌려 `CHAIN EXIT 0`을 확인하고, diff를 리뷰 체크리스트로 읽는다. 화면이 바뀐 PR은 PR preview(`https://offside-web-pr-<N>.tasddc1569.workers.dev`) 또는 로컬 preview를 `ego-browser` 스킬로 실제 열어 360px·다크·키보드 흐름을 확인한다.
4. 수정이 필요하면 리뷰 파일(`~/.offside-orch/T-x-xxx-review.md`)을 쓰고 같은 브랜치를 대상으로 수정 워크플로(브리프 + 리뷰 파일)를 다시 띄운다. 워커에게 대화 맥락은 없으므로 파일로만 전달한다.
5. 통과하면 오케스트레이터가 squash 머지한다(2026-09-02 사용자 지시: 머지 승인은 따로 묻지 않는다). 워크플로 worktree는 `git worktree remove`로 정리하고 원격 브랜치를 지운 뒤 보드에 머지 커밋을 적는다.
6. 보드를 `completed`로 옮기고 결정이 있었으면 결정 로그에 적는다. 현황판 아티팩트를 재게시한다.

이전 흐름은 legacy로만 남긴다: Orca 터미널 기반 Sonnet 워커(`docs/tracking/scripts/dispatch.sh`·`redispatch.sh`·`watch.py`, 상태 파일 `~/.offside-orch/<T>.handle`·`.dir`·`active.txt`, 2026-09-02~04)와 Codex 오케스트레이터 + Orca Orchestration Run `run_d5981c30764b`의 `gpt-5.6-luna` 워커(2026-09-04 저녁~2026-09-05 오전, T-3-004~T-4-004). Orca 저장소 ID는 `41200e35-ac29-475d-8c7f-6cd38f9bc9e1`이다.

워커는 서브에이전트 리뷰를 띄우지 않는다. PR 전 자체 점검은 현재 워커 세션의 단일 패스로 수행하고 병렬 fork는 금지한다. 워커가 막히면 오케스트레이터에게 질문을 남기고 멈춘다. 워커는 명세를 고치지 않는다. 명세가 틀렸으면 오케스트레이터가 문서를 고친 뒤 브리프를 갱신한다.

PR을 열기 직전 `git fetch origin && git merge origin/main`으로 최신 main을 합친다. `pnpm-lock.yaml` 충돌은 손으로 고치지 말고 `git checkout origin/main -- pnpm-lock.yaml && pnpm install --no-frozen-lockfile`로 재생성한 뒤 전체 체인을 다시 돌린다(2026-09-02 PR #4에서 lockfile 충돌로 머지가 한 번 실패함).

## 리뷰 체크리스트

- [ ] 브리프의 요구사항 ID가 코드·테스트·PR 본문에 연결돼 있다.
- [ ] `packages/domain`이 외부 import·Node·브라우저 API를 쓰지 않는다.
- [ ] 결정론 테스트가 있다. 같은 입력의 hash가 같다.
- [ ] 정상·빈 상태·오류·재시도·중복 요청을 테스트한다.
- [ ] 화면 작업은 360px, 키보드, 모션 감소, 시각 토큰만 사용을 확인했다.
- [ ] UI 문자열에 폐기 어휘(`VAR CHECK` 등)와 하위 백분위 표현이 없다.
- [ ] 마이그레이션에 forward와 roll-forward 절차가 있다.
- [ ] 로그에 쿠키·복구 코드·선수명 원문이 없다.
- [ ] 범위 밖 파일을 건드리지 않았다.
- [ ] CI 전체 통과.

## 브랜치·PR 규칙

- 브랜치 이름은 작업 ID로 시작한다. 예: `T-0-003-domain-skeleton`.
- PR 제목은 `T-0-003: domain 패키지 골격과 결정론 테스트` 형식이다.
- PR 본문에 브리프 링크, 요구사항 ID, 테스트 방법, 범위 밖 발견 사항을 적는다.
- 머지는 squash. main 직접 푸시는 오케스트레이터의 문서 커밋만 허용한다.

## 상태 보고

오케스트레이터는 작업이 상태를 바꿀 때마다 보드를 갱신하고, 사용자에게는 Phase 게이트·차단·결정 필요 시점에만 보고한다. 보고는 "현재 N건 진행 중, 차단 M건, 결정 필요 K건" 형식으로 시작한다.

## 앱인토스 콘솔 MCP 사용 규칙

`apps-in-toss-console` MCP(등록됨, 인증은 U-010)로 워크스페이스·미니앱·번들·검토·대시보드를 조회하고, 번들 업로드와 검토 신청은 오케스트레이터가 실행할 수 있다. 다음은 사용자가 직접 확인한 뒤에만 실행한다: `bundle_rollback`, 출시, `promotion_money_charge`, 푸시 발송, 카테고리·연령등급 변경. 실행 결과는 보드의 해당 태스크에 기록한다.
