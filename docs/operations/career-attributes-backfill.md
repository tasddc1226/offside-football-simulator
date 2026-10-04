# 기존 은퇴 선수의 카드 능력치 백필

원본 최고 시점 능력치(`careers.peak_profile`)가 없는 은퇴 선수에게 카드 표시용
추정 능력치를 채운다. 웹·앱에서 `추정 능력치`라고 표시하며, 원본이 있으면 항상
원본을 우선한다. 진행 중인 커리어는 대상이 아니다.

## 계산

`tooling/scripts/backfill-career-attrs.mjs`의 `peer-offset-median-v1`을 사용한다.

- 실제 능력치가 저장된 은퇴 기록만 참고한다. 이전 추정치는 학습에 쓰지 않는다.
- 같은 포지션·선수 유형·세부 포지션의 기록을 우선한다. 표본이 8명 미만이면
  같은 포지션·유형, 같은 세부 포지션, 같은 큰 포지션 순서로 범위를 넓힌다.
- 선택한 표본 중 최고 OVR 차이가 5 이하인 기록이 8명 이상이면 그 기록만 쓴다.
- 각 능력치와 최고 OVR의 차이를 중앙값으로 구한 뒤 대상 선수의 최고 OVR에 더한다.
  반올림한 값은 0~99로 제한한다. 임의의 난수·선수 이름·계정 정보는 사용하지 않는다.
- 표본이 부족하거나 포지션·OVR·기존 원본 데이터가 잘못된 행은 건너뛰고 보고한다.

이는 당시 실제 능력치의 복원이 아니다. 최고 OVR 하나만으로 세부 능력치를
역산할 수 없으므로 추정 표기를 유지한다.

## 보존 범위

추정치는 새 nullable 필드 `careers.card_attrs_json`에만 쓴다. 기존 `peak_profile`,
포지션별 실력(`roles`), 최고 OVR, LS, 팀 편성, 경기 기록은 수정하지 않는다.
API는 추정치를 `players[].attrs`와 `attrsEstimated: true`로 전달하되, 경기와
포지션 OVR 계산에는 사용하지 않는다. 새 선수의 원본 능력치 저장 경로는 그대로다.

비어 있는 필드만 채우고 이미 채운 선수는 건너뛴다. 쓰기 시점에도 선수 id,
은퇴 상태, 포지션·유형·세부 포지션·최고 OVR과 원본/추정 필드의 null 여부를
확인하므로 실행 중 변경된 기록을 덮어쓰지 않는다. 정상 완료 후 원본 필드의
해시와 실제 적용 수를 재확인한다.

## 실행

프로젝트의 Node 버전과 pnpm을 사용한다. 기본값은 로컬 DB의 읽기 전용 미리보기다.
읽기 전용 미리보기는 DB 마이그레이션 전에도 실행할 수 있다.

```sh
node tooling/scripts/backfill-career-attrs.mjs --env local --dry-run
node tooling/scripts/backfill-career-attrs.mjs --env production --dry-run
```

운영 적용 전 `0052_career_card_attrs.sql`의 nullable 필드를 추가한다. 이 필드는
기존 코드와 호환되므로 DB 백필을 먼저 진행할 수 있다. 운영 화면에서 추정치를
보려면 API·웹·앱의 추정 표기 코드도 기존 배포 절차에 따라 반영해야 한다.
DB 작업 전에 D1 Time Travel 북마크와 아래 변경분 복구 자료를 확보한다.
이 도구는 마이그레이션이나 배포를 자동 실행하지 않는다.

운영 DB가 명시적으로 대상인 경우에만 아래 명령을 실행한다. 마지막 미리보기의
누락/건너뜀 수를 확인하고, 기존 UI와 다른 서버 코드를 변경하지 않는다.

```sh
node tooling/scripts/backfill-career-attrs.mjs --env local --apply
node tooling/scripts/backfill-career-attrs.mjs --env production --apply --confirm-production offside-production
```

