export type IdPrefix = 'prf' | 'ses' | 'svc' | 'req' | 'att' | 'aud' | 'ana' | 'pst' | 'cmt';

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** 클라이언트가 만드는 `careerId`·`commandId`용. 접두사를 강제하지 않는다(설계 결정 6). */
export const CLIENT_ID_PATTERN = /^[A-Za-z0-9_:.-]{1,64}$/;
