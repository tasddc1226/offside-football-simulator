/** tem·mat: T-10-092 구단주 팀·팀 경기. fmt: T-11-098 친선전. cpm: T-11-145 컵 경기. lgm: T-11-418b 리그 경기. ipc: T-11-152 아이템 구매. tcm: T-11-290 팀 프로필 댓글. xch: T-11-374 카드 과제 낸 기록. */
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
  | 'cpm'
  | 'lgm'
  | 'ipc'
  | 'tcm'
  | 'mgr'
  | 'xch';

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
