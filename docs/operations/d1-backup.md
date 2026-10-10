# D1 매일 정리·백업 (T-10-070)

`offside-api` 워커의 cron(`0 19 * * *` = 매일 KST 04:00)이 `src/cron/daily.ts`를 돌린다. 결과는 Workers Logs에
`"job":"daily"` JSON 한 줄로 남는다(`level: error`면 정리나 백업 중 하나가 실패).

## 정리

조회 쪽이 이미 걸러 내는 행만 지운다(동작은 같고 표만 가벼워진다). 한 번에 5,000행씩, 표마다 최대 20만 행까지.

| 표 | 지우는 행 |
|---|---|
| `idempotency` | `expires_at`이 지난 행 |
| `auth_attempts` | 윈도 시작이 하루보다 오래된 행(윈도는 1시간) |
| `sessions` | 만료된 지 30일이 지난 행(폐기된 세션도 만료 뒤에 지워진다) |

## 백업

D1 Time Travel(30일 시점 복구)과 별개로, D1 밖(R2)에 SQL 사본을 둔다.

- 위치: R2 버킷의 `d1/<ENVIRONMENT>/<YYYY-MM-DD>.sql.gz` (UTC 날짜)
- 형식: `wrangler d1 export`와 같은 SQL 텍스트를 gzip — 표 생성 → 데이터(`INSERT`) → 인덱스 순. 표는 외래 키
  참조 순서로 쓴다.
- 보존: 매일 백업은 30일, 매달 1일 백업은 계속(코드에서 지운다 — 버킷 수명 주기 규칙으로 옮길 수도 있지만 정책을
  레포에 두려고 코드로 했다).
- 워커에 `BACKUP` R2 바인딩이 없으면 백업만 건너뛴다(정리는 돈다).

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
