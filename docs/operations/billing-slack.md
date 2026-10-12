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
