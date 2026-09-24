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

T-9-001(풀타임 마이그레이션) 이후 `apps/web`은 게임 진행을 서버가 아닌 브라우저 localStorage에만
저장한다. `apps/api`는 health·profile·Google 로그인만 다루며, 서비스 시즌/ruleset/content pack
포인터와 seed upsert는 migration `0015`로 모두 사라졌다. staging/production 두 환경 모두 D1에는
`profiles`·`sessions`·`auth_attempts`·`audit_log`·`idempotency` 다섯 테이블만 남는다.
