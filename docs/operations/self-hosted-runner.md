# macOS self-hosted Actions runner

2026-09-05 사용자 승인: GitHub-hosted Actions의 계정 결제/지출 한도 차단에 대응해 현재 Mac에서 CI를 실행한다.
저장소 공개 전환, 유료 한도 변경, 검사 생략은 하지 않는다. GitHub 결제 상태 자체가 해결된 것은 아니다.

## 설치

| 항목 | 값 |
| --- | --- |
| 범위 | private `tasddc1226/offside-football-simulator` 전용 |
| 이름 / 초기 runner ID | `offside-mac-arm64` / `21` |
| 선택 라벨 | `self-hosted`, `macOS`, `ARM64`, `offside` |
| 실행 장비 | 사용자 Mac, macOS ARM64, 로그인 사용자 LaunchAgent |
| 설치 디렉터리 | `/Users/yangsuyoung/actions-runner-offside` (접근 권한 700) |
| CI checkout | 설치 디렉터리 하위 `_work`; 개발 worktree와 분리 |
| 설치 버전 | GitHub Actions runner `2.337.0`, 자동 업데이트 허용 |
| 다운로드 SHA-256 | `5a2cd92908a93d7276a194e1de6008099f3e7946f3f8e14aa7a1a7b4a31fdec2` |

GitHub의 repository runner download API가 반환한 공식 macOS ARM64 배포본을 다운로드하고
SHA-256 일치 확인 후 등록했다. 단기 등록 토큰은 출력/커밋하지 않는다. runner credentials도 저장소 밖에 둔다.
공식 `svc.sh install`/`start`를 사용하며 sudo는 사용하지 않는다.

서비스: `actions.runner.tasddc1226-offside-football-simulator.offside-mac-arm64`.
LaunchAgent는 로그인 세션에서 동작한다. Mac이 꺼지거나 로그아웃/잠자기에 들어가면 CI가 지연되거나 중단될 수 있다.
절전 설정을 강제로 바꾸거나 화면을 계속 켜 놓도록 설정하지 않았다.

## 실행 정책

- 러너 한 개이므로 한 번에 한 job만 실행한다. 품질/E2E 뒤에만 기존 배포 job이 실행된다.
- PR CI는 동일 저장소의 신뢰된 브랜치만 허용한다. 저장소의 private fork workflow 실행도 비활성 상태임을 확인했다.
- `pull_request_target`는 도입하지 않는다. `GITHUB_TOKEN` 권한은 기존 `contents: read`를 유지하고 checkout credentials를 남기지 않는다.
- cleanup은 닫힌 PR의 코드를 실행하지 않고 repository default branch를 checkout한다.
- macOS에서는 Playwright Chromium만 설치하며 Linux의 `--with-deps`/apt를 사용하지 않는다.
- pnpm 실행 파일과 store는 `runner.tool_cache` 하위 `offside-pnpm`/`offside-pnpm-store`로 제한한다.
  사용자 전역 pnpm 설정은 수정하지 않는다. 지속형 로컬 store를 사용하므로 setup-node의 GitHub 원격 캐시는 비활성화한다.
- E2E는 worker 1개, 포트 `5274`로 개발 세션과 충돌 가능성을 줄인다. 포트가 사용 중이면 다른 프로세스를 임의 종료하지 않는다.
- `workflow_dispatch`는 Quality/Browser 검사만 수동 실행한다. 기존 PR preview 및 main push staging 배포 조건은 유지한다.
- GitHub artifact/cache 저장소 제한은 로컬 러너와 별개다. 그러한 오류가 생겨도 성공으로 숨기지 않는다.

**이 디렉터리는 보안 샌드박스가 아니다.** job은 로그인 사용자의 권한으로 실행되므로 그 사용자의 파일에 접근할 수 있다.
현재 저장소 접근자는 owner 한 명으로 확인했다. 신뢰하지 않는 코드/외부 기여자/공개 저장소를 받기 전에는
전용 계정 또는 격리 VM/서버로 이전해야 한다. job guard나 checkout 청소만으로 이 신뢰 경계를 대체하지 않는다.
Cloudflare secret은 기존 배포 job에만 전달하며 출력하지 않는다. 하나의 지속형 host이므로 악성 PR로부터
후속 배포를 격리하는 구성이 아니라는 점도 유지보수자가 인지해야 한다.

## 운영

설치 디렉터리에서 실행한다.

```sh
./svc.sh status
./svc.sh stop
./svc.sh start
```

일시 중단은 `stop`, 로그인 시 자동 시작 설정 해제는 공식 `./svc.sh uninstall`을 사용한다.
러너 등록을 폐기하려면 GitHub Settings → Actions → Runners에서 이 이름의 등록을 제거한다.
캐시나 `_work` 정리는 job이 실행 중이지 않은 것을 확인하고 구체적인 대상만 검토한다.
사용자 홈/개발 저장소 전체를 지우는 정리 명령은 사용하지 않는다.

실행 상태는 repository runner API와 Actions의 실제 `runner_name`/job 결과를 함께 확인한다.
서비스가 시작됐다는 것만으로 CI나 배포 성공으로 간주하지 않는다.

## 기존 PR 재개

과거 실패 run을 그대로 재실행하면 과거 commit의 `ubuntu-latest` workflow를 다시 사용한다.
전환 PR을 검증·병합한 뒤 각 진행 브랜치에 최신 main을 반영해서 새로운 head의 CI를 실행해야 한다.
PR #91 → #92(base를 main으로 변경) → #95 expanded QA → Phase 5 순서를 유지한다.
#95의 수동 expanded workflow도 병합 전에 같은 runner label로 바꿔야 하며,
Phase 5 후보/미완료 밸런스를 이 인프라 전환만으로 승인하지 않는다.

## 근거

- [GitHub: macOS runner service](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/configuring-the-self-hosted-runner-application-as-a-service?platform=mac)
- [저장소 runner 설정](https://github.com/tasddc1226/offside-football-simulator/settings/actions/runners)

실제 CI·배포 결과는 전환 PR 및 Actions run에 추가 기록한다.

첫 실행 `33964142024`는 실제 Mac에서 브라우저 98 passed / 6 skipped를 확인했다.
그 뒤 setup-node 원격 cache 저장 단계에서 runner 전용 경로 보완을 위해 의도적으로 취소했다.
로그상 초기 store는 action 기본값인 사용자 홈의 `setup-pnpm` 아래였으며 개인 `Library/pnpm` store를
업로드했다고 주장하지 않는다. 이 취소 실행을 전체 CI 합격으로 기록하지 않고 보완한 head로 다시 검증한다.
PR #91에서 이미 반복 검증한 첫 시즌 결과 테스트의 고정 시드도 함께 반영한다. 무작위 INTEREST 시장
개방 여부로 `/preseason` 경로 검사가 흔들리지 않게 하며, 게임 코드나 assertion을 완화하지 않는다.
