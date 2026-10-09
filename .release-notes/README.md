# 게임 내 릴리즈 노트

사용자에게 알릴 변경은 PR에 이 폴더의 JSON을 함께 추가한다. 공지는 운영 API·웹,
OTA 잡과 릴리즈 태그 잡이 성공한 뒤 게시한다. 커밋 제목이나 내부 작업 문서는 게시하지 않는다.

```json
{
  "id": "t-11-058-example",
  "title": "채팅 입력 개선",
  "items": ["키보드가 올라와도 입력창을 볼 수 있어요"],
  "en": { "title": "Better chat input", "items": ["The input box stays visible above the keyboard."] },
  "ja": { "title": "チャット入力の改善", "items": ["キーボードが出ても入力欄が見えます。"] },
  "availability": "web-app"
}
```

- `en`·`ja`는 영어·일본어 화면에 보이는 같은 항목이다. 2026-10-08 이후 파일은 둘 다 필수다(`TRANSLATED_SINCE`).
  게시 이력 해시는 한국어 원문만 쓰므로 번역을 나중에 고쳐도 정정 오류가 나지 않는다(이미 게시된 글엔 반영되지 않는다).

- 파일명은 날짜와 순서를 앞에 붙인다. 게시 순서는 파일명 순서다.
- `id`는 전역 고유 값이다. 한번 게시한 ID와 문구는 수정하지 않는다. 정정은 새 ID로 추가한다.
- 문구는 `docs/tracking/copy-style.md`의 해요체를 따른다. 내부 구현·검증 내용은 넣지 않는다.
- `availability`: `web`은 웹 전용, `app`은 앱 전용, `web-app`은 웹·앱 적용, `web-app-pending`은 웹 적용·앱 업데이트 예정이다.
  예정 항목은 `appVersion`도 쓴다. OTA 게시 성공만으로 스토어 출시를 주장하지 않는다.
- 앱 스토어 출시 후 안내하려면 실제 출시를 확인하고 별도 항목을 추가한다.
- 최대 100개/64KiB다. 운영 게시 이력을 확인한 과거 파일은 하위 `archive/`로 옮길 수 있다.
  서버 이력이 남으므로 파일을 옮겨도 재게시되지 않는다. 미게시 파일은 보관 폴더로 옮기지 않는다.

PR에서 사용자에게 보이는 소스(`apps/web/src`·`apps/mobile/src`·`apps/api/src`·`packages/*/src`, 테스트 제외)가 바뀌었는데
새 항목이 없으면 `Release notes guard` 검사가 실패한다. 공지할 게 없는 변경(리팩터링·운영 도구 등)은 PR 본문에
`release-notes: none` 한 줄을 쓰거나 `no-release-note` 라벨을 붙인다.

`node .github/scripts/publish-release-notes.mjs validate .release-notes`로 형식과 크기를 확인한다.
초안의 사용자 게시판 미리보기는 인증된 게시 API의 `dryRun: true`를 사용한다. 일반 관리자 세션으로
이 배포 전용 API를 호출할 수는 없다.
