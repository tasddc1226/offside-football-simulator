// ───────── 앱 쪽 연결 (T-11-005) ─────────
// 게임 진행·시트 연출·업로드·선수 상세·클럽 커스텀·영구결번·새 소식은 웹과 같은 @offside/app-core 로직을 쓴다.
// 여기서는 앱 상태(valtio)와 화면 쪽 동작(스크롤·토스트·햅틱)을 넘겨 한 벌씩 만든다.
import { analytics, trackPage } from '../analytics';
import * as Haptics from 'expo-haptics';
import { createSheetController } from '@offside/app-core/sheet-controller';
import { createGameActions } from '@offside/app-core/game-actions';
import { createUploader } from '@offside/app-core/upload';
import * as Outbox from '@offside/app-core/outbox';
import { saveGame } from '@offside/app-core/career';
import { createClubCustom } from '@offside/app-core/clubCustom';
import { createLegends } from '@offside/app-core/legend';
import { createRetiredNumbers } from '@offside/app-core/retiredNumber';
import { createNews } from '@offside/app-core/news';
import { createOwnerConflicts } from '@offside/app-core/ownerConflict';
import { createNavStack } from '@offside/app-core/navHistory';
import { getProfile } from '@offside/app-core/api/client';
import { gameText as T } from '@offside/app-core/i18n/ko/game';
import { APP_VERSION, WEB_ORIGIN } from '../platform/config';
import { ensureSession, renewSession, sessionToken } from '../platform/session';
import {
  accountCache,
  appState,
  clubCustom,
  newsState,
  prefs,
  pickedTitles,
  rnAlert,
  rnMisses,
  rnResults,
  sheetState,
  toastState,
} from '../store';
import { scrollTo, scrollY } from '../ui/scroll';

// ───────── 저장 · 토스트 ─────────
let saveWarned = false;
export function save() {
  const s = appState.G;
  const ok = saveGame(s);
  if (!s || ok || saveWarned) return;
  saveWarned = true;
  toast(T.storageFull);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string) {
  toastState.text = text;
  toastState.visible = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastState.visible = false), 2200);
}

/** 진동을 줘도 되는지 — 설정의 진동 스위치가 켜져 있고 동작 줄이기가 아닐 때. */
export const hapticsOn = (): boolean => prefs.haptics && prefs.motionOK;

/** 짧은 진동(웹 motion.buzz). */
export function buzz() {
  if (hapticsOn()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// ───────── 업로드 ─────────
const outbox = () => Promise.resolve(Outbox);
export const { uploadSeason, uploadRetirement, uploadLegacyRetirement, enqueueAllSeasons } =
  createUploader({ outbox, appVersion: APP_VERSION });

// ───────── 시트 · 진행 액션 ─────────
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
export const sheet = createSheetController(sheetState, {
  // valtio는 고친 값을 다음 마이크로태스크에 알리고, React가 그 뒤 프레임에 그린다.
  tick: nextFrame,
  painted: () => nextFrame().then(nextFrame),
  motionOK: () => prefs.motionOK,
});
export const { showSheet, closeSheet, dismissSheet } = sheet;

export const {
  advance,
  nextPending,
  chooseEvent,
  pickOption,
  doRetire,
  confirmNew,
  retireAsk,
  startCareer,
  rollCandidates,
  rerollCandidates,
  revealCandidatePotential,
} = createGameActions({
  state: appState,
  sheet,
  save,
  toast,
  scrollTop: (smooth) => scrollTo(0, smooth && prefs.motionOK),
  uploadSeason,
  uploadRetirement,
  analytics,
  trackPage,
});

// ───────── 클럽 커스텀 · 선수 상세 · 영구결번 · 새 소식 · 소유권 충돌 ─────────
export const {
  loadClubCustom,
  setClubCustom,
  resetClubCustom,
  exportClubCustom,
  importClubCustom,
  syncClubCustom,
} = createClubCustom(clubCustom, { game: () => appState.G, save });

export const { recordRn, fillGranted, rnOf, watchRetiredNumberAlerts } = createRetiredNumbers(
  rnResults,
  rnAlert,
  (id, title) => {
    pickedTitles[id] = title;
  },
  rnMisses,
);

export const {
  viewFromEntry,
  viewFromGame,
  openLocalLegend,
  openPublicLegend,
  openPublicLegendById,
  setLegendPublic,
  loadSharedLegend,
} = createLegends({ state: appState, rnOf, toast, uploadRetirement, scrollTop: () => scrollTo(0) });

/** 은퇴 커리어 공유 링크 — 웹 주소로 연다(앱이 없는 사람도 볼 수 있다). */
export const shareUrl = (careerId: string) => `${WEB_ORIGIN}/career/${careerId}`;

export const { markNewsSeen, dismissNews, checkNews } = createNews(newsState);

export const { onOwnerConflict, adoptCareer, keepOnDevice } = createOwnerConflicts({
  state: appState,
  save,
  toast,
  enqueueAllSeasons: (G, eventsOf) => void outbox().then((m) => enqueueAllSeasons(m, G, eventsOf)),
});

Outbox.configureOutbox({
  onConflict: onOwnerConflict,
  onRetiredNumber: (e) => recordRn(e.careerId, e.result, e.serviceSeason, e.title, e.miss),
});

/** 프로필을 다시 받아 캐시에 둔다. 실패는 'error'(서버에 연결하지 못함). 토큰이 무효(폐기·만료·탈퇴)면 버리고
 * 새 익명 세션으로 한 번 더 받는다. */
export async function refreshAccount() {
  await ensureSession();
  let r = await getProfile();
  if (!r.ok && r.error.code === 'PROFILE_REQUIRED' && sessionToken()) {
    if (await renewSession()) r = await getProfile();
  }
  accountCache.fetchedAt = Date.now();
  accountCache.value = r.ok ? r.data : 'error';
}

// ───────── 뒤로 가기 ─────────
/** 화면 방문 기록 — 화면이 바뀔 때 track(), Android 뒤로 버튼·'← 이전으로'가 back(). */
export const navStack = createNavStack(appState, { closeSheet, scrollY, scrollTo });
