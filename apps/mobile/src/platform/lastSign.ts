// T-11-412 마지막 계약서 사인을 이 기기에 하나만 둔다(웹 ui/lastSign.ts와 같은 키 · 모양, 세이브 밖 화면 연출 값).
import { LAST_SIGN_KEY, parseLastSign, type LastSign } from '@offside/app-core/lastSign';
import { kv } from './setup';

export function saveLastSign(sign: LastSign): void {
  try {
    kv.set(LAST_SIGN_KEY, JSON.stringify(sign));
  } catch {
    /* 못 쓰면 홈 카드에 사인이 안 보일 뿐이다. */
  }
}

/** 이 커리어의 마지막 사인. 다른 커리어 것이거나 없으면 null. */
export function loadLastSign(cid: string): LastSign | null {
  try {
    const sign = parseLastSign(kv.getString(LAST_SIGN_KEY) ?? null);
    return sign?.cid === cid ? sign : null;
  } catch {
    return null;
  }
}
