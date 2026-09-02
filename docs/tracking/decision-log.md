# 결정 로그

날짜 역순. ADR로 승격된 결정은 링크만 남긴다.

## 2026-09-02

- **역할 분리 확정.** 사용자 = 프로덕트 오너. Claude = 기술 책임자·오케스트레이터, 앱 코드 직접 수정 금지. 구현 = Claude Code Sonnet 5 워커, Orca 워크트리로 위임. 근거: 사용자 지시.
- **로컬 우선 아키텍처로 전환.** 서버 권위 시뮬레이션 권장을 폐기하고 클라이언트 실행 + 서버 동기화·리플레이 검증으로 확정. [ADR-002](../adr/ADR-002-persistence-and-identity.md), [ADR-003](../adr/ADR-003-simulation-location.md). 근거: 사용자의 "서버는 최종 결과 정도만" 의도와 원작 구조. 단, 최종 결과만이 아니라 checkpoint Snapshot을 동기화한다. 이유는 진행 중 커리어 복구.
- **Cloudflare 단일 벤더.** [ADR-007](../adr/ADR-007-hosting-and-infra.md). 대안 Vercel·Supabase·AWS 보류 사유 기록.
- **Google 로그인 1종 + 익명 병합 규칙.** [ADR-008](../adr/ADR-008-auth-and-account-merge.md). 카카오는 Season 2 이후 재검토.
- **도메인은 사용자가 구매.** 후보 4개, 가용성 미확인. [ADR-006](../adr/ADR-006-service-name-and-domain.md).
- **시간 모델·선발 규칙·브랜드 어휘·Legacy 가중치.** 커밋 2f1e070의 문서 보강에서 오케스트레이터가 확정. 사용자 반려 가능. 상세는 각 문서.

## 열린 질문

| 질문 | 필요 시점 | 담당 |
|---|---|---|
| 도메인 최종 선택 | Phase 0 CI 배포 전 | 사용자 |
| 저장소 공개 여부(GitHub Actions 무료 분수 영향) | Phase 0 | 사용자 |
| 카카오 로그인 추가 여부 | Season 2 설계 | 사용자 |
| 리플레이 검증 ON 시점 | 경쟁 랭킹 설계 시 | 오케스트레이터 |
