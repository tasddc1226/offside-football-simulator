# 워커 브리프 양식

브리프는 `docs/tracking/briefs/T-<Phase>-<번호>.md`에 저장하고, 워커에게는 파일 경로를 읽으라고 전달한다. 브리프 밖의 작업은 하지 않는다.

```markdown
# T-0-003: <제목>

## 목표
한 문장. 이 작업이 끝나면 무엇이 가능한가.

## 참조 명세
- 요구사항 ID: FR-…, RULE-…, API-…, DATA-…, TEST-…
- 읽어야 할 문서: docs/development/…, docs/adr/…
- 정본 우선순위: docs/development > phases > screens > content > PDF

## 범위
- 만질 패키지·경로: packages/domain, …
- 만들 것: …
- 만지지 말 것: docs/, 다른 패키지, CI 설정

## 완료 조건
- [ ] 테스트: … (**D-61**: 2026-09-05부터 새 테스트 코드는 쓰지 않는다. 기존 테스트·골든은 체인 통과에 필요한 갱신만)
- [ ] 명령: `pnpm test --filter domain` 통과
- [ ] 문서: 코드 주석 외 문서 수정 없음

## 제약
- domain 패키지는 외부 import·Node·브라우저 API 금지
- 시간·난수는 입력으로만
- 커밋 메시지는 `T-0-003: …`로 시작, 브랜치는 T-0-003-…

- 서브에이전트를 띄우지 않는다 — 리뷰용이든 조사용이든 전부. gstack `/review`·`/codex`·adversarial 리뷰·`/simplify`·병렬 fork·Agent/Explore 조사 에이전트 금지(컨텍스트를 복제해 비용이 배로 든다). 파일은 직접 읽는다. 유일한 예외는 Orca PR 게이트용 `/review:pr` 1회(로컬 모드)다. 리뷰는 오케스트레이터가 한다.
- 상태 타입(`CareerState`·`Pending`·`TimelineEntry`·`FootballSeason` 등)을 확장해 다른 패키지(apps/web 포함)의 typecheck가 깨지면 **그 PR이** 최소 수정으로 루트 체인을 통과시킨다 — 테스트 리터럴의 필드 보강, 라벨 `Record` 키 추가, 로컬 유니언 확장, exhaustive switch의 case 추가까지. 브리프의 "이 패키지는 손대지 않는다"는 기능 구현에 관한 제외이지 타입 정합에는 적용되지 않는다(PR #40·#41에서 두 번 반복된 사례). "기존 버그"라고 적기 전에 origin/main에서 같은 명령이 통과하는지 확인한다.
- 의존성 추가 시 정확한 버전으로 고정한다. pnpm의 최소 배포 경과 정책이 막는 버전은 `minimumReleaseAgeExclude`로 우회하지 말고 정책을 통과하는 더 오래된 버전을 쓴다.
- e2e는 브리프가 지정한 워커별 포트로 돌린다(`E2E_PORT=<포트> pnpm --filter @offside/web e2e`, PR #42부터 지원; 실 api 모드는 `E2E_API_URL`). 지정이 없을 때만 아래 5174 규칙을 따른다.
- 전체 체인의 e2e 단계 전에 `lsof -nP -iTCP:5174 -sTCP:LISTEN`이 비어 있는지 확인한다. Playwright가 이미 떠 있는 Vite 서버를 재사용하므로(포트 고정 5174), 다른 워커나 오케스트레이터의 e2e와 겹치면 다른 코드를 테스트하게 된다. 비어 있지 않으면 끝날 때까지 기다린다(`until ! lsof -nP -iTCP:5174 -sTCP:LISTEN >/dev/null; do sleep 10; done`).
- PR 직전 `git fetch origin && git merge origin/main`으로 최신 main을 합친다. `pnpm-lock.yaml` 충돌은 손으로 고치지 말고 `git checkout origin/main -- pnpm-lock.yaml && pnpm install --no-frozen-lockfile`로 재생성한 뒤 전체 체인을 다시 돌린다.
- 머신을 여러 세션(오케스트레이터 검증 체인·CI 러너·다른 워커)이 함께 쓴다. 자기가 띄운 프로세스(dev 서버·wrangler·미리보기)는 **띄울 때 받은 PID로만** 끈다(`kill <pid>` 또는 `lsof -tiTCP:<포트> -sTCP:LISTEN | xargs kill`). `pkill -f "vite"`·`pkill -f workerd`·`killall node` 같은 이름 패턴 종료는 금지 — 2026-09-14 워커의 `pkill -f "vite"`가 다른 세션의 `vitest` 체인을 죽였다.

## 진행 보고
- 체크포인트마다 `orca worktree set --worktree active --comment "..."` 갱신
- 막히면 질문을 PR 본문 또는 터미널에 남기고 멈춘다. 명세를 고치지 않는다.
- 시각 검증(스크린샷·측정)은 수치와 결론 문장을 PR 본문에 적는다. 이미지 파일은 저장소에 넣지 않고 외부 호스팅(gist·artifact)도 시도하지 않는다. 파일은 스크래치패드에 남기고 경로만 적는다.
- 끝나면 PR을 열고 본문에 요구사항 ID, 테스트 방법, 범위 밖 발견 사항을 적는다.
```

## 브리프 작성 규칙

- 워커는 대화 맥락이 없다. 브리프만 읽고 시작할 수 있어야 한다.
- 결정이 필요한 항목을 브리프에 남기지 않는다. 오케스트레이터가 먼저 결정한다.
- 완료 조건은 실행 가능한 명령과 관찰 가능한 결과로 쓴다.
- 한 브리프에 패키지 두 개 이상을 넣지 않는다. 필요하면 작업을 나눈다.
