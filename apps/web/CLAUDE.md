# 이 폴더 작업 규칙

루트 `CLAUDE.md`에서 옮겨 온 화면 규칙이다. 웹(`apps/web`)과 앱(`apps/mobile`)에 같은 내용이 있으니 고치면 둘 다 고친다.

## 로딩 표시 규칙 (2026-10-18, T-11-389)

- 서버 데이터를 기다리는 자리는 글자("불러오는 중…") 대신 뼈대를 그린다. 웹은 `LoadState`(`rows`로 줄 수)나 `Skeleton.svelte`, 앱은
  `components/LoadState`나 `ui/Skeleton`(`height`를 주면 카드 한 장, T-11-391). 줄 · 카드가 맞지 않는 화면은 `LoadState`의
  `skeleton`에 화면 모양 뼈대를 넘긴다(웹 snippet, 앱 `SkeletonFrame` + `useSkeletonBlock`, 예: 팀 그라운드 T-11-392). 뼈대는 0.2초 뒤에 나타나고(메모에서 바로 오는 재방문이 번쩍이지 않게) 움직임 줄이기를 따른다.
- 기기 안 데이터로 바로 그리는 화면(커리어 진행 · 만들기 · 세이브 · 설정)에는 넣지 않는다.
- 웹 뼈대는 첫 화면 번들에 실리므로 요소 하나의 CSS 배경으로 그린다(`style.css` `.sk-list` · `.sk-wait`). 화면 모양 뼈대를 새로 만들면 그 화면 청크 안에 둔다.
