# D1 일관 스냅샷과 복구 검증

시작 기준: main `45a64b46`. PR 준비 시 main `d1947eae`까지 반영. 기존 분할 SQL 사본을 복구 가능한 일관 스냅샷으로 오인하지 않도록 보완한다.
제품 데이터·결제·세이브·기존 보존 정책은 바꾸지 않는다.

## 현재 상태와 제공되는 기능

- 기존 `d1/production/<day>/`는 여러 시간에 걸친 **live-copy 보조 사본**이다. 생성 완료와 복구 성공은 별개다.
  이전 운영 자료 복원은 94개 테이블·4,968,958행이 일치했지만 FK 1,711건이 실패했다. 이번 변경이 그 파일을 수정하지 않는다.
- 새 `d1-snapshots/production/<capture>/`는 D1 공식 export가 만든 하나의 시점 자료다.
  로컬 복원, integrity, FK 0건, R2 재다운로드 후 재복원을 모두 통과해야 완료 manifest와 운영 검증 포인터를 게시한다.
- **운영의 새 스냅샷 생성은 아직 실행하지 않았다.** 테스트 DB의 성공을 운영 DB 검증 성공으로 대신하지 않는다.
  워크플로 기본값은 읽기 전용 `preflight`이며 cron으로 예약하지 않는다.
