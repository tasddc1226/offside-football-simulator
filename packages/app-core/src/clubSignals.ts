// T-11-669 서버가 팀 저장 · 구단 경기 결과를 돌려준 순간을 알린다(api/team이 응답을 받은 뒤 부른다).
// 화면 진입 · 버튼 클릭이 아니라 서버 성공 경계다. 듣는 쪽(은퇴 화면 실험 계측)이 없으면 아무 일도 없다.
// 요청을 보낼 때의 계정 키를 함께 넘겨, 요청 뒤 계정이 바뀐 응답을 새 계정 결과로 묶지 않게 한다.
export type ClubSignal = 'team_save' | 'club_match';
/** 계정 키(문자열 = 그 계정, null = 계정 없음, undefined = 모름). 원래 프로필 ID가 아니다. */
export type ClubAccountKey = string | null | undefined;
const listeners = new Set<(s: ClubSignal, requestKey: ClubAccountKey) => void>();
let keyOf: () => ClubAccountKey = () => undefined;

/** 앱(웹 · 모바일)이 지금 계정 키를 읽는 함수를 건다. */
export function setClubAccountKey(fn: () => ClubAccountKey): void {
  keyOf = fn;
}

export function onClubSignal(fn: (s: ClubSignal, requestKey: ClubAccountKey) => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function emitClubSignal(s: ClubSignal, requestKey: ClubAccountKey): void {
  for (const fn of listeners) {
    try {
      fn(s, requestKey);
    } catch {
      /* optional */
    }
  }
}

/** 요청을 보낼 때(이 함수를 부를 때) 계정 키를 잡아 두고, 응답이 성공이고 cond를 만족하면 그 키와 함께 알린다. */
export function signalOn<R extends { ok: boolean }>(
  p: Promise<R>,
  s: ClubSignal,
  cond: (r: R) => boolean = () => true,
): Promise<R> {
  let requestKey: ClubAccountKey;
  try {
    requestKey = keyOf();
  } catch {
    requestKey = undefined;
  }
  return p.then((r) => {
    try {
      if (r.ok && cond(r)) emitClubSignal(s, requestKey);
    } catch {
      /* optional */
    }
    return r;
  });
}
