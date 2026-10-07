/** tem·mat: T-10-092 구단주 팀·팀 경기. fmt: T-11-098 친선전. cpm: T-11-145 컵 경기. */
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
  | 'fmt'
  | 'blk'
  | 'lst'
  | 'ntf'
  | 'cpm';

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
