/** Transient cup view state. Kept across screen unmounts, never written into career saves. */
export type CupScheduleTab = 'groups' | 'knockout';
export interface CupFolds {
  groups: Record<number, boolean>;
  rounds: Record<string, boolean>;
  schedule?: {
    tab: CupScheduleTab;
    group: number;
    bracketList: boolean;
  };
}
const views = new Map<string, CupFolds>();
const key = (cupId: string, accountId: string | null) => JSON.stringify([cupId, accountId]);
export function cupFolds(cupId: string, accountId: string | null): CupFolds | undefined {
  return views.get(key(cupId, accountId));
}
export function rememberCupFolds(cupId: string, accountId: string | null, folds: CupFolds) {
  views.set(key(cupId, accountId), {
    groups: { ...folds.groups },
    rounds: { ...folds.rounds },
    ...(folds.schedule ? { schedule: { ...folds.schedule } } : {}),
  });
}
