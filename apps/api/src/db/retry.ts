/** Callers explicitly identify replay-safe work; never wrap a whole HTTP handler. */
async function retryTransient<T>(write: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await write();
    } catch (error) {
      let cause: unknown = error;
      let transient = false;
      for (let depth = 0; cause && depth < 6; depth++) {
        const message = cause instanceof Error ? cause.message : String(cause);
        transient ||=
          /Network connection lost|storage caused object to be reset|reset because its code was updated/.test(
            message,
          );
        cause = cause instanceof Error ? cause.cause : undefined;
      }
      // Overload and SQL/schema/validation errors must not be multiplied by retries.
      if (!transient || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt * (1 + Math.random())));
    }
  }
}

/** Only for transactions safe to replay after an uncertain commit. */
export const retryTransientWrite = retryTransient;
/** Only for side-effect-free SELECTs, not arbitrary .first()/.all() statements. */
export const retryTransientRead = retryTransient;
