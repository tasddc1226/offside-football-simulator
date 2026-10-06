import { WALL_OF_HONOR_TITLE_ID } from '@offside/contracts/hof-rules';

/** undefined id is a public server view; local awards require this session's verified selection. */
export function retiredTitleOf(
  careerId: string | undefined,
  saved: string | null | undefined,
  selected: Readonly<Record<string, string | null | undefined>>,
): string | null | undefined {
  if (careerId !== undefined && careerId in selected) return selected[careerId];
  return careerId !== undefined && saved === WALL_OF_HONOR_TITLE_ID ? null : saved;
}
