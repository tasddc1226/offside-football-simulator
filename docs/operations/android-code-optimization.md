# Android DEX 최적화

## 원인과 적용 범위

2026-10-12 Play Console에서 활성 비공개 테스트 `1.1.2 (18)`의 DEX 최적화 경고를 확인했다. 난독화 비율은 1%, 최적화/축소 비율과 R8 구성은 `-`, 압축 전 DEX 합계는 63.8MB였다. 콘솔에 표시된 난독화 기준은 25%, 해결 기한은 2027년 2월이다.

기존 `expo-build-properties` 설정에는 Android 릴리즈 minify/shrink 활성화가 없었다. Expo SDK 57의 prebuild 템플릿도 코드 최적화를 막는 `proguard-android.txt`를 사용했다. JavaScript 번들 압축은 Java/Kotlin DEX 최적화를 대신하지 않는다.

- `app.config.js`: `enableMinifyInReleaseBuilds`와 `enableShrinkResourcesInReleaseBuilds` 활성화.
- `plugins/withAndroidOptimization.js`: prebuild 때 기본 규칙을 `proguard-android-optimize.txt`로 교체한다. 재실행해도 동일하며 템플릿이 바뀌면 명시적으로 실패한다.
- 기존 React Native/Reanimated 및 라이브러리 consumer keep 규칙은 보존한다. 전역 `-dontwarn`, `-dontobfuscate`, `-dontoptimize`나 패키지 전체 keep 규칙을 새로 추가하지 않는다.
- SDK/AGP, 앱 버전, EAS 설정, 게임 저장 형식은 변경하지 않는다. 네이티브 빌드 설정 변화로 runtime fingerprint는 달라질 수 있다. 기존 앱용 OTA 배포와 새 바이너리 출시는 별개다.

## 검증 절차

```sh
pnpm --filter @offside/mobile test
pnpm --filter @offside/mobile lint
pnpm --filter @offside/mobile typecheck
cd apps/mobile
pnpm exec expo prebuild --platform android --no-install
```

생성된 `android/gradle.properties`의 두 속성이 모두 `true`이며 `android/app/build.gradle`에 `proguard-android-optimize.txt`가 연결되는지 확인한다. 생성된 네이티브 폴더는 커밋하지 않는다.

실제 릴리즈 AAB에서는 다음 메타데이터를 확인한다. AGP/R8 업그레이드 시 메타데이터 형식도 다시 확인한다.

```sh
unzip -p app-release.aab BUNDLE-METADATA/com.android.tools/r8.json
unzip -l app-release.aab 'BUNDLE-METADATA/com.android.tools.build.obfuscation/*'
```

R8 실행 성공, 최적화/난독화/축소 활성화, 매핑 파일 포함, DEX 크기를 확인한다. 디버그 빌드 성공만으로 릴리즈 동작을 확인했다고 판단하지 않는다. 최적화된 APK의 시작·저장 복구·이미지·알림·결제·광고 등 네이티브 경로를 확인하고, 실제 결제나 광고 수신을 확인하지 못한 경우 따로 명시한다.

새 AAB를 Play Console에 올린 뒤 해당 **새 versionCode**의 최적화 지표를 확인해야 콘솔 경고 해소를 확정할 수 있다. 기존 18번 번들의 점수는 코드 변경이나 매핑 업로드만으로 다시 최적화되지 않는다. 검증용 EAS Build는 스토어 제출을 실행하지 않는다.

## 공식 문서

- [Android DEX code optimization](https://developer.android.com/google/play/vitals/code-optimization)
- [Expo SDK 57 build properties](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/)
- [Expo config plugin mods](https://docs.expo.dev/config-plugins/mods/)
