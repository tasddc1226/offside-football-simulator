# ADR-007. 호스팅·인프라·CI·비용

- 상태: 확정 (2026-09-02)
- 관련: [ADR-002](ADR-002-persistence-and-identity.md), [ADR-005](ADR-005-monorepo-boundaries.md), [배포·운영](../development/09-deployment-and-operations.md)

## 결정

모든 인프라를 **Cloudflare** 한 계정에 둔다.

| 역할 | 서비스 | 비고 |
|---|---|---|
| 웹 앱·정적 콘텐츠 팩 | Cloudflare Pages | Git 연동, PR마다 preview URL |
| API | Cloudflare Workers + Hono | 라우트 `api.<domain>/v1/*` |
| DB | Cloudflare D1 (SQLite) + Drizzle ORM | 리전은 APAC(서울 근접) 우선 |
| 객체 저장 | Cloudflare R2 | 과거 콘텐츠 팩, 명령 로그 아카이브, D1 백업 export |
| 캐시·세션 보조 | Cloudflare KV | rate limit 카운터, 세션 블랙리스트. 세션 자체는 D1 |
| DNS·TLS·CDN | Cloudflare | Universal SSL |
| 오류 추적 | Sentry (무료 tier) | 브라우저 + Workers. 선수명·쿠키·복구 코드 스크러빙 |
| 제품 지표 | Cloudflare Web Analytics + 자체 이벤트 테이블(D1) | 쿠키 없는 분석. 06 문서의 5개 이벤트만 |
| 로그 | Workers Logs | 구조화 JSON, requestId |
| 배치 | Cloudflare Cron Triggers | 시즌 전환, D1 → R2 백업, 밸런스 리포트 |
| 관리자 | Cloudflare Access로 `admin.` 보호 | Phase 7. 초기에는 wrangler CLI로 운영 |

## 환경

| 환경 | 웹 | API | DB | 용도 |
|---|---|---|---|---|
| local | `vite dev` | `wrangler dev` | D1 로컬(Miniflare) | 개발, fixture |
| preview | Pages PR preview | Workers preview (`<pr>.api-preview.`) | preview D1 (PR별 초기화) | PR 검증 |
| staging | `staging.<domain>` | `staging-api.<domain>` | staging D1 | migration·E2E·시즌 전환 리허설 |
| production | `<domain>` | `api.<domain>` | production D1 | 정본 |

운영 데이터는 개발 환경으로 복사하지 않는다. staging은 합성 데이터만 쓴다.

## CI/CD (GitHub Actions)

1. PR: lint, typecheck, unit·property, `content:validate`, contract test, migration dry-run, Playwright P0 smoke, axe.
2. PR: Pages preview 자동 배포, Workers preview `wrangler deploy --env preview`.
3. main 머지: staging 배포, `wrangler d1 migrations apply`, E2E 전체.
4. 태그 `v*`: production 배포. 콘텐츠 팩·ruleset checksum이 release manifest와 일치해야 진행.
5. 롤백: Pages는 이전 배포로 즉시 전환, Workers는 이전 버전 재배포, D1은 roll-forward 우선(09 문서).

## 백업·복구

- D1 Time Travel(유료 30일)로 시점 복구.
- 매일 Cron으로 D1 export를 R2에 저장, 90일 보관.
- 콘텐츠 팩·ruleset은 Git 태그와 R2에 이중 보존.
- 분기 복구 리허설은 09 문서를 따른다.

## 비용 (2026-09 기준 추정, 사용자 확인 필요)

| 항목 | 월 비용 | 메모 |
|---|---:|---|
| Workers Paid 플랜 | 5달러 | D1·KV·R2 한도 확장, Time Travel. 출시 시점부터 |
| Pages | 0 | 무료 tier로 충분 |
| D1·R2·KV 사용량 | 0~2달러 | 초기 사용량은 포함 한도 안 |
| 도메인 | 연 10~40달러 | TLD에 따라 다름 |
| Sentry | 0 | 무료 tier, 초과 시 이벤트 샘플링 |
| GitHub Actions | 0 | 공개 저장소면 무료, 비공개면 월 2,000분 |

목표 고정비는 도메인을 제외하고 월 5달러 안팎이다. 사용자 1만 명 규모에서도 한도 조정 없이 유지될 것으로 본다. 넘으면 먼저 Snapshot 압축과 명령 로그 R2 이관을 한다.

## 검토한 대안

| 대안 | 보류 이유 |
|---|---|
| Vercel + Neon + Auth.js | 익숙한 조합이지만 Vercel Hobby는 상용 불가, Pro 20달러. Neon 서울 리전 없음 |
| Supabase + 정적 호스팅 | 익명·소셜 연결이 내장돼 편하지만 무료 tier는 7일 미사용 시 일시정지, Pro 25달러 |
| AWS (Lambda·RDS·S3) | 운영 부담과 최소 비용이 1인 프로젝트에 과함 |
| Firebase | Firestore 모델이 관계형 Snapshot·명령 로그와 맞지 않음 |

## 결과

- 09 배포·운영 문서의 환경 표를 이 ADR에 맞춰 갱신한다.
- Phase 0 완료 조건에 "preview·staging 배포 파이프라인 동작"이 포함된다.
- Cloudflare 계정·GitHub Secrets·Sentry 프로젝트 생성은 사용자 액션이다. 추적 보드에 등록한다.
