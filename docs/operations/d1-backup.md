# D1 매일 정리·백업 (T-10-070)

`offside-api` 워커의 cron(`0 19 * * *` = 매일 KST 04:00)이 `src/cron/daily.ts`를 돌린다. 결과는 Workers Logs에
`"job":"daily"` JSON 한 줄로 남는다(`level: error`면 정리나 백업 중 하나가 실패).

## 정리

조회 쪽이 이미 걸러 내는 행만 지운다(동작은 같고 표만 가벼워진다). 한 번에 5,000행씩, 표마다 최대 20만 행까지.

| 표              | 지우는 행                                                  |
| --------------- | ---------------------------------------------------------- |
| `idempotency`   | `expires_at`이 지난 행                                     |
| `auth_attempts` | 윈도 시작이 하루보다 오래된 행(윈도는 1시간)               |
| `sessions`      | 만료된 지 30일이 지난 행(폐기된 세션도 만료 뒤에 지워진다) |

## 백업

D1 Time Travel(30일 시점 복구)과 별개로, D1 밖(R2)에 SQL 사본을 둔다.

- 위치: R2 버킷의 `d1/<ENVIRONMENT>/<YYYY-MM-DD>.sql.gz` (UTC 날짜)
- 형식: `wrangler d1 export`와 같은 SQL 텍스트를 gzip — 표 생성 → 데이터(`INSERT`) → 인덱스 순. 표는 외래 키
  참조 순서로 쓴다.
- 보존: 매일 백업은 30일, 매달 1일 백업은 계속(코드에서 지운다 — 버킷 수명 주기 규칙으로 옮길 수도 있지만 정책을
  레포에 두려고 코드로 했다).
- 워커에 `BACKUP` R2 바인딩이 없으면 백업만 건너뛴다(정리는 돈다).

### 조회 부하 제어 (T-11-247)

- 페이지 응답은 기존과 같이 4MiB를 목표로 SQL에서 자른다. 한 행이 더 크면 그 행 하나는 포함한다.
- 후보 행의 크기는 `octet_length(column)`으로 구한다. TEXT/BLOB의 길이는 SQLite 레코드 메타데이터로
  계산하므로, 크기를 재기 위해 큰 JSON을 BLOB으로 변환해 다시 읽지 않는다. 후보 수는 64에서 시작해
  실제로 내보낸 행 수에 따라 조정하고 최대 2,000행을 유지한다.
- 데이터 페이지를 내보낸 뒤 20ms를 기다린다. gzip/R2의 backpressure와 별도로 게임 요청이 DB를 사용할
  틈을 둔다. 결과 로그의 `backup.pages`는 비어 있지 않은 페이지 수, `backup.pauseMs`는 의도한 대기시간
  합계다(실측 wall time이 아니다).
- `app_meta`의 `cron:backup:lease`를 원자적으로 선점해 같은 DB의 중복 백업을 막는다. 진행 중이면
  명시적으로 실패 처리하고 두 번째 R2 업로드를 열지 않는다. 성공·실패 시 자기 잠금만 지우고, 런타임이
  중단돼 정리하지 못하면 20분 뒤 만료된다. 만료시간은 scheduled handler의 15분 실행 상한보다 길다.
- 완성된 SQL gzip 한 파일·R2 multipart 완료 후 성공 처리·실패 시 abort·보존 기간은 유지한다.
  여러 cron에 걸친 이어받기는 구현하지 않았다. 대기시간도 실행시간에 포함되므로 다음 운영 실행에서
  `daily.durationMs`, 백업 완성 여부, API 503과 p99를 함께 확인한다. 시간 초과가 반복되면 별도로
  체크포인트가 있는 작업 구조로 옮겨야 한다.

### 배포 후 확인

1. 다음 KST 04:00 실행의 `job=daily`와 `backup.pages`/`pauseMs`, R2 객체 완료를 확인한다.
2. 03:55~04:20의 HTTP 503, `errorMessage`의 D1 overload, API p99, 백업 SQL 합계 실행시간을 비교한다.
   SQL 통계는 adaptive 추정치이고, SQL 실행시간은 DB 대기시간이나 CPU 사용률이 아니다.
