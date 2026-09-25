// ───────── T-10-005 은퇴 선수 상세 · 공개 명예의 전당 ─────────
// 은퇴 상세 화면(Legend.svelte)과 은퇴 직후 화면(Retired.svelte)이 같은 LegendView를 그린다.
// 내 선수는 로컬 ft_hof 항목(HofEntry)에서, 다른 유저의 선수는 서버 /v1/hof에서 만든다.
import type { PublicHofEntry } from '@offside/contracts';
import { POS, type Pos } from '../game/data.js';
import { legendScore, loadHOF, saveKey } from '../game/season.js';
import type { GameState, HofEntry } from '../game/types.js';
import { getHofDetail } from '../api/client.js';
import { appState, type LegendView } from './state.svelte.js';
import { toast, uploadRetirement } from './helpers.js';
import { totals } from './format.js';

export function anonName(pos: Pos, number: number | null): string {
  return `익명의 ${POS[pos].label}${number != null ? ` No.${number}` : ''}`;
}

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
  };
}

function viewFromPublic(e: PublicHofEntry, d: LegendView['d']): LegendView {
  // 내 기기에 있는 선수면 로컬 항목을 우선한다(이름 공개 토글 가능).
  const own = loadHOF().find((x) => x.id === e.id);
  if (own) return viewFromEntry(own);
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
  const r = await getHofDetail(e.id);
  if (!r.ok) {
    toast('상세 기록을 불러오지 못했습니다.');
    return;
  }
  show(viewFromPublic(r.data.entry, r.data.snapshot));
}

/** 내 선수의 이름 공개 여부를 바꾼다: 로컬 ft_hof에 기록하고, 서버에는 은퇴 요약을 다시 보내 공개
 * 이름을 갱신한다(서버는 같은 커리어의 재전송을 upsert로 처리한다). */
export function setLegendPublic(h: HofEntry, on: boolean) {
  if (!h.id) return;
  const hof = loadHOF();
  const saved = hof.find((x) => x.id === h.id);
  if (saved) saved.public = on;
  saveKey('ft_hof', hof);
  h.public = on;
  uploadRetirement(h.id, h);
  toast(on ? '명예의 전당에 이름을 공개했습니다.' : '명예의 전당에서 익명으로 바꿨습니다.');
}
