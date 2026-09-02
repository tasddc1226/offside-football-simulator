# 진행 관리

이 디렉터리는 OFFSIDE 개발의 진행 상태·결정·작업 위임 규칙의 정본이다.

## 역할

| 역할 | 담당 | 하는 일 | 하지 않는 일 |
|---|---|---|---|
| 프로덕트 오너 | 사용자 | 우선순위, 외부 계정·도메인·결제, 범위 변경 승인 | 개별 PR 머지 승인(오케스트레이터에게 위임) |
| 기술 책임자·오케스트레이터 | Claude (이 세션) | 명세·ADR·보드 관리, 작업 브리프 작성, 워커 생성·전달, 결과 리뷰, 머지 판단 | 앱 코드 직접 수정 |
| 구현 워커 | Claude Code (Sonnet 5) | 브리프 범위의 코드·테스트 구현, PR | 명세 변경, 범위 밖 수정 |

오케스트레이터는 `apps/`, `packages/`, `tooling/`을 편집하지 않는다. 코드 변경이 필요하면 브리프를 써서 워커에게 넘긴다. 문서(`docs/`)와 CI 설정 리뷰는 오케스트레이터가 직접 한다.

## 작업 단위

- 작업 ID는 `T-<Phase>-<번호>`다. 예: `T-0-003`.
- 작업 하나는 워커 한 명이 한 워크트리에서 PR 하나로 끝낼 수 있는 크기다. 하루 이내를 목표로 한다.
- 모든 작업은 요구사항 ID(FR·RULE·SCR·API·DATA·TEST)를 하나 이상 참조한다.
- 보드는 [`board.md`](board.md), 결정은 [`decision-log.md`](decision-log.md), 브리프 양식은 [`worker-brief-template.md`](worker-brief-template.md)다.

## 위임 워크플로 (Orca CLI)

Orca 저장소 ID는 `41200e35-ac29-475d-8c7f-6cd38f9bc9e1`이다. 실행 파일은 `orca`.

1. 보드에서 작업을 `in-progress`로 옮기고 브리프를 `docs/tracking/briefs/T-x-xxx.md`에 저장한다.
2. 독립 워크트리를 만든다. 베이스는 저장소 기본(main)이다.

   ```text
   orca worktree create --repo id:41200e35-ac29-475d-8c7f-6cd38f9bc9e1 --name T-0-003-domain-skeleton --no-parent --json
   ```

3. 워커 터미널을 Sonnet 5로 연다. `--agent claude`는 모델을 지정할 수 없으므로 두 단계로 연다.

   ```text
   orca terminal create --worktree id:41200e35-ac29-475d-8c7f-6cd38f9bc9e1::<worktreePath> --title T-0-003 --command 'claude --model claude-sonnet-5' --json
   orca terminal wait --terminal <handle> --for tui-idle --timeout-ms 60000 --json
   orca terminal send --terminal <handle> --text "<브리프 전문 또는 브리프 파일 경로를 읽으라는 지시>" --enter --json
   ```

4. 진행은 `orca terminal read`와 워크트리 comment로 본다. 워커는 체크포인트마다 `orca worktree set --worktree active --comment "..."`를 갱신한다.
5. 워커가 PR을 열면 오케스트레이터가 리뷰 체크리스트로 검토한다. 수정이 필요하면 같은 터미널에 `orca terminal send`로 피드백을 보낸다.
6. 통과하면 오케스트레이터가 squash 머지한다(2026-09-02 사용자 지시: 머지 승인은 따로 묻지 않는다). 워크트리는 `orca worktree rm`으로 정리하고 보드에 머지 커밋을 적는다.
7. 보드를 `completed`로 옮기고 결정이 있었으면 결정 로그에 적는다.

워커는 서브에이전트 리뷰를 띄우지 않는다. 단, Orca는 `gh pr create` 앞에 `/simplify` 또는 `/review:pr` 실행을 요구하는 게이트를 두므로 `/review:pr` **1회**만 허용한다(`/simplify`와 병렬 fork는 금지. T-0-001에서 리뷰 fork 4개가 비용을 두 배로 올렸다). 워커가 막히면 오케스트레이터에게 질문을 남기고 멈춘다. 워커는 명세를 고치지 않는다. 명세가 틀렸으면 오케스트레이터가 문서를 고친 뒤 브리프를 갱신한다.

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