3. `daily`가 정상 종료해도 게임 API가 실패했으면 개선 완료로 판단하지 않는다. 복구 가능성 검증은
   별도의 빈 **로컬** D1에 SQL을 복원해서 확인하고, 운영 DB에는 복원하지 않는다.

로컬 Miniflare D1에서 512행 × UTF-8 131,070바이트(약 64MiB)를 만들고 같은 후보 크기 계산을 각 방식으로
6회 교차 실행했다. 기존 `length(CAST(... AS BLOB))` SQL은 12~~15ms, 변경 후 `octet_length` SQL은
0~~1ms였다(D1 로컬 duration, 밀리초 해상도). 같은 페이지 경계를 반환했다. 이는 크기 계산 단계만의
비교이며 전체 백업 시간이나 운영 API의 개선율을 의미하지 않는다. 큰 UTF-8/BLOB 페이지 제한·누락 없음,
빈 로컬 D1 복원, 중복 실행, 만료 잠금 복구, 업로드 실패 시 기존 객체 보존은 별도 회귀 테스트로 확인한다.

### 설정

운영(`env.production`)에 버킷 `offside-d1-backup`이 `BACKUP`으로 붙어 있다(2026-09-27, T-10-071). staging에는 없다.
새 계정에서 다시 켤 때: 대시보드에서 R2를 켜고 → `wrangler r2 bucket create offside-d1-backup` → 바인딩을 넣고 배포.

### 복구

빈 D1을 새로 만들어 붓는다(운영 DB에 바로 붓지 않는다 — 확인한 뒤 바꾼다).

```bash
wrangler r2 object get offside-d1-backup/d1/production/2026-09-28.sql.gz --remote --file dump.sql
wrangler d1 create offside-restore
wrangler d1 execute offside-restore --remote --file dump.sql
```

객체는 gzip으로 저장하지만 `Content-Encoding: gzip`을 달아 둬서, `wrangler r2 object get`(fetch)은 받으면서 풀어 준다.
이름이 `.sql.gz`여도 받은 파일은 평문 SQL이라 `gunzip`이 `not in gzip format`으로 실패한다. 압축본을 그대로 받는
도구(S3 API·rclone 등)로 받았을 때만 푼다 — 헷갈리면 `file dump.sql`로 확인한다.

## 장애 기록

- 2026-10-14 KST 04:02: 약 211건의 HTTP 503과 `D1 DB is overloaded. Requests queued for too long` 확인.
  03:55~04:15 D1 SQL 합계 실행시간의 약 83%가 자체 백업 SQL이었다(adaptive 추정치). 장애 직전 HTTP
  응답량에는 뚜렷한 급증이 없고 동시 배포도 없었다. 백업이 가장 유력한 부하 원인이지만 다른 정기 작업의
  영향은 배제하지 못했다. `daily`는 04:14:32에 정상 완료했고 백업은 61개 표·2,991,411행·압축 792,929,414바이트를
  저장했다. 일일 작업 전체 시간은 771,565ms이며 백업 단독 시간이 아니다. 그 파일의 실제 복원은 미검증이다.

- 2026-10-07(UTC) 백업 없음: `backup: {"error":"D1_ERROR: D1 DB's isolate exceeded its memory limit and was reset."}`
  (`cron:daily:last`, 19:04Z, 233초). DB가 1.78GB로 커지면서 2,000행 고정 페이지(`SELECT *`)의 응답이 D1 isolate
  메모리 한도를 넘었다. 같은 날 11:15 KST 배포된 #564(T-11-150)가 페이지를 바이트로 자르도록 고쳤다
  ([인프라 용량 보호](infrastructure-capacity.md#백업)). 빠진 날은 Time Travel(30일)로 덮는다.
- 결과 확인: Workers Logs는 오래 남지 않는다. 운영 D1에서 읽는다 —
  `wrangler d1 execute offside-production --remote --env production --command "SELECT value FROM app_meta WHERE key='cron:daily:last'"`.

## 로컬 확인

`wrangler.jsonc` 최상위의 `BACKUP`은 Miniflare가 흉내 내는 로컬 R2다.

```bash
wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=0+19+*+*+*"
```
