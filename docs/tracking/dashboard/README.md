# 개발 현황판 생성기

`board.md`·`decision-log.md`·git 로그에서 HTML 현황판을 만든다. 오케스트레이터가 머지·투입 때마다 실행해 Claude 아티팩트(https://claude.ai/code/artifact/aaef7e81-f9f3-4588-9e4e-5e2ec916570b)로 다시 게시한다.

```bash
DASHBOARD_OUT=/path/to/dashboard.html python3 docs/tracking/dashboard/build-dashboard.py
```

화면 목록(SCREENS)·계층 요약(LAYERS)·예상 일정(ETA)·주요 결정(DECISIONS)은 스크립트 상단에서 손으로 유지한다. 나머지는 `board.md` 표를 파싱한다.
