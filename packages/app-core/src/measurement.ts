/** Optional result observer. No exception text, save contents, IDs or retries. */
export type Operation = 'progress' | 'save' | 'load';
export type Outcome = 'success' | 'empty' | 'failed';
export type Failure =
  'none' | 'progress_blocked' | 'save_risk' | 'restore_unavailable' | 'invalid_backup';
export type OperationSource = 'gameplay' | 'startup' | 'backup';
export type OperationResult = {
  operation_source: OperationSource;
  operation: Operation;
  outcome: Outcome;
  failure_class: Failure;
};
let observer: ((result: OperationResult) => void) | undefined;
export function configureMeasurement(fn: (result: OperationResult) => void) {
  observer = fn;
}
export function measureOperation(
  operation: Operation,
  outcome: Outcome,
  failure_class: Failure = 'none',
  operation_source: OperationSource = 'gameplay',
) {
  try {
    observer?.({ operation, outcome, failure_class, operation_source });
  } catch {
    /* optional */
  }
}
