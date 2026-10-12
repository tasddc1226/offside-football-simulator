# Store purchase alerts

Verified billing events are delivered to a private Slack channel through a dedicated Cloudflare Queue.
This is operational telemetry only: it does not grant or revoke subscription benefits.

## Sources

- Consumable claims: the existing Apple/Google verifier grants items and commits the alert in one D1 batch.
- Apple Server Notifications V2: the existing endpoint verifies both Apple-signed payload and transaction, bundle and environment. ONE_TIME_CHARGE / SUBSCRIBED / DID_RENEW / REFUND create alerts. TEST is visibly marked.
- Google RTDN: authenticated Pub/Sub push to `/v1/iap/google/notifications`. Verify the Google JWT signature, issuer, expiration, audience and exact service-account email before processing. Verify one-time purchases with products.get and subscription purchases/renewals with subscriptionsv2.get. RTDN is never proof of payment by itself.
- Existing daily Google voided-purchase reconciliation also creates refund alerts for known consumables. Unknown voided transactions are not attributed to game accounts.

The current ad-removal client does not post claims to the server. Store notifications therefore provide its purchase alerts; earlier purchases are not backfilled. Membership benefit fulfillment remains a separate feature.

## Delivery

`billing_alerts` is a durable outbox. Store + environment + transaction + event kind determine its SHA-256 key. Claim and server notification converge on the same purchase key. Queue payloads contain only that key. A lease prevents concurrent delivery; pending records are requeued every five minutes. Slack HTTP errors/timeouts retry, with a dead-letter queue after five attempts; cron can recover pending rows afterward.

Delivery is at least once: a crash after Slack accepts a message but before D1 records sent_at can cause a duplicate. Incoming webhooks do not provide transactional exactly-once delivery. The short event fingerprint makes such duplicates recognizable.

Alerts contain store, product ID, event kind, LIVE/TEST label, receipt time and short fingerprint. They contain no email, display name, receipt, raw purchase token, or inferred payment amount. TEST/Sandbox events must not be counted as revenue. The timestamp is server receipt time, not store purchase time.

## Configuration

- Secret `BILLING_SLACK_WEBHOOK`: channel-bound incoming webhook. Never commit or log it.
- `BILLING_ALERTS_ENABLED=1`: explicit production opt-in. Set to 0 to stop collecting and delivering.
- `BILLING_QUEUE`: dedicated `offside-billing-production`, DLQ `offside-billing-production-dlq`.
- `GOOGLE_RTDN_AUDIENCE`: exact public HTTPS endpoint.
- `GOOGLE_RTDN_SERVICE_ACCOUNT`: exact authenticated push service account. No service-account key is needed for push authentication.
- Existing `GOOGLE_PLAY_SA_JSON`: Play Developer API verification.

Google setup: create Pub/Sub topic; give the Google Play notification service account documented in the RTDN setup guide only Pub/Sub Publisher on that topic; create authenticated push subscription. Ensure Pub/Sub service agent can mint the selected service account's OIDC token. Enable RTDN in Play Console using the topic's full resource name and include all one-time products. Send a Play Console test notification and verify the full path to Slack.

Apple setup: retain the existing V2 endpoint for production and Sandbox. Verify the endpoint is configured in App Store Connect and use Apple's server test facility where credentials are available. A direct Slack test proves only Slack delivery; a store test proves store-to-Queue delivery, not a real paid purchase.

## Operations

Read pending/sent records using the normal read-only D1 operations workflow. No user identity is retained in this table. Rotate/revoke the webhook in Slack if exposed, replace the Worker secret, and test again. Watch pending age and DLQ growth.

Sources: [Slack incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/), [authenticated Pub/Sub push](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions), [Play RTDN](https://developer.android.com/google/play/billing/getting-ready#configure-rtdn).

## 알림 표시 양식

제목에서 새 구매·구독 갱신·환불·연결 테스트와 실결제·Sandbox를 구분한다. 상품은 공용 `IAP_PRODUCTS`의 종류와 수량으로 읽기 쉬운 이름을 표시하고 광고 제거는 별도 이름을 쓴다. 미등록 상품은 ID를 그대로 표시한다. 수신 시간은 한국 시간(KST)이며 스토어 결제 시각이나 금액으로 해석하지 않는다. 상품 ID와 알림 참조는 작은 하단 문구로 둔다.

```text
OFFSIDE · 💳 새 구매 · 실결제
상품: 리롤권 5장
스토어: Google Play
알림 수신: 2026-10-12 17:06:41 (한국 시간)
상품 ID: com.offsidelab.app.reroll_5 · 알림 참조: abcdef123456
```

Sandbox에는 “테스트 알림입니다. 실제 매출에 포함하지 마세요.”를 추가한다. 휴대폰 알림·스크린리더용 `text`에도 동일 정보를 포함한다. 운영 채널 기본 언어는 한국어이며 영어 사전도 함께 유지한다. 이미 보낸 메시지는 수정하지 않고 이후 발송부터 새 양식을 쓴다.
