# 인프라 검사 실패 경로 복구

## 예약 자원 검사 기록

`infra-health.yml`은 기존 D1/백업 검사와 DLQ/R2/DNSSEC 검사를 모두 유지한다.
예약 실행의 자원 검사 결과만 `offside-d1-backup`의
`operations/production/infra-resource-workflow.json`에 기록한다.
Worker는 매시간 기존 BACKUP 바인딩으로 이 작은 객체 하나를 읽는다.
GitHub 공개 API 조회나 GitHub 장기 토큰을 Worker에 추가하지 않는다.
Actions의 일회용 `github.token`은 현재 실행의 저장소, main, schedule, workflow 경로와
생성 시각을 확인하는 데만 사용한다. 업로드는 기존 Cloudflare 토큰의 해당 버킷
객체 쓰기 권한이 필요하다. 권한 부족은 게시 단계 실패로 드러나며 정상으로 간주하지 않는다.
수동 실행은 임시 R2 probe 객체의 쓰기/읽기/삭제를 검사하고 자기 객체만 지운다.
운영 스냅샷 추출이나 예약 heartbeat 갱신은 수행하지 않는다.

전체 health job 결과를 기록하면 백업 검사가 읽은 이전 job 실패를 다시 기록하는
순환 경보가 생긴다. 따라서 `steps.resources.outcome`을 기록한다. D1/백업 검사 실패는
여전히 해당 단계와 job을 실패시키며, R2의 자원 검사 성공으로 덮어쓰지 않는다.
예약이 끊기면 12시간 기준으로 stale 경보가 난다(T-11-677: GitHub 예약 실행은 매시간 cron이어도 실제로 4~8시간 간격이라 3시간 기준은 정상 운영에서도 경보를 냈다). 수동 실행은 예약 기록을 갱신하지 않는다.
누락, 잘못된 출처/형식, 미래 시각, 읽기 실패도 정상으로 처리하지 않는다.

적용 순서: workflow 변경을 main에 반영 → 예약 실행의 게시 단계 성공 확인 → R2 기록의
시각/결과 확인 → Worker 변경 배포 → 다음 시간별 점검의 `resourceWorkflow.source`가
`r2-resource-step`인지 확인. 실제 게시/Worker 읽기를 확인하기 전에는 해결 완료로 보고하지 않는다.

## 발송 완료 결제 알림의 DLQ 정리

DLQ는 결제 알림 전달용이며 구매 지급 상태가 아니다. 기본 명령은 읽기 전용이다.

T-11-677부터 소비자는 마지막 시도(`attempts > BILLING_MAX_RETRIES`)에서도 실패하면 DLQ로 보내지 않고 놓는다.
영구 기록은 D1 `billing_alerts` 아웃박스이고 5분마다 미발송 행을 다시 넣으므로 알림은 사라지지 않는다.
1시간 넘은 미발송 행은 `infra-health.mjs`가 원장으로 따로 실패 처리한다. 이후 DLQ에 쌓이는 건 소비자 예외처럼
코드가 놓지 못한 경우뿐이라 아래 절차로 대조한다. `BILLING_MAX_RETRIES`는 `wrangler.jsonc`의 `max_retries`와 같아야 한다(테스트가 본다).
Cloudflare 자격 증명은 보호된 환경 변수로 전달하며 로그나 명령 인자에 넣지 않는다.

```sh
node tooling/scripts/reconcile-billing-dlq.mjs
```

별도로 운영 처리가 승인된 경우에만 다음 명령을 실행한다.

```sh
node tooling/scripts/reconcile-billing-dlq.mjs --ack-sent --confirm=ACK_SENT_BILLING_NOTIFICATIONS
```

최대 10건을 미리 대조하고 모두 발송 완료인 경우에만 한 번 pull한다.
가져온 메시지별로 `billing_alerts.sent_at`을 다시 읽어 발송 완료인 것만 ACK한다.
새로 들어온 미확인/미발송/잘못된 메시지는 ACK하지 않고 원래 DLQ에 반환한다.
원장 조회 실패 시에도 ACK하지 않는다. 알림 재발송, 구매 지급/회수, 원장 수정,
큐 전체 purge는 수행하지 않는다. pull이 지원되지 않는 경우 소비자 설정을 자동 변경하지 않는다.
ACK 응답이 불확실하면 무작정 재실행하지 말고 큐 지표와 원장을 다시 대조한다.
이후 큐 backlog=0과 알림 미발송 원장을 별도로 확인한다. 잔여 backlog는 계속 검사 실패다.

## 백업 복구 미검증

`backup-recovery-unverified`는 백업 복구 증명이 없다는 경보다. 완료된 live-copy나
고립 DB의 작은 fixture 성공으로 운영 스냅샷을 verified로 바꾸지 않는다.
`docs/operations/d1-consistent-recovery.md`의 점검 시간 확보와 명시적 확인 절차를 따른다.
D1 native export는 운영 요청을 차단할 수 있으므로 코드 검증 중에는 실행하지 않는다.
이번 수정은 운영 스냅샷 추출·복원·verified 마커 생성을 실행하지 않는다.
