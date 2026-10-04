# T-11-066 로컬 화면 확인

팀 로고 표시 확대와 선수 카드 국기를 웹·앱에 적용한 로컬 캡처다.
2026-10-04에 확인했으며 운영 배포나 스토어 출시의 증거는 아니다.
로고 확인에는 격리된 로컬 DB의 예시 로고를 사용했다. 국적은 기존 선수 기록을 읽었다.

| 화면 | 환경 | 캡처 |
| --- | --- | --- |
| 구단주 내 팀 카드의 로고 | 모바일 웹 375 × 667 | [이미지](web-owner-logo.png) |
| 라커룸 카드의 국기·이름·능력치 | 모바일 웹 425 × 812 | [이미지](web-locker-nationality.png) |
| 공개 팀 그라운드의 국기·OVR | iPhone 16, iOS 18.1 | [이미지](ios-team-nationality.png) |
| 로그인된 내 팀 라커룸의 국기·능력치 | Pixel 8 AVD, Android 16 (API 36) | [이미지](android-locker-nationality.png) |

웹 캡처는 실제 브라우저 화면에서 페이지 영역만 잘랐다. iOS 캡처는 시뮬레이터의 실제 앱 화면이다.
웹의 내 팀, 두 랭킹, 상대 목록, 경기 기록·결과를 확인했다. 모바일 웹에서 가로 넘침이 없었고,
라커룸의 국기가 선수 이름과 능력치를 가리지 않았다. iOS에서는 팀 랭킹과 공개 팀 상세의 국기를 확인했고,
작은 카드의 OVR이 과도하게 축소되지 않도록 숫자 영역을 조정했다.

기존 대한민국 선수와 국적 기능 이전 기록의 `NULL`은 기존 명예의 전당과 같은 기준으로 대한민국으로 읽는다.
유스 선수에는 국기를 표시하지 않는다. 구형 응답의 필드 누락은 허용하고 경기 원본 JSON·게임 세이브는 바꾸지 않는다.

## 확인 결과

- 관련 API 통합 테스트 2건 통과. 저장·내 팀 조회·공개 팀 상세의 국적, 랭킹·상대·경기의 로고,
  옛 경기 JSON 보존과 구형 클라이언트의 로고 보존을 확인했다.
- API·웹·앱 타입 검사 및 변경한 TS/TSX 파일의 린트 통과. Svelte 검사 0 errors / 1 warning.
- 변경 파일 공백 검사와 릴리즈 노트 형식 검사 통과.
- Android에서 기존 로그인과 진행 중 커리어를 유지한 채 내 팀·편성·라커룸·최근 경기의 로고와 국기를 확인했다.
  선발 선수 보기 필터를 바꿔 라커룸의 이름·국기·능력치 배치를 확인했고, 확인 후 테스트용 AVD를 종료했다.
- iOS 로그인 후 라커룸·경기 화면의 직접 실행은 미확인이다. iOS 랭킹·공개 팀 카드,
  Android 로그인 화면과 API 저장·조회 회귀 테스트로 해당 변경을 확인했다.

## 운영 반영 확인 (2026-10-04)

- [팀 UI PR #449](https://github.com/tasddc1226/offside-football-simulator/pull/449) 머지.
  [전체 CI](https://github.com/tasddc1226/offside-football-simulator/actions/runs/37170541009) 통과.
- [OTA 실패 감지 보완 PR #451](https://github.com/tasddc1226/offside-football-simulator/pull/451) 머지.
  [최신 main 통합 후 전체 CI](https://github.com/tasddc1226/offside-football-simulator/actions/runs/37171635740) 통과:
  API 441건, 웹 e2e 163건, 분석 동의 e2e 10건, 2,000개 커리어 시뮬레이션 오류 0.
  OTA 게시 스크립트의 양 플랫폼 성공·iOS 실패 중단·Android 실패 전달 회귀 테스트 3건도 통과했다.
- 웹·API 배포 코드: `11413d1fb62e1fcb10e26e5d8d446564c4c7c4b1`.
  [운영 실행](https://github.com/tasddc1226/offside-football-simulator/actions/runs/37172020359)의 배포 작업에서
  웹 자산 해시 일치, API health·profile 및 웹 응답 확인을 통과했다.
- 운영의 로그인된 내 팀: 저장된 로고 있음, 라커룸 선수 13명과 선발 11명의 국적 필드 확인.
  425px 화면에서 국기 24개가 렌더링됐고 가로 넘침이 없었다.
  공개 팀 상세의 저장된 로고도 팀 랭킹 응답과 일치했다.

main에 함께 반영된 푸시·리뷰 작업 #450은 새 네이티브 모듈과 앱 1.0.3을 추가했다.
기존 1.0.2 사용자도 팀 UI를 받을 수 있도록, 해당 네이티브 변경을 포함하지 않는
CI 통과 커밋 `c5d52743a1d96a14faa27f9189dac7ca863e5905`의 팀 UI를 production 채널에 별도로 게시했다.
팀 UI 기능은 #449와 같으며 API·게임 세이브의 하위 호환을 유지한다.

| 기존 앱 | 완료된 production 빌드 | 런타임 앞 8자리 | 게시된 OTA 그룹 |
| --- | --- | --- | --- |
| iOS 1.0.2 | 7 | `947b7910` | [6e4cdf5b](https://expo.dev/accounts/tasddc1569/projects/offside/updates/6e4cdf5b-6d33-4e37-940d-7dd16a605824) |
| Android 1.0.2 | 4 | `d70acd1a` | [b8e0ecbc](https://expo.dev/accounts/tasddc1569/projects/offside/updates/b8e0ecbc-ec16-4f22-a459-22f3073940ed) |

양 플랫폼에서 완료된 production 빌드의 전체 런타임 해시와 게시된 OTA 해시가 일치했다.
production 채널과 각 1.0.2 런타임으로 업데이트 서버에 요청했을 때 새 업데이트 ID가 실제 응답에 포함됐다.
이 확인은 OTA 게시와 다운로드 응답의 증거이며, 모든 사용자 기기의 설치·재시작 완료를 뜻하지는 않는다.
