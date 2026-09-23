# 가벼운 PR 검증과 main 전용 자동 배포

T-9-001(풀타임 마이그레이션) 이후 버전. `apps/web`은 localStorage 저장 클라이언트 전용 게임이고
`apps/api`는 health·profile·Google 로그인만 다룬다. 옛 domain/content/engine-client/ui/platform
패키지, 서비스 시즌, seed upsert, replay 회귀는 모두 삭제됐다 — 아래 정책은 `.github/workflows/ci.yml`
("CI and Staging")의 실제 동작을 따른다.

## 실행 정책

| 상황                | 자동 실행                                                                          |
| ------------------- | ----------------------------------------------------------------------------------- |
| 순수 문서 PR        | checkout·변경 분류 후 성공 보고. 패키지 설치·검사·배포 없음                         |
| 코드 PR(Draft 포함) | `pr-checks` job: lint·lint:deps·typecheck·test. E2E·배포 없음                      |
| main 코드 변경      | `deploy-staging` job: 위 검사 → build → check:bundle → e2e → 풀타임 밸런스 스모크 → staging D1 migrate → staging 배포 → API/web 스모크 |
| main 문서 변경      | 마지막 성공 main 이후 미배포 코드가 없을 때 검사·배포 생략                          |
| 전체 회귀           | `Full Validation (manual)`을 필요할 때 실행. 전체 테스트·E2E·N=20000 밸런스 회귀, 배포 없음 |

PR이 main에 합쳐져도 원격 반영 전의 최소 검증이 실패하면 배포하지 않는다. 같은 run의
`Main checks and staging deploy` 한 job이 검증부터 배포 후 확인까지 맡아 job 사이의 추가
러너 대기를 줄인다. Mac self-hosted runner 1개·Chromium worker 1개와 기존 private 신뢰 경계는 유지한다.

## 문서 변경과 대기열 안전성

허용되는 문서는 `docs/`의 Markdown·문서 이미지/PDF, 최상위 Markdown,
각 디렉터리의 `README.md`·`CHANGELOG.md`다. `docs/`의 Python/TypeScript/HTML이나
알 수 없는 경로는 코드로 취급한다. rename은 이전/이후 경로를 모두 본다.
파일 목록 조회·SHA 검증 실패는 검사를 생략하지 않고 코드 변경으로 처리한다.
분류 로직은 `.github/scripts/ci-scope.mjs`(테스트: `ci-scope.test.mjs`)에 있다.

PR은 base와 PR merge commit을 비교한다. main은 GitHub Actions API에서 `ci.yml`의
마지막 성공한 main push SHA를 찾아 현재 push와 비교한다. `push.before`만 사용하면 코드
배포가 대기 중인 동안 문서 push가 pending run을 대체할 때 미배포 코드가 누락될 수 있기 때문이다.
문서-only 성공 run도 이전 성공 이후 코드 차이가 없음을 확인한 기준점으로 사용할 수 있다.
API 조회 실패·이전 SHA 부재는 보수적으로 검증·배포하며, 알려진 마지막 성공 SHA보다
오래되거나 갈라진 commit의 재실행은 거부한다.

main 실행은 중간 취소하지 않는다. staging D1 migration/deploy를 겹치지 않게 한다.
PR의 이전 검사는 새 commit으로 대체할 수 있다.
main 성공 기록 조회에만 `actions: read`를 추가하며, Cloudflare secret은 배포 step에만 주입한다.
러너의 `gh` CLI가 필요하다. 없거나 API 조회가 실패해도 검사를 건너뛰지는 않는다.

## main 배포 전 핵심 검사

1. `node --test .github/scripts/*.test.mjs`, `pnpm lint`, `pnpm lint:deps`, `pnpm typecheck`, `pnpm test`
   (turbo가 web/api/contracts/scripts 전체를 돈다).
2. `pnpm --filter @offside/api db:check` — 스키마 변경에 필요한 migration 파일 누락 확인
   (원격 데이터 복구 검사는 아니다).
3. `pnpm build` → `pnpm --filter @offside/web check:bundle` → Chromium 설치 →
   `pnpm --filter @offside/web e2e`(360×780, `vite build && vite preview`로 프로덕션 빌드 기준 실행).
4. **풀타임 밸런스 스모크** — `node tooling/scripts/sim-smoke.mjs 2000 ci-staging-<run_id>`.
   `tooling/fulltime-sim`으로 random 정책 2000 커리어를 헤드리스로 돌려 `errors === 0`과
   `ovrByAge` 평균이 `[1, 99]` 범위인지만 빠르게 확인한다. 대규모 밸런스 회귀(N=20000, 기준선
   비교)는 `Full Validation (manual)`에만 있다.

그 밖의 회귀는 삭제하지 않고 수동 전체 검증에 유지한다. 위험도가 큰 변경이나 릴리스 후보에는
`Full Validation (manual)`을 별도로 실행한다. 단계 완료가 저장 안전성의 영구 보증은 아니다.

## 배포와 배포 후 확인

`pnpm --filter @offside/api db:migrate:staging` → `pnpm --filter @offside/api deploy:staging` →
`pnpm --filter @offside/web deploy:staging` 순으로 배포한다. 이어서:

- `tooling/scripts/web-readiness.mjs`로 staging 웹이 이번에 빌드한 자산을 실제로 서빙하는지 확인.
- `GET https://offside-api-staging.tasddc1569.workers.dev/v1/health` 200.
- `GET https://offside-api-staging.tasddc1569.workers.dev/v1/profile` 200(인증 없이도 익명
  프로필을 만들고 200을 반환한다).
- `GET https://offside-web-staging.tasddc1569.workers.dev/` 200, 본문에 `오프사이드` 포함.
- `GET https://offside-web-staging.tasddc1569.workers.dev/guide/` 200.

스모크 실패는 run 실패로 보고하며 실패 자료(`apps/web/test-results`)를 private Actions artifact에
7일 보관한다. 이미 배포된 앱이나 DB를 자동 롤백하지 않는다. 실패한 단계·배포 SHA·재현 경로로
GitHub 이슈를 정리하고 작은 수정 PR을 main에 반영한다.

```sh
# 배포하지 않는 전체 회귀(이 워크플로가 들어 있는 신뢰된 ref 사용)
gh workflow run full-validation.yml --ref main
```

## 이전 Preview 정리

새 PR에는 Preview를 만들지 않는다. `cleanup-preview.yml`은 전환 당시 남아 있던 PR #77/#92/#99의
Worker 잔재만 정리하는 hook이며, 새 PR 종료에는 runner를 배정하지 않는다. 필요한 과거 Preview는
main의 `Cleanup Cloudflare Preview` 수동 실행에 정확한 PR 번호를 넣어 정리한다. KV/D1·staging·
production 자원은 삭제 대상이 아니며 404만 이미 없음으로 처리한다.
