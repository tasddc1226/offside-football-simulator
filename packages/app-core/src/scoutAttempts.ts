export type ScoutPlan = { seed: number; hit: boolean };
type Outcome = { ok: true } | { ok: false; error: { retryable?: boolean } };

/** Keep the key and scout plan together until success or a terminal response. No RNG is used on creation. */
export function createScoutAttempts(
  planScout: () => ScoutPlan,
  newKey: () => string = () => crypto.randomUUID(),
) {
  let rerollKey: string | null = null;
  let scoutKey: string | null = null;
  let scoutPlan: ScoutPlan | null = null;
  return {
    forReroll() {
      return (rerollKey ??= newKey());
    },
    settleReroll(result: Outcome) {
      if (result.ok || !result.error.retryable) rerollKey = null;
    },
    forScout() {
      scoutKey ??= newKey();
      scoutPlan ??= planScout();
      return { key: scoutKey, plan: scoutPlan };
    },
    settleScout(result: Outcome) {
      if (result.ok || !result.error.retryable) {
        scoutKey = null;
        scoutPlan = null;
      }
    },
  };
}
