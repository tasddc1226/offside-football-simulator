// Only documented codes may leave Google's error response. Messages/URLs can contain tokens.
const REASONS = new Set([
  'invalidPurchaseState',
  'invalidValue',
  'productNotOwnedByUser',
  'purchaseTokenMismatch',
  'required',
  'unsupportedIabType',
  'userInsufficientPermission',
  'notFound',
  'concurrentUpdate',
  'purchaseTokenNoLongerValid',
  'rateLimitExceeded',
  'userRateLimitExceeded',
]);
const STATUSES = new Set([
  'INVALID_ARGUMENT',
  'FAILED_PRECONDITION',
  'NOT_FOUND',
  'PERMISSION_DENIED',
  'UNAUTHENTICATED',
  'RESOURCE_EXHAUSTED',
  'ABORTED',
  'INTERNAL',
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED',
]);
const MAX_ERROR_BYTES = 8192;

export class GoogleAcknowledgementError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly reason: string,
    readonly googleStatus?: string,
  ) {
    super(`Google acknowledge ${httpStatus} (${reason})`);
    this.name = 'GoogleAcknowledgementError';
  }
}

/** Bound memory even if an upstream proxy returns HTML or an unexpectedly large body. */
export async function googleAcknowledgementError(
  res: Response,
): Promise<GoogleAcknowledgementError> {
  let reason = 'unknown';
  let googleStatus: string | undefined;
  const reader = res.body?.getReader();
  if (reader) {
    try {
      const decoder = new TextDecoder();
      let bytes = 0;
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_ERROR_BYTES) throw new Error('Google error body exceeds diagnostic limit');
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      const body = JSON.parse(text) as {
        error?: { errors?: { reason?: unknown }[]; status?: unknown };
      } | null;
      const errors = body?.error?.errors;
      if (Array.isArray(errors)) {
        const known = errors.find((e) => typeof e?.reason === 'string' && REASONS.has(e.reason));
        if (typeof known?.reason === 'string') reason = known.reason;
      }
      const status = body?.error?.status;
      if (typeof status === 'string' && STATUSES.has(status)) googleStatus = status;
    } catch {
      // Diagnostics must never replace the HTTP failure with a body/parser exception.
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  return new GoogleAcknowledgementError(res.status, reason, googleStatus);
}
