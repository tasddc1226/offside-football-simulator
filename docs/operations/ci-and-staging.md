# 가벼운 PR 검증과 main 전용 자동 배포

2026-09-05 사용자 승인: 전체 PR 회귀·Preview 자동 배포를 중단하고, 출시 전 staging에서
빠르게 확인·수정한다. production 자동 배포, 기본 팩 변경, Phase 5 인수 승인은 포함하지 않는다.

## 실행 정책

| 상황                | 자동 실행                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| 순수 문서 PR        | checkout·변경 분류 후 성공 보고. 패키지 설치·게임 검사·배포 없음                                       |
| 코드 PR(Draft 포함) | CI 보조 코드의 소수 검사, lint·의존성 방향·typecheck. E2E·Preview 없음                                 |
| main 코드 변경      | 정적·콘텐츠 검증 → 기존 핵심 저장/재생 검사 → DB 변경 누락 확인·웹 빌드 → staging 배포 → API/UI 스모크 |
| main 문서 변경      | 마지막 성공 main 이후 미배포 코드가 없을 때 검사·배포 생략                                             |
| 전체 회귀           | `Full Validation (manual)`을 필요할 때 실행. 단위·통합·전체 기본 E2E, 배포 없음                        |

PR이 main에 합쳐져도 원격 반영 전의 최소 검증이 실패하면 배포하지 않는다. 같은 run의
`Main checks and staging deploy` 한 job이 검증부터 배포 후 확인까지 맡아 job 사이의 추가
러너 대기를 줄인다. Mac runner 1개·Chromium worker 1개와 기존 private 신뢰 경계는 유지한다.

## 문서 변경과 대기열 안전성

허용되는 문서는 `docs/`의 Markdown·문서 이미지/PDF, 최상위 Markdown,
각 디렉터리의 `README.md`·`CHANGELOG.md`다. `docs/`의 Python/TypeScript/HTML이나
알 수 없는 경로는 코드로 취급한다. rename은 이전/이후 경로를 모두 본다.
파일 목록 조회·SHA 검증 실패는 검사를 생략하지 않고 코드 변경으로 처리한다.

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

## 남겨 둔 배포 전 핵심 검사

기존 테스트 파일을 재사용한다. 새 커리어 전체 조합·수천 회 반복·4만 밸런스 배치는 추가하지 않는다.

- domain: 네 포지션 시즌의 재생/중간 직렬화, 부상·이적 통합 재생.
- engine-client: 원자적 저장·중복 확정·손상 복구·snapshot/import 정합성.
- API: 시즌 동기화·snapshot 검증·복구 코드·기존 DB migration.
- web: 서비스 시즌과 ruleset/content pack 버전 선택 경계.
- 빌드 전 `db:check`: 스키마 변경에 필요한 migration 파일 누락 확인. 원격 데이터 복구 검사는 아니다.

그 밖의 회귀는 삭제하지 않고 수동 전체 검증에 유지한다. 위험도가 큰 엔진/저장/DB 변경이나
릴리스 후보에는 전체 검증을 별도로 실행한다. 단계 완료가 저장 안전성의 영구 보증은 아니다.

## 배포 후 확인과 빠른 수정

`playwright.smoke.config.ts`의 작은 스모크가 실제 staging API health·서비스 시즌·CORS와
온보딩 렌더링·새로고침·슬라이드 이동을 확인한다. API 스텁·seed 주입·커리어 생성·복구 코드
발급은 하지 않는다. staging의 승인된 web/API origin만 허용하여 production 오접속을 막는다.
이는 실제 장기 플레이·실계정 복구·모든 화면 검증을 통과했다는 뜻이 아니다.

스모크 실패는 run 실패로 보고하며 실패 자료를 private Actions artifact에 7일 보관한다.
이미 배포된 앱이나 DB를 자동 롤백하지 않는다. 실패한 단계·배포 SHA·재현 경로로 GitHub 이슈를
정리하고 작은 수정 PR을 main에 반영한다. 저장/DB 문제는 추가 쓰기를 신중히 중단·진단하고,
코드 재배포만으로 손상된 데이터가 복원된다고 가정하지 않는다. 이슈 자동 작성 권한은 추가하지 않는다.

실제 생성→계약→시즌 결산은 기존 `e2e:staging` 리허설 또는 ego-browser로 필요할 때 수행한다.
이 리허설은 원격 QA 데이터를 만들므로 매 main push에 자동 실행하지 않는다. 기존 사용자 기록과
이전 QA 커리어를 삭제하거나 초기화하지 않는다.

```sh
# 배포하지 않는 전체 회귀(이 워크플로가 들어 있는 신뢰된 ref 사용)
gh workflow run full-validation.yml --ref main

# 기존 배포본의 비파괴 API/UI 스모크
pnpm --filter @offside/web exec playwright test --config playwright.smoke.config.ts
```

## 이전 Preview 정리

새 PR에는 Preview를 만들지 않는다. 전환 당시 기존 Preview의 PR #77/#92/#99가 닫히면
두 Worker만 정리하는 hook을 유지하고, 다른 신규 PR 종료에서는 runner를 배정하지 않는다.
필요한 과거 Preview는 main의 `Cleanup Cloudflare Preview` 수동 실행에 정확한 PR 번호를
넣어 정리한다. KV/D1·staging·production 자원은 삭제 대상이 아니며 404만 이미 없음으로 처리한다.

검사명은 `PR quick checks`로 바뀐다. 별도 branch protection을 사용하는 환경에서는 과거
Quality/Browser/Preview를 필수 상태로 계속 요구하지 않도록 관리자가 맞춰야 한다.
현재 private repo의 보호 설정 조회는 요금제 관련 403이므로 이번 작업에서 보호 설정은 변경하지 않는다.

## 성능 판정

변경 전 PR #99는 검사/배포 약 9분 47초, 대기 포함 43분 53초였다.
새 PR의 실행 시간을 짧게 만드는 것이 목표이나 러너 대기까지 2~3분으로 보장하지 않는다.
실제 새 PR/main run의 검증 결과와 시간은 전환 PR에 기록한다. 이 변경만으로 Phase 5 밸런스를
완료 처리하거나 기존 미완료 인수 조건을 없애지 않는다.
