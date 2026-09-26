// ───────── T-10-005 은퇴 선수 상세 · 공개 명예의 전당 ─────────
// 은퇴 상세 화면(Legend.svelte)과 은퇴 직후 화면(Retired.svelte)이 같은 LegendView를 그린다.
// 내 선수는 로컬 ft_hof 항목(HofEntry)에서, 다른 유저의 선수는 서버 /v1/hof에서 만든다.
import type { PublicHofEntry } from '@offside/contracts';
import { isAcceptablePublicName } from '@offside/contracts/content-filter';
import { legendScore, loadHOF, saveKey } from '../game/season.js';
import type { GameState, HofEntry } from '../game/types.js';
import { getHofDetail } from '../api/client.js';
import { appState, type LegendView } from './state.svelte.js';
import { toast, uploadRetirement } from './helpers.js';
import { anonName, totals } from './format.js';
import { mainTitle } from '../game/titles.js';
import { SHARE_PATH } from '../share-path.js';

export function viewFromEntry(h: HofEntry): LegendView {
  return {
    name: h.name,
    number: h.number,
    pos: h.pos,
    age: h.age,
    lastClub: h.lastClub,
    score: h.score,
    peak: h.peak,
    d: h.detail ?? null,
    totals: { apps: h.apps, goals: h.goals, assists: h.assists, trophies: h.trophies, awards: h.awards, caps: h.caps },
    own: h,
    title: h.title ?? null,
  };
}

/** 방금 은퇴한 진행 중 세이브(G)로 만든다 — 스냅샷이 아니라 G를 그대로 읽는다. */
export function viewFromGame(s: GameState): LegendView {
  const t = totals(s);
  return {
    name: s.name,
    number: s.number,
    pos: s.pos,
    age: s.age,
    lastClub: s.club.name,
    score: legendScore(s),
    peak: s.peak,
    d: s,
    totals: { apps: t.p, goals: t.g, assists: t.a, trophies: s.trophies.length, awards: s.awards.length, caps: s.nat.caps },
    own: loadHOF().find((x) => x.id === s.cid) ?? null,
    title: mainTitle(s)?.id ?? null,
  };
}

function viewFromPublic(e: PublicHofEntry, d: LegendView['d']): LegendView {
  // 내 기기에 있는 선수면 로컬 항목을 우선한다(이름 공개 토글 가능).
  const own = loadHOF().find((x) => x.id === e.id);
  return own ? viewFromEntry(own) : publicView(e, d);
}

/** 다른 유저에게 보이는 그대로(공개하지 않은 이름은 익명). */
function publicView(e: PublicHofEntry, d: LegendView['d']): LegendView {
  return {
    name: e.name ?? anonName(e.pos, e.number),
    number: e.number,
    pos: e.pos,
    age: e.retireAge,
    lastClub: e.lastClub,
    score: e.legendScore,
    peak: e.peak,
    d,
    totals: { apps: e.apps, goals: e.goals, assists: e.assists, trophies: e.trophies, awards: e.awards, caps: e.caps },
    own: null,
    title: e.title ?? null,
  };
}

function show(v: LegendView) {
  appState.legend = v;
  appState.legendBack = appState.screen === 'hof' ? 'hof' : 'home';
  appState.screen = 'legend';
  window.scrollTo(0, 0);
}

export function openLocalLegend(h: HofEntry) {
  show(viewFromEntry(h));
}

export async function openPublicLegend(e: PublicHofEntry) {
  if (!e.hasDetail) return show(viewFromPublic(e, null));
  return openPublicLegendById(e.id);
}

/** T-10-030 홈 라이브 피드의 은퇴 소식처럼 id만 아는 선수를 연다. */
export async function openPublicLegendById(careerId: string) {
  const r = await getHofDetail(careerId);
  if (!r.ok) {
    toast('상세 기록을 불러오지 못했습니다.');
    return;
  }
  show(viewFromPublic(r.data.entry, r.data.snapshot));
}

/** 내 선수의 이름 공개 여부를 바꾼다: 로컬 ft_hof에 기록하고, 서버에는 은퇴 요약을 다시 보내 공개
 * 이름을 갱신한다(서버는 같은 커리어의 재전송을 upsert로 처리한다). 서버가 거부할 이름(링크·욕설)은
 * 보내기 전에 막는다 — 업로드 큐는 4xx를 조용히 버려서, 그대로 두면 "공개했습니다"만 뜨고 실제로는 익명이다.
 * 바꿨으면 true. */
export function setLegendPublic(h: HofEntry, on: boolean): boolean {
  if (!h.id) return false;
  if (on && !isAcceptablePublicName(h.name)) {
    toast('이 이름은 공개할 수 없어요 — 링크나 욕설이 들어간 이름은 익명으로만 올라갑니다.');
    return false;
  }
  const hof = loadHOF();
  const saved = hof.find((x) => x.id === h.id);
  if (saved) saved.public = on;
  saveKey('ft_hof', hof);
  h.public = on;
  uploadRetirement(h.id, h);
  toast(on ? '명예의 전당에 이름을 공개했습니다.' : '명예의 전당에서 익명으로 바꿨습니다.');
  return true;
}

// ───────── T-10-029 은퇴 커리어 공유 링크 ─────────
// 링크는 `/career/<커리어 id>` — 공개 명예의 전당 상세(/v1/hof/:id)를 보기 전용 화면(SharedCareer)으로
// 그린다. 커리어 id는 클라이언트가 만든 UUID라 추측할 수 없다. 워커(worker.ts APP_PATHS)가 앱 셸로 내려 준다.
export const shareUrl = (careerId: string) => `${window.location.origin}/career/${careerId}`;

/** 공유 링크로 들어왔으면 보기 전용 화면을 연다(앱 시작 때 한 번). */
export function routeSharedCareer() {
  const m = SHARE_PATH.exec(window.location.pathname);
  if (!m) return;
  appState.sharedCareer = m[1]!.toLowerCase();
  appState.screen = 'shared';
}

/** 공유된 선수를 받는다 — 링크를 연 사람이 선수 주인이어도 다른 사람에게 보이는 그대로 그린다. */
export async function loadSharedLegend(careerId: string): Promise<LegendView | 'missing' | 'error'> {
  const r = await getHofDetail(careerId);
  if (r.ok) return publicView(r.data.entry, r.data.snapshot);
  return r.error.retryable ? 'error' : 'missing';
}

/** 공유하려고 로그인하고 돌아왔을 때 선수 상세의 공유 카드로 화면을 옮기라는 표시(ShareCard가 지운다). */
export const shareFocus = { pending: false };