운영 대상은 `apps/api/wrangler.jsonc`의 `production` 환경 `offside-production`이다.
현재 설치된 프로젝트 Wrangler로 실행하며, 읽기/쓰기 구분은 [D1 실행 명령](https://developers.cloudflare.com/d1/wrangler-commands/#d1-execute)을 따른다.
운영은 `--remote --env production`, 로컬은 `--local --persist-to .wrangler/state`로
주소를 명시한다. 운영은 100명씩 `--command` 쿼리로 처리하며 서비스 요청을 막는
SQL 파일 import를 사용하지 않는다. 로컬은 200명씩 처리한다. 중간에 실패하면 원인을 해결한 후
같은 명령을 재실행해 남은 대상만 처리한다.

결과는 기본적으로 git에서 제외된 `.local-dev/career-attrs-backfill/<환경-시각>/`에
저장한다. `--out <디렉터리>`로 지정할 수도 있다. 재실행할 때는 새 디렉터리를 사용한다.
기존 되돌리기 파일이 있는 디렉터리는 덮어쓰지 않는다. `before.json`, `apply.sql`,
`rollback.sql`에는 커리어 id와 데이터가 들어 있으므로 공개 저장소에 커밋하거나
공유하지 않는다. 표준 출력은 전체 대상 수와 집계만 포함한다.

`report.json`에서 `estimated`(이번 대상), `originalPreserved`(원본 보존),
`previousBackfillPreserved`(이전 적용 보존), 건너뜀 수를 확인한다. 적용 후
`applied`가 대상 수와 같고 `remaining.estimated`가 0이며
`originalDataUnchanged`가 true인지 확인한다. 새 은퇴가 발생하면 다시 실행해
그 사이 추가된 누락 기록만 채울 수 있다. 화면 진입 시 자동 백필·폴링은 하지 않는다.

## 변경분 되돌리기

각 실행의 `rollback.sql`은 이번에 생성한 JSON과 현재 값이 같은 행에만 null을
쓴다. 다른 실행의 값과 실제 최고 시점 능력치는 건드리지 않는다. 문제가 생긴
실행의 파일만 지정하며, 전체 운영 DB 복원은 이 작업의 범위가 아니다.

```sh
pnpm --filter @offside/api exec wrangler d1 execute offside-local --local --persist-to .wrangler/state --file <해당-실행/rollback.sql>
```

운영 복구도 `rollback.sql`을 100개 UPDATE 이하로 나누고, Node `spawnSync` 등의
인자 배열로 각 배치 SQL을 `--command`에 전달한다. 운영에서 `--file` import는
사용하지 않는다. 전체 DB Time Travel 복원은 별도 운영 판단이 필요한 작업이다.

## 2026-10-03 운영 DB 적용

사용자의 운영 DB 적용 요청에 따라 `0052_career_card_attrs.sql`과 추정치 3,989건을
반영했다. 100명씩 40개 쿼리 배치로 처리했으며, 변경 전 북마크와 행별 복구 자료를
확보했다. 기존 원본 능력치·최고 OVR·LS·은퇴 기록의 해시가 동일함을 확인했다.

최종 조회 기준 은퇴 16,500명 중 원본 12,511명, 추정 3,989명이며 누락과 잘못된
추정값은 각각 0건이다. 진행 중인 선수의 추정값도 0건이고 운영 API는 정상 응답했다.
DB 적용에 이어 [PR #438](https://github.com/tasddc1226/offside-football-simulator/pull/438)의
추정 표기 코드를 [v2026.10.03.13](https://github.com/tasddc1226/offside-football-simulator/releases/tag/v2026.10.03.13)으로
운영 API·웹과 iOS·Android production OTA에 배포했다. 양 플랫폼 OTA의 커밋은
배포 커밋 `7f8d39e`와 일치하며, 기존 1.0.2 production 빌드와 런타임이 호환된다.
앱 버전 번호는 1.0.2를 유지한다. 배포 확인 시점 iOS 1.0.2는 심사 대기이며,
공개 중인 1.0.1은 스토어에서 1.0.2로 업데이트한 뒤 이번 OTA를 받을 수 있다.

배포 후 읽기 전용 집계는 은퇴 17,002명, 원본 13,013명, 추정 3,989명,
누락 0명이며 진행 중인 선수의 추정값도 0건이다. 새 은퇴 기록에도 원본 능력치가
저장되고 있다. 운영 API 정상 응답과 웹 산출물 22개의 일치를 확인했다.

배포 전 CI에서 단위 테스트 1,081개, 웹 E2E 156개(9개 제외), 동의 흐름 9개,
2,000회 커리어 스모크를 통과했다. 로컬 모바일 웹의 카드와 추정 표기는 확인했으나,
iOS·Android의 최종 화면 재확인은 시뮬레이터 응답 지연으로 완료하지 못했다.
[배포 실행과 검증 결과](https://github.com/tasddc1226/offside-football-simulator/actions/runs/37126161986)를
기준으로 운영 반영을 기록한다.
