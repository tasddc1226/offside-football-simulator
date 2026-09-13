# Staging과 production 두 환경 운영

원격 애플리케이션 배포 대상은 `staging`과 `production`뿐이다. 두 환경의 Worker, origin, secret,
서비스 시즌 포인터를 섞지 않는다. 로컬 `vite preview`는 원격 환경이 아니므로 유지한다.

## 데이터베이스 분리

- staging: `offside-staging` (`37688e3f-b905-4240-abdb-e23e778dfad9`)
- production: `offside-production` (`2cfe462c-204e-4842-805c-5840fc9b1758`)

두 D1 ID는 서로 다르다. staging migration이나 리허설 데이터를 production에 복사하지 않는다.
과거 `offside-preview` D1은 복구·감사를 위해 비활성 보존하지만 workflow나 Wrangler 배포 환경에서는
사용하지 않는다. 과거 expanded Web/API Worker와 GitHub environment는 2026-09-06 삭제했다. 이
Worker들은 staging D1을 공유했으므로 D1 자체는 삭제하거나 초기화하지 않았고 Git 이력으로 코드 복구는
가능하다.

## 배포 표면

- main의 검증된 코드는 staging에 배포하고 smoke test를 수행한다.
- production은 별도 workflow와 승인 절차로 배포한다.
- 새 PR preview와 expanded 배포 workflow·script·Wrangler environment는 없다.
- `cleanup-preview.yml`은 전환 전 PR Worker 잔재만 정리하며 새 preview를 만들지 않는다.

staging의 서비스 시즌 포인터(`ACTIVE_SERVICE_SEASON_ID` → `svc_line_test`)는 바꾸지 않는다. 그 행의
ruleset/content pack은 `apps/api/seeds/bootstrap-non-production.sql`이 정하며, 2026-09-13 룰셋 1.5.0 승격
준비(`release-ruleset-1-5-0`, #208 K리그식 리그·팀 구조 위에 스택)에서 운영 승격 목표 manifest(1.5.0/0.6.0)와
맞췄다. main 머지마다 CI가 이 seed를 staging D1에 upsert하므로 staging은 운영보다 먼저 새 manifest로 새
커리어를 만든다. 절차는 [production-release.md](production-release.md)의 "시즌 1 manifest 3차 승격"을 따른다.
