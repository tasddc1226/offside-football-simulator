# apps/mobile — OFFSIDE 네이티브 앱 (Expo)

웹(`apps/web`)과 같은 게임을 iOS·Android 네이티브 앱으로 낸다. 게임 엔진은 `packages/game`을 그대로 쓰고,
화면만 React Native로 새로 만든다. 결정 배경은 [ADR-014](../../docs/adr/ADR-014-native-app.md).

## 실행

MMKV(세이브 저장소)가 네이티브 모듈이라 Expo Go로는 안 돌고 개발 빌드가 필요하다.

```bash
pnpm --filter @offside/mobile ios       # 처음 한 번: 네이티브 빌드 + 시뮬레이터 설치
pnpm --filter @offside/mobile start     # 이후엔 번들러만 띄우고 설치된 앱을 연다
```

`ios/`·`android/`는 `app.json`에서 만들어지는 산출물이다(깃에 없다). 네이티브 설정은 `app.json`·config plugin으로 한다.

워크트리마다 iOS를 처음부터 빌드하면 8분쯤 걸린다. `tooling/scripts/ios-sim.sh [시뮬레이터]`는 네이티브 지문(OTA 런타임과
같은 값)별로 빌드한 앱을 `~/Library/Caches/offside-ios`에 두고, 지문이 같으면 빌드 없이 설치만 한다(새 워크트리도 몇 초).
지문이 바뀌었을 때만 빌드하며 DerivedData를 캐시에 남기고 ccache(`brew install ccache`)가 있으면 켠다. `ios/`는 지문에
들어가지 않아 그대로 둬도 된다.

## 구조

- `src/platform/setup.ts` — 앱 시작 때 `crypto.randomUUID` 폴리필과 세이브 저장소(MMKV)를 엔진에 넣는다. 세이브 키는 웹과 같다.
- `src/theme/` — 웹 `style.css`의 색 토큰(라이트/다크).
- `metro.config.js` — 공용 패키지의 `./x.js` import를 `.ts`로 찾게 한다.
- `scripts/icons.mjs` — 웹 브랜드 원본으로 아이콘·스플래시를 만든다.
