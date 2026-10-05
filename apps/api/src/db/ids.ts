/** tem·mat: T-10-092 구단주 팀·팀 경기. */
export type IdPrefix =
  | 'prf'
  | 'ses'
  | 'svc'
  | 'req'
  | 'att'
  | 'aud'
  | 'ana'
  | 'pst'
  | 'cmt'
  | 'tem'
  | 'mat'
  | 'blk'
  | 'lst'
  | 'ntf';

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
