export const DYNAMIC_LEAGUES = ['k1', 'j1', 'mls', 'ere', 'l1', 'bl', 'sa', 'll', 'pl'] as const;
export const CLUB_LEAGUE_AVG: Record<string, number> = {
  hs: 46,
  uni: 52,
  k3: 51,
  k2: 57,
  k1: 63,
  csl: 62,
  j1: 65,
  mls: 66,
  spl: 67,
  bra: 67,
  ere: 68,
  por: 69,
  l1: 71,
  bl: 74,
  sa: 74,
  ll: 76,
  pl: 78,
};
export type ClubStrengthSnapshot = {
  v: number;
  asOf: string;
  source: string;
  values: Record<string, number>;
};
