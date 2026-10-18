# Cloudflare 비용·실패 복구 점검

T-11-385. 설정 정본은 [정책 파일](../../tooling/cloudflare-infra-policy.json), 작업 계획은 [실행 계획](../tracking/cloudflare-efficiency-plan.md)이다. 신규 유료 구독이나 게임 저장 형식 변경은 없다.

## 정기 점검

기존 `Production infrastructure health`가 매시간 UTC 17분에 실행된다. 기존 D1 건강 상태·완료 백업 확인 뒤 `infra-health.mjs --resources`로 큐 목록 1회, DLQ 지표 4회, R2 최근 저장량 GraphQL 1회를 읽는다. D1/R2/큐에 쓰거나 메시지를 꺼내지 않는다. 이 GitHub Actions 점검은 별도 로컬 MCP 모니터의 승인 도구 목록을 바꾸지 않는다.

- DLQ 적체가 1건 이상이거나 14일 보존 정책이 달라지거나 조회가 불가능하면 잡이 실패한다. `0`은 지표 API에서 실제 0을 받은 경우에만 표시한다.
- R2 현재 payload가 9GB(10GB 참조량의 90%) 이상이면 저장 정책 검토 경고를 남긴다. 최근 2시간 관측이 없거나 Analytics 권한이 없으면 `unknown` 경고다. 실제 월 GB-month 청구량이나 서비스 장애로 해석하지 않는다.
- 기존 D1 건강 상태가 5GB 포함량 참조의 90%를 넘으면 경고한다. 계정 전체 저장량과 실제 청구 주기는 별도로 확인한다. 예산 알림은 지출 상한이 아니다.
- 알림 발송 도구나 새 Slack 목적지는 추가하지 않는다. GitHub 잡 실패·경고와 summary에서 확인한다. 기존 Cloudflare 예산·실시간 오류 알림은 유지한다.

수동 실행: `gh workflow run infra-health.yml --ref main`. 로컬 실행은 기존 Cloudflare 자격 증명을 환경변수로 제공하고 `node tooling/scripts/infra-health.mjs --resources`를 실행한다. 토큰을 명령 인자나 저장소에 쓰지 않는다. 큐 읽기 및 Analytics 읽기 권한이 필요하다.

## 실패 메시지 복구

4개 DLQ만 14일 보존한다. 본 큐의 푸시 보존 1일·결제 보존 4일, 소비자 수·재시도 수는 유지한다. 현재 DLQ에는 자동 소비자가 없으며 장기 미해결 메시지도 14일 뒤 만료된다.

적체가 있으면 원래 큐·실패 시각·오류 유형을 먼저 확인한다. 결제는 provider 이벤트 ID와 기존 billing 이벤트·지급 원장을 대조하고 중복 지급 방지 경로로만 복구한다. 푸시는 유효기간·기존 발송/receipt 상태를 확인한다. 원인 수정과 대상별 검토 전에 일괄 재전송·ACK·삭제하지 않는다. 이 점검은 메시지 본문을 출력하지 않는다.

## 쓰기·요청 절감

시즌 업로드의 본문 해시·revision 중복 방지는 이미 적용되어 있다. 실제 24시간 SQL 상위는 정상 커리어·시즌 저장과 과거 성장 기록 보관이었다. 이를 줄이려고 저장 기록·보관 완료 검증·복구 체크포인트를 생략하지 않는다. 다만 업로드 한도를 초과한 재요청은 기존 원자적 `tryAttempt`를 사용하여 카운터를 더 이상 갱신하지 않는다. 한도·1시간 창·429·계정별 분리는 유지한다. 정상 트래픽의 쓰기 감소율을 이 변경만으로 주장하지 않는다.

웹 `/assets/*`만 Worker 우회한다. 캐시 1년 immutable·noindex·nosniff는 빌드의 `_headers`에 둔다. HTML·공유 OG·설정/OAuth 복귀·버전 파일은 Worker를 유지한다. Worker 호출 감소는 정적 파일 요청 비중에 따라 달라지므로 전체 웹 호출을 절감량으로 계산하지 않는다.

## 저장·로그 보존

기존 백업은 일별 30일, 매월 1일은 계속 보존한다. R2 버킷에는 백업 외에 은퇴 상세·성장·시즌 기록이 함께 있다. 전체 버킷 TTL이나 Infrequent Access 전환을 적용하지 않는다. 보존 기간을 줄이려면 일별/월별 전용 prefix를 먼저 분리하고 복원 검증과 별도 데이터 보존 결정을 거친다. 현재 버킷은 비공개를 유지한다.

정상 API 요청은 코드에서 10% 표본, 경고·오류는 전부 기록한다. 플랫폼 head sampling 100%는 모든 정상 요청을 기록한다는 뜻이 아니다. 호출 자동 로그는 꺼져 있고 트레이스는 1%다. Workers Logs의 2026-12-01 새 수집·보관 과금 전 실제 GB 사용량을 다시 확인한다. Analytics Engine으로 원장 데이터를 옮기지 않는다. Argo는 별도 과금 서비스여서 효과와 청구 내역 확인 없이 해지하지 않는다.

## 보안과 롤백

- 최소 TLS: 1.0 → 1.2. 문제 시 존의 `min_tls_version`을 원래 1.0으로 복원한다. 정상 웹·API TLS 1.2 스모크를 확인한다.
- DNSSEC: Cloudflare Registrar가 DS를 자동 등록한다. 존의 `pending`은 완료가 아니다. 상위 `.com` DS와 검증 리졸버의 AD 플래그까지 확인한다. 전파에 1~2일이 걸릴 수 있다. 롤백은 등록기관 DS 제거·캐시 만료 후 존 서명 해제 순서다.
- 속도 제한: 비밀번호 유출 검사 규칙을 복구/복구 코드 경로만 IP·데이터센터별 10초 100회로 교체한다. 정상 앱·OAuth 콜백·결제 웹훅·시즌 저장은 이 규칙의 대상이 아니다. 이는 보수적인 초기 버스트 한도이며 앱의 계정별 제한을 대체하지 않는다. 이전 식은 `(cf.waf.credential_check.password_leaked)`, 한도는 10초 5회·차단 10초였다.
- 맞춤 WAF: 사용하지 않는 WordPress 및 `.git`·`.env` 경로 1개 규칙만 추가한다. 필요하면 `offside_unused_stack_scans` ref만 비활성화한다. 전체 Bot Fight Mode나 API Challenge는 켜지 않는다.
- DLQ 롤백: billing DLQ 345600초, 나머지 DLQ 86400초. 보존 기간 단축은 오래된 실패 메시지를 만료시킬 수 있으므로 먼저 적체를 확인한다.
- 코드 롤백: 이전 릴리즈 또는 `run_worker_first=true`. Worker 코드 롤백이 존 설정·큐 보존을 되돌리지는 않는다.

[DNSSEC 반영·롤백](https://developers.cloudflare.com/dns/dnssec/), [Queues 보존·과금](https://developers.cloudflare.com/queues/platform/pricing/), [관측 과금 변경](https://developers.cloudflare.com/observability/pricing/).
