# OFFSIDE Slack operations

운영 전용 작업이며 게임 릴리즈 노트에 포함하지 않는다. 기존 구매 알림(Cloudflare Queue)은 그대로 사용한다. 채널은 모두 비공개다.

| 채널              | 내용                                                            | 실행 환경                   |
| ----------------- | --------------------------------------------------------------- | --------------------------- |
| offside-purchases | 검증된 구매·갱신·환불, 전날 결제 이벤트 요약                    | 기존 Queue / GitHub Actions |
| offside-alerts    | Cloudflare 예산·Workers 문제, 시간별 웹·API·백업·D1 점검과 복구 | Cloudflare / GitHub Actions |
| offside-daily     | 오전 9시 KST 아침 리포트                                        | GitHub Actions              |
| offside-feedback  | 커뮤니티·앱 댓글 검토 후보, GitHub 처리 상태                    | GitHub Actions              |
| offside-releases  | 웹·API/OTA 배포 결과, 공식 심사·출시 메일                       | GitHub Actions / 로컬 Orca  |

## 지표와 주기

일일 요약은 한국 시간 전날 00:00–24:00이다. 결제는 Sandbox와 연결 테스트를 제외한 **서버 수신 이벤트**이며 실제 결제일 매출·스토어 정산액이 아니다. 2026-10-12 수집 시작 전의 구매는 소급 집계하지 않으므로 0건이 실제 구매 없음의 증거는 아니다. 신규 프로필에는 비회원도 포함된다. 최근 24시간 API 활동 프로필은 실행 직전 24시간의 `last_seen_at`으로, GA4 DAU가 아니다. 선수·시즌 기록은 서버 저장 기준이며 동기화 지연과 삭제의 영향을 받는다.

시간별 점검은 기존 `cron:infra-health:last`를 재사용하고 공개 웹/API를 각각 한 번 확인한다. 동일 장애는 6시간 간격으로 재안내하고 복구 시 한 번 발송한다. GitHub 예약 실행은 지연될 수 있고 실시간 가용성 SLA가 아니다. Cloudflare 기본 예산 정책의 기존 이메일과 USD 10 기준은 유지했다. Workers 실시간 문제 알림은 Cloudflare가 탐지한 이슈 범위다.

## 피드백 처리

지정 커뮤니티의 공개 목록을 시간당 최대 3페이지 읽는다. 최초 실행은 현재 글 번호만 기준으로 잡고 과거 글을 일괄 발송하지 않는다. 제목 키워드에 해당하는 신규 글만 후보로 보내므로 본문에만 있는 피드백은 놓칠 수 있다. 페이지 차단·커서 공백은 실패로 알리고 자동으로 건너뛰지 않는다.

앱·웹 댓글은 시간당 최대 100개를 커서로 읽는다. 본문은 키워드 판정에만 쓰며 닉네임·본문을 Slack에 복사하지 않는다. 후보는 확인된 버그가 아니다. 원문 링크에서 재현·기존 PR 중복·시즌 밸런스 영향을 확인하고, 링크로 GitHub 이슈를 만든다. 공개 이슈에는 개인정보를 넣지 않는다.

`feedback` 라벨을 기본으로 사용한다. `feedback:verified`는 재현 확인, `feedback:fixing`은 수정 중, `feedback:deployed`는 운영 반영 확인이다. 이슈 종료만으로 배포 완료로 간주하지 않는다. 시즌 중 밸런스 변경은 운영자에게 먼저 보고한다.

## 스토어 심사

Google Play 트랙 API의 rollout 상태는 심사 상태가 아니다. 공식 Apple/Google 심사·출시 메일만 전달하고 최종 상태는 콘솔에서 확인한다. 메일 경로는 로컬 Orca 자동화와 개인 Gmail 연결을 사용하므로 **Mac·Orca가 실행 중이고 Gmail 연결이 유효해야 한다**. 알림이 없다는 사실은 승인/진행 중/미심사를 증명하지 않는다. 실제 신규 심사 메일 수신은 별도 검증이 필요하다.

메일은 앱 식별 정보, 정확한 발신 도메인, Gmail 수신 인증 결과를 확인한다. 영수증·주문·테스트·설정 이전 메일은 제외한다. 본문·첨부파일은 Slack에 전달하거나 영구 저장하지 않는다. Gmail ID와 활성화 시각만 로컬 상태로 남긴다. 메일을 읽음 처리하거나 답장·삭제하지 않는다. 발신 인증을 확인할 수 없으면 전송하지 않는다.

## 보안과 재시도

GitHub secrets: `SLACK_PURCHASES_WEBHOOK`, `SLACK_ALERTS_WEBHOOK`, `SLACK_DAILY_WEBHOOK`, `SLACK_FEEDBACK_WEBHOOK`, `SLACK_RELEASES_WEBHOOK`, 기존 Cloudflare 계정/token. URL은 로그·문서·커밋에 넣지 않는다. 운영 스크립트는 집계 조회와 `app_meta`의 `slack:ops:` 접두사 상태만 쓴다. 게임 데이터나 권한은 변경하지 않는다.

워크플로는 `slack-operations` 동시성 그룹으로 직렬화한다. Slack 수락 후 상태를 저장하므로 실패한 전송은 재시도 가능하다. 수락 후 상태 저장 실패·네트워크 응답 유실은 중복을 만들 수 있으며 exactly-once를 보장하지 않는다. Incoming Webhook만 사용하므로 메시지 스레드 갱신은 지원하지 않고 동일 GitHub 이슈 링크로 연결한다.

수동 실행: `gh workflow run slack-operations.yml --ref main -f mode=monitor` (`daily`, `feedback`도 지원). 중지하려면 해당 GitHub workflow와 로컬 Orca 자동화를 비활성화한다. Cloudflare Notifications에서 별도 정책을 비활성화한다. 상태 키를 삭제하면 재전송/커서 재초기화될 수 있으므로 원인 확인 없이 지우지 않는다.
