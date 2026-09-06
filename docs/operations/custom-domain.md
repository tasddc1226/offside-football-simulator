# offside-lab.com 운영 도메인 전환

작성: 2026-09-06. 사용자가 Cloudflare에서 직접 구매한 도메인을 기존 운영 Worker에 연결한다.

## 구성과 보존 범위

| 웹 | API | 용도 |
| --- | --- | --- |
| `https://offside-lab.com` | `https://api.offside-lab.com` | 대표 주소 |
| `https://offside-web.tasddc1569.workers.dev` | `https://offside-api.tasddc1569.workers.dev` | 기존 기록 접근·이전 호환 |

두 주소는 같은 `offside-web`, `offside-api`, D1 `offside-production`을 사용한다.
시즌 1은 종료일 미정이며 규칙·콘텐츠 버전과 선수 기록을 변경하지 않는다.
Wrangler production `custom_domain` 경로로 DNS/TLS를 관리하고 `workers_dev: true`를 유지한다.
구매 확인 당시 DNS 레코드는 0개였다. 다른 도메인과 이메일 자원은 변경하지 않는다.

## 인증과 저장

- 웹은 정확한 현재 호스트에 대응하는 API를 선택한다. 기존 주소의 번들도 기존 API를 사용한다.
- 운영 API는 요청 URL의 호스트만으로 웹 반환 주소·Google callback·허용 origin을 결정한다.
  임의 Origin, forwarded header, return URL을 신뢰하지 않는다. 개발·스테이징은 기존 설정을 유지한다.
- 기존 host-only 세션/OAuth 쿠키와 SameSite 정책은 유지한다. Google scope는 `openid email` 그대로다.
- 개인 GCP 프로젝트 `offside-football-prod`의 `OFFSIDE Production Web` 클라이언트에
  `https://api.offside-lab.com/v1/auth/google/callback`을 **추가**하고 기존 callback은 남긴다.
- localStorage/IndexedDB는 도메인 간 자동 이전되지 않는다. 이전 주소에서 동기화를 완료하고
  Google 연결 또는 복구 코드를 준비한 뒤 새 주소 설정에서 복원한다. 강제 리디렉션하지 않는다.
- 브라우저 전용 미동기화 기록까지 이동을 보장하지 않는다. 복구 코드·토큰을 URL/로그에 넣지 않는다.

## 배포와 검증

1. GCP 새 callback 저장 후 다시 열어 두 callback이 유지되는지 확인한다.
2. PR #117 SEO 기반 및 도메인 호환 변경을 검증 후 main에 병합한다.
3. production workflow를 정확한 main SHA로 실행한다. 기존 Time Travel/시즌 CAS 보호를 유지한다.
4. 새 웹/API TLS와 health, CORS host pairing, 시즌 1 종료일 미정, 기존 URL 접근을 확인한다.
5. 새 주소에서 저장·새로고침·복원 및 Google 반환 경로를 확인한다. 계정 확인이 필요하면 사용자에게 요청한다.
6. `VITE_PUBLIC_SITE_URL=https://offside-lab.com`을 사용하되 검색 허용은 검증 후 별도 변경한다.
   OFF 상태 robots는 Disallow, sitemap은 404다. 공개 시 canonical/사이트맵은 대표 주소 3페이지만 포함한다.
7. Search Console/네이버 소유권 인증·사이트맵 제출과 Google 브랜딩 도메인 갱신은 별도 인수한다.

## 로컬 검증

API 인증/host pairing 중심 42개, 웹 API 선택 등 7개 테스트와 API·웹 타입 검사를 통과했다.
API·웹 production Wrangler dry-run도 통과했다. 운영 배포와 실제 로그인 완료는 로컬 검사와 구분한다.

## 되돌리기

새 도메인 장애가 나도 기존 workers.dev 주소를 안내할 수 있다. 운영 데이터 삭제나 DB 롤백으로
도메인 문제를 해결하지 않는다. 이전 버전 배포가 필요하면 새 도메인의 API/CORS 호환을 함께 검토한다.

## 운영 확인 기록 (2026-09-06)

- PR #117, #118 병합. 도메인 배포 커밋 `98a0cb22864858f0625f054562c116e1b285e2ed`.
- Cloudflare DNS에서 웹/API 각각 해당 Worker를 가리키는 프록싱 레코드를 확인했다.
- 첫 production run `34028765426`은 API·웹 배포 및 시즌 검증 후 마지막 웹 probe에서
  DNS 전파/로컬 negative cache 때문에 exit 6으로 실패했다. 배포 전체 성공으로 표현하지 않는다.
- 이후 ego-browser에서 새 웹 HTTPS, 공개 3개 URL과 온보딩 HTTP 200, 잘못된 일반 경로 404,
  새 API 시즌 1 ACTIVE/isTest=false/endsAt=null/규칙 1.3.0·콘텐츠 0.5.0을 확인했다.
- 새 주소에서 실제 개인 Google 계정 인증 후 새 `/settings`로 돌아왔으며 연결 상태를 확인했다.
  이전 주소에서 비교한 QA 선수 4개의 revision(10/66/55/56)과 stateHash가 신규 API에서 모두 일치했다.
  복원된 허브와 선수 홈 및 새로고침 후 저장됨 표시를 확인했다. 사용자 선수 진행·삭제는 하지 않았다.
- 원본 공개 HTML의 canonical/OG 이미지는 새 대표 주소를 사용한다. 첫 배포는 검색 OFF였으며
  후속 검색 활성화 배포에서 공개 3개 페이지만 허용한다. 실제 색인/순위는 보장하지 않는다.
- Google 브랜딩의 홈페이지·개인정보처리방침·약관 링크를 새 주소로 갱신했다.
  Google 브랜드 심사와 Search Console/네이버 등록 완료를 뜻하지 않는다.
