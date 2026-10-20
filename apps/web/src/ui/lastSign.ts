// T-11-412 마지막 계약서 사인을 이 브라우저에 하나만 둔다(세이브 밖 화면 연출 값). 못 읽거나 못 쓰면 조용히 넘어간다.
import { LAST_SIGN_KEY, parseLastSign, type LastSign } from '@offside/app-core/lastSign';

export function saveLastSign(sign: LastSign): void {
  try {
    localStorage.setItem(LAST_SIGN_KEY, JSON.stringify(sign));
  } catch {
    /* 저장 공간이 없으면 홈 카드에 사인이 안 보일 뿐이다. */
  }
}

/** 이 커리어의 마지막 사인. 다른 커리어 것이거나 없으면 null. */
export function loadLastSign(cid: string): LastSign | null {
  try {
    const sign = parseLastSign(localStorage.getItem(LAST_SIGN_KEY));
    return sign?.cid === cid ? sign : null;
  } catch {
    return null;
  }
}
