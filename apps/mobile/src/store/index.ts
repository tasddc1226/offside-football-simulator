// ───────── 앱 반응형 상태 (T-11-005) ─────────
// 상태의 모양·처음 값·고치는 로직은 웹과 같은 @offside/app-core에 있다. 앱은 valtio proxy로 감싸고, 화면은
// useSnapshot으로 읽고(다시 그리기) 원본 proxy를 고친다(웹 Svelte $state 자리). 글 입력 칸이 읽는 곳은
// useSnapshot(x, { sync: true })로 — 기본(비동기 묶음)이면 한글 조합 중 커서가 튄다.
import { proxy } from 'valtio';
import { initialAppState, type AppState } from '@offside/app-core/state';
import { initialSheetState, type SheetState } from '@offside/app-core/sheet-controller';
import { initialClubCustomState } from '@offside/app-core/clubCustom';
import { initialNewsState } from '@offside/app-core/news';
import type { RnAlert, RnResults } from '@offside/app-core/retiredNumber';
import type { Profile } from '@offside/app-core/api/client';
import { loadKey } from '@offside/game/season';

export const appState = proxy<AppState>(initialAppState());
export const sheetState = proxy<SheetState>(initialSheetState());
export const toastState = proxy({ text: '', visible: false });
export const clubCustom = proxy(initialClubCustomState());
export const newsState = proxy(initialNewsState());
/** T-11-042 스토어 업데이트 안내 — url: 이 앱이 최소 버전보다 낮으면 스토어 주소, closed: 이번 실행에서 닫았다. */
export const storeUpdate = proxy<{ url: string | null; closed: boolean }>({
  url: null,
  closed: false,
});
/** 커리어 id → 이번 접속에서 받은 영구결번 심사 결과. */
export const rnResults = proxy<RnResults>({});
/** 방금 서버 어딘가에서 확정된 영구결번(화면 위 알림). */
export const rnAlert = proxy<RnAlert>({ item: null });
/** 프로필 확인 캐시 — 구단주·설정 화면을 오가도 유지한다(웹 account-state). */
export const accountCache = proxy<{
  value: Profile | null | 'error' | undefined;
  fetchedAt: number;
}>({ value: undefined, fetchedAt: 0 });
/** 커리어 id → 이번 접속에서 고른 대표 칭호(웹 titles/legendTitle). */
export const pickedTitles = proxy<Record<string, string | null>>({});
export const legendTitleOf = (careerId: string | undefined, saved: string | null | undefined) =>
  careerId && careerId in pickedTitles ? pickedTitles[careerId] : saved;

/** 기기 설정. theme: 설정에서 고른 테마(null이면 시스템) · motionOK: 시스템 '동작 줄이기'가 꺼져 있다. */
export const prefs = proxy<{ theme: 'light' | 'dark' | null; motionOK: boolean }>({
  theme: loadKey<'light' | 'dark'>('ft_theme'),
  motionOK: true,
});
