// T-11-423 홈 팝업은 한 방문(앱 실행)에 하나만 띄운다. 컵 우승 팝업과 제휴 팝업이 겹치지 않게 먼저 잡은 쪽만 뜬다
// (iOS는 Modal 두 개를 함께 띄우지 못하고, 웹도 두 장이 겹치면 닫기가 헷갈린다).
let taken = false;

/** 이번 방문의 홈 팝업 자리를 잡는다. 이미 다른 팝업이 잡았으면 false. */
export function claimHomePopup(): boolean {
  if (taken) return false;
  taken = true;
  return true;
}

/** 테스트용. */
export function resetHomePopup(): void {
  taken = false;
}
