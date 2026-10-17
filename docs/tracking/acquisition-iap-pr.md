# T-11-363: 광고 유입과 소모성 검증 거래 연결 기반

웹에서 일반 App Store URL만 열어 소재 정보가 끊기는 문제와, 검증 거래 원장에 통화·원시 가격·구매시각이 없는 문제를 보완합니다. 허용 캠페인으로 제한한 App Store 링크 함수, 기존 분석과 구분한 계정 연결 동의, 30일 first/last touch snapshot, 서버 거래 기준 중복 없는 소모성 구매·환불·미귀속 집계를 추가합니다. 기본은 off이며 운영 변수나 데이터는 변경하지 않았습니다.

**Draft 범위입니다.** Apple provider token 미검증, Safari Smart App Banner 캠페인 전달 미완료, 서버를 거치지 않는 비소모성 광고 제거 구매 미포함, 실제 GA4 app stream/StoreKit sandbox 수집 미검증입니다. 전체 IAP 연동 완료나 100% 추적을 주장하지 않습니다. 구현 세부사항·동의/계정 전환·집계 기준·승인 차단은 `acquisition-iap-integration.md`에 기록했습니다.

원격 GitHub 쓰기403은 해소되었다는 증거가 없으므로 다른 자격증명·git push·브라우저로 게시하지 않았습니다. 최신 main에서 분리했고, PR 772/774/775는 변경하지 않았습니다. Migration은 충돌 중인 0108 대신 0109로 생성했으며 최종 병합 전 최신 main 기준 재검증이 필요합니다.

운영 활성화 전 조건: 공식 pt 링크 검증, 비소모성 원장/계정 연결 구현, 실제 app-stream consent-on/off sandbox 검증, 최종 개인정보 안내·보존 처리량 검토. Meta App Events·MMP 활성화, 새 권한·ATT/스토어 신고·새 바이너리 출시, 병합·운영 배포는 별도 승인 범위입니다.

release-notes: none

기능은 기본 off이고 token 설정도 비어 있습니다. 실제 활성화 전 검토할 사용자 안내는 `release-notes-drafts/acquisition-iap.json`에 보관합니다.

## 로컬 검증

- 최신 main #774/776 반영 후 API·전체 migration·IAP·새 연결 테스트 26개 통과.
- 공용 캠페인·기존 analytics 테스트 21개, 웹 동의 전송 테스트 3개 통과.
- 설치 안내 E2E 5개, 새 320px 동의·게임 시작·App Store 새탭·철회 E2E 1개 통과(합성 pt=123456, 스텁 API, 외부 추적 요청 차단).
- API/web/contracts/app-core TypeScript 검사 통과, Svelte 오류 0개(기존 경고 5개).
- 검증용 활성화 빌드 성공, 초기 gzip 144.47KB / 145KB 예산.
- 변경 TS ESLint, lint:deps, lint:i18n, public-hygiene, git diff --check 통과. 최신 main 포함 재생성 후 drizzle generate 추가 변경 없음.
- 실기기 StoreKit Sandbox/GA4 실제 app stream, 유료 구매, 운영 데이터 변경, 운영 배포 및 원격 CI는 실행하지 않음.