- Time Travel은 D1에서 자동 제공하지만 **같은 DB를 제자리에서 덮어쓰며 다른 DB로 clone/fork하는 기능은 아직 없다**.
  이번 도구에는 운영 Time Travel restore 기능 자체가 없다. [공식 Time Travel 제약](https://developers.cloudflare.com/d1/reference/time-travel/)
- **D1 공식 export는 진행 중 다른 DB 요청을 차단한다.** 운영 capture에는 합의한 정비 시간대가 필요하다.
  명령에 confirmation을 넣었다는 사실만으로 사용자의 중단 승인을 대신하지 않는다. [공식 export 제약](https://developers.cloudflare.com/d1/best-practices/import-export-data/#known-limitations)

## 코드가 보장하는 범위

1. DB UUID와 원격 이름을 대조한다. preflight는 DB 정보와 현재 Time Travel bookmark GET만 수행한다.
2. capture는 `EXPORT_BLOCKS_QUERIES:<UUID>` 확인값을 요구한다. 운영은 main의 `D1 consistent snapshot (manual)` 워크플로와
   `maintenance_approved=true`에서만 실행한다. 일반 로컬 CLI는 운영 capture를 거절한다.
3. capture는 export 전에 전용 R2 probe 객체의 쓰기·읽기·삭제 권한을 먼저 검증한다. 읽기 전용 preflight는 이 probe를 실행하지 않는다.
   토큰에는 D1 읽기/export 및 R2 객체 읽기·쓰기·삭제 권한이 필요하다.
   한 번 시작한 export bookmark를 유지하고 변경되면 실패한다. 기본 120초, 허용 최대 300초 안에 poll한다. 운영 workflow는 상한인 300초까지 기다린다(T-11-686, 5GB export가 2분 안에 끝나지 않을 수 있다).
   제한에 걸리면 더 이상 poll하지 않는다. Cloudflare의 자동 취소가 즉시 완료된다는 보장은 없으므로 실제 DB 응답을 확인해야 한다.
4. signed URL은 인증 헤더 없이 HTTPS로 다운로드하며 URL·SQL·인증 값은 로그에 넣지 않는다.
   작업 파일은 전용 비공개 디렉터리에만 두고 덮어쓰지 않는다. 사전 여유 공간은 DB 크기 × 4 + 1GiB 이상을 요구한다.
   workflow의 capture는 그 공간을 내려고 러너에 미리 깔린 안 쓰는 도구를 먼저 지운다(T-11-686).
5. SQL 문장 경계에서 32MiB 단위로 gzip 조각을 만든다. 단일 문장이 16MiB를 넘으면 실패한다.
   각 조각의 SHA-256·바이트 수, 원본 UUID·bookmark, snapshot 시작 시각을 manifest에 기록한다.
6. 새 로컬 SQLite에 복원해 물리 무결성과 FK를 검사한다. 행을 삭제하거나 FK를 숨겨서 통과시키지 않는다.
   최초 행 수는 스냅샷에서 산출한다. 변하는 운영 DB와 비교해 같은 시점의 행 수라고 주장하지 않는다.
7. 조각을 R2에 올리고 다시 내려받아 해시·바이트 수·테이블/행 수·무결성·FK를 재검증한다.
   검증 후에만 `manifest.json`을 게시한다. 업로드 실패의 부분 prefix는 완료 백업으로 광고하지 않는다.
8. 운영 UUID의 스냅샷만 `d1-snapshots/production/last-verified.json`을 갱신한다. 테스트 자료는 운영 포인터를 갱신하지 않는다.
   표준 workflow는 운영 배포와 같은 concurrency group을 사용한다. 토큰을 직접 사용하는 별도 도구를 동시에 실행하지 않는다.

R2 조각에는 `Content-Encoding: gzip`을 설정하지 않아 재다운로드 해시가 원래 gzip 바이트와 일치한다.
SQL 원문·복원 DB는 Actions artifact에 올리지 않으며 workflow 종료 시 해당 작업 임시 디렉터리를 정리한다.
별도 snapshot prefix는 기존 30일/월초 live-copy 정리 대상에 들어가지 않는다. 자동 삭제 정책은 추가하지 않았다.

## 감시 상태

- `cron:backup:last`의 새 생성 결과에는 `consistency: live-copy`, `restoreVerified: false`가 붙는다.
- `cron:infra-health:last.backupRecovery`는 운영 포인터·manifest 해시·출처·시각을 확인한다.
- 검증 자료 없음/오류는 `backup-recovery-unverified`, snapshot 시작 시각이 35일 초과면 `backup-recovery-stale` 이슈다.
- 여기서 35일은 검증된 R2 사본의 신선도 기준이다(T-11-686, 이전 30시간). export가 운영 DB 요청을 막아 매일 찍을 수 없으므로
  달마다 한 번 정비 시간에 찍는다. 그 사이의 복구는 D1 Time Travel(30일)이 맡는다. Time Travel 장애 판정이나 서비스 장애율을 의미하지 않는다.
- 시간별 검사는 작은 포인터/manifest와 조각 목록의 존재·크기를 확인한다(최대 11페이지). 조각별 HEAD나 전체 payload 다운로드는 하지 않는다. 매 시간 전체 조각을 재복원했다는 뜻은 아니다.
  전체 재검증은 capture 시 수행했으며 이후 정기 훈련을 별도로 해야 한다.
- 운영 snapshot 전까지 이 이슈가 남는 것이 의도된 동작이다. 기존 live-copy 완료만으로 지우지 않는다.

## 운영 실행 순서

1. PR 검토·CI 완료 후 도구를 main에 반영한다. 감시 코드 배포와 query-blocking snapshot 실행은 별개 단계다.
2. 읽기 전용 preflight로 정확한 운영 UUID·이름·현재 bookmark·크기를 확인한다.
3. 사용자와 정비 시작 시각·중단 허용 범위를 합의한다. API 트래픽 영향, 실행 중인 배포·cron을 고려한다.
4. 합의한 시간에 `D1 consistent snapshot (manual)`을 main에서 실행한다.
   입력: `mode=capture`, 정확한 `expected_sha`, `maintenance_approved=true`,
   `confirmation=EXPORT_BLOCKS_QUERIES:2cfe462c-204e-4842-805c-5840fc9b1758`.
5. 실패·시간 초과면 원격 export 종료와 API 응답을 확인한다. 실패 원문 SQL이나 signed URL을 공개 로그로 옮기지 않는다.
6. 완료 manifest, 운영 포인터, API health, 다음 시간별 `backupRecovery=verified`를 확인한다.
   export 시간과 R2 전송·로컬 검증 시간을 구분해 기록한다. 작은 테스트 DB 시간으로 운영 정비 시간을 산정하지 않는다.
7. 성공한 운영 snapshot을 주기적으로 다시 복원해 확인한 뒤, 정비 일정·자동화 주기를 결정한다.

읽기 전용 로컬 preflight:

```bash
node tooling/scripts/d1-snapshot.mjs --mode preflight \
  --database-id 2cfe462c-204e-4842-805c-5840fc9b1758 --expected-name offside-production
```

이미 내려받은 새 snapshot 조각은 manifest의 `file` 이름(`0001.sql`, …)으로 둔다.

```bash
umask 077
python3 tooling/scripts/snapshot-backup.py verify \
  --source "$SNAPSHOT_DIR" --destination "$SNAPSHOT_DIR/new-restored.sqlite"
```

snapshot verify 명령은 SQLite 복원이다. 격리 drill은 작은 전용 자료의 원격 D1 재수입도 검사하지만, 운영 전체 D1 재수입·앱 smoke 검증·운영 전환을 대신하지 않는다.

## 실제 격리 훈련 결과 (2026-11-02 KST)

전용 `offside-recovery-drill-*` DB를 새로 만들었다. 운영·스테이징·프리뷰 바인딩은 붙이지 않았다.

- 부모/자식 2개 테이블·2개 행의 값 10을 기록하고 bookmark를 가져왔다.
- 값을 20으로 바꾼 뒤 **테스트 DB 자신만** Time Travel restore하여 10으로 돌아온 것을 확인했다.
- 공식 export → 새 로컬 SQLite 검사 → R2 저장 → 재다운로드 → 새 SQLite 복원을 통과했다. FK 위반 0건.
- 원본 테스트 DB를 다시 99로 바꾼 뒤에도 R2 스냅샷 재복원 값은 10으로 유지됐다.
- 마지막 검증에서는 전용 D1의 이 두 fixture 테이블만 비우고 R2 SQL을 재수입해 값 10과 `PRAGMA foreign_key_check` 0건을 원격 D1에서도 확인했다.
- 테스트 export 시간은 최초 **2,562ms**, 재검증 **3,823ms**, 원격 D1 재수입 포함 훈련 **2,824ms**다. 운영 4.5GB의 export 시간·RTO·서비스 영향은 아직 측정하지 않았다.
- 이 훈련은 플랫폼 경로의 동작 증거이며, 운영 전체 DB의 복구 정합성 검증 성공은 아니다.

관련 파일: `d1-snapshot.mjs`(capture/publish), `snapshot-backup.py`(pack/verify),
`d1-recovery-drill.mjs`(전용 빈 DB만 허용하는 훈련), `backupRecovery.ts`(시간별 상태).

## 검증 결과와 운영 적용 경계

- 관련 API 4개 파일 36개 테스트, 도구 단위 테스트, 타입·린트·의존 경계·i18n·형식 검사를 수행했다.
- 운영 읽기 전용 preflight에서 DB 이름·현재 bookmark 조회가 성공했고 크기는 4,489,318,400 bytes였다.
  생산 자료 export나 Time Travel restore는 실행하지 않았다.
- 테스트 전용 DB·R2 객체는 왕복 복구 증거를 집계로 남긴 뒤 정리한다. 운영·staging·preview 데이터나 기존 R2 사본은 삭제하지 않는다.
- 운영 전체 복구 검증과 운영 RTO 측정은 정비 창 승인 후 native snapshot을 실행해야 완료된다.
  이 PR의 기능·가드 구현 완료를 운영 백업 정합성 문제가 이미 해결됐다는 뜻으로 보고하지 않는다.
