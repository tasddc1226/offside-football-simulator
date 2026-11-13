import { billingAlertId, type BillingAlert } from './alerts.js';
import { GoogleAcknowledgementError } from './google-error.js';

/** Run only after the grant commits, attached to the route's existing waitUntil. No retries. */
export async function acknowledgeAfterGrant(
  after: () => Promise<void>,
  event: BillingAlert & { job: 'iap-ack' | 'pass-ack' },
): Promise<void> {
  try {
    await after();
  } catch (error) {
    // Same one-way ID as billing_alerts, including when billing notifications are disabled.
    const id = await billingAlertId(event).catch(() => undefined);
    console.error(
      JSON.stringify({
        job: event.job,
        store: event.store,
        productId: event.productId,
        test: event.test,
        grantCompleted: true,
        id,
        error: 'Google acknowledgement failed',
        failure: error instanceof GoogleAcknowledgementError ? 'http' : 'request',
        ...(error instanceof GoogleAcknowledgementError
          ? {
              httpStatus: error.httpStatus,
              reason: error.reason,
              googleStatus: error.googleStatus,
            }
          : {}),
      }),
    );
  }
}
