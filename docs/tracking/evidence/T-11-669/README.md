# T-11-669 은퇴 화면 실험 화면 확인

`apps/web/e2e/retire-experiment.spec.ts`의 실험군 테스트가 찍은 로컬 화면이다(Playwright, 개발 서버).
API는 스텁이고, 선수 · 시즌 기록은 테스트용 합성 데이터다(서울 FC · K리그1 3시즌). 실제 이용자 데이터는 없다.

| 파일 | 폭 | 상태 |
| --- | --- | --- |
| `retire-exp-320.png` | 320px | 실험군 · 로그인 전 · 업로드 완료, 최고 평점 시즌을 펼침. 가로 넘침 없음 |
| `retire-exp-390.png` | 390px | 같은 상태 |

앱 화면(`apps/mobile/src/screens/retired/RetireExp.tsx`)은 실제 기기 · 시뮬레이터에서 찍지 않았다.
