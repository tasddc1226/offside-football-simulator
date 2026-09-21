// T-7-039: 일부러 라우터 Link가 아니라 순수 앵커를 쓴다. 라우터 Link(hash)는 클릭 시
// preventDefault를 걸어 버려 (a) 네이티브 "해시로 스크롤+포커스" 동작 자체가 사라지고(키보드
// 사용자가 스킵 링크를 눌러도 포커스가 #game-content로 옮겨가지 않는 접근성 회귀), (b) 되돌아갈
// 곳 없는 메모리 히스토리 엔트리를 하나 더 쌓아 그다음 "뒤로 가기" 한 번이 아무 효과 없이
// 소모된다. 그래서 진짜 `<a href="#game-content">`를 쓰되, onClick에서 preventDefault로 실제
// 주소창 hash가 바뀌는 것(주소 고정 규칙 위반)만 막고, 포커스는 target에 직접 옮긴다 — 라우터
// 이동도, history 엔트리도 남기지 않는다.
export function SkipLink() {
  return (
    <a
      href="#game-content"
      className="os-skip-link"
      onClick={(event) => {
        event.preventDefault();
        document.getElementById('game-content')?.focus();
      }}
    >
      본문으로 건너뛰기
    </a>
  );
}
