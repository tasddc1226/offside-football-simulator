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
  /** T-11-406 대진표에서 고른 경기와 보던 라운드 · 세로 위치. 팀 프로필에서 돌아오면 그대로 연다. */
  bracket?: CupBracketView;
}
export interface CupBracketView {
  match: string | null;
  column: number;
  y: number;
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
    ...(folds.bracket ? { bracket: { ...folds.bracket } } : {}),
  });
}
