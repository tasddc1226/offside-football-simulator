# D1 매일 정리·백업 (T-10-070)

`offside-api` 워커의 cron(`0 19 * * *` = 매일 KST 04:00)이 `src/cron/daily.ts`를 돌린다. 결과는 Workers Logs에
`"job":"daily"` JSON 한 줄로 남는다(`level: error`면 정리나 백업 중 하나가 실패).

## 정리

조회 쪽이 이미 걸러 내는 행만 지운다(동작은 같고 표만 가벼워진다). 한 번에 5,000행씩, 표마다 최대 20만 행까지.

| 표 | 지우는 행 |
|---|---|
| `idempotency` | `expires_at`이 지난 행 |
| `auth_attempts` | 윈도 시작이 하루보다 오래된 행(윈도는 1시간) |
| `sessions` | 만료·폐기된 지 30일이 지난 행 |

## 백업

D1 Time Travel(30일 시점 복구)과 별개로, D1 밖(R2)에 SQL 사본을 둔다.

- 위치: R2 버킷의 `d1/<ENVIRONMENT>/<YYYY-MM-DD>.sql.gz` (UTC 날짜)
- 형식: `wrangler d1 export`와 같은 SQL 텍스트를 gzip — 표 생성 → 데이터(`INSERT`) → 인덱스 순. 표는 외래 키
  참조 순서로 쓴다.
- 보존: 매일 백업은 30일, 매달 1일 백업은 계속.
- 워커에 `BACKUP` R2 바인딩이 없으면 백업만 건너뛴다(정리는 돈다).

### 처음 켜기

1. Cloudflare 대시보드에서 R2를 켠다(계정당 한 번).
2. 버킷을 만든다: `pnpm --filter @offside/api exec wrangler r2 bucket create offside-d1-backup`
3. `apps/api/wrangler.jsonc`의 `env.production`에 바인딩을 넣고 배포한다:
   `"r2_buckets": [{ "binding": "BACKUP", "bucket_name": "offside-d1-backup" }]`

### 복구

빈 D1을 새로 만들어 붓는다(운영 DB에 바로 붓지 않는다 — 확인한 뒤 바꾼다).

```bash
wrangler r2 object get offside-d1-backup/d1/production/2026-09-28.sql.gz --remote --file dump.sql.gz
gunzip dump.sql.gz
wrangler d1 create offside-restore
wrangler d1 execute offside-restore --remote --file dump.sql
```

## 로컬 확인

`wrangler.jsonc` 최상위의 `BACKUP`은 Miniflare가 흉내 내는 로컬 R2다.

```bash
wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=0+19+*+*+*"
```
