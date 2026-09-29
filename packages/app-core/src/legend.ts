// ───────── 은퇴 선수 상세 · 공개 명예의 전당 (웹·앱 공용, T-10-005 · 공용 T-11-005) ─────────
// 은퇴 상세 화면과 은퇴 직후 화면이 같은 LegendView를 그린다. 내 선수는 로컬 ft_hof 항목(HofEntry)에서,
// 다른 유저의 선수는 서버 /v1/hof에서 만든다.
import type { PublicHofEntry, RetiredNumberResult } from '@offside/contracts';
import { toPublicName } from '@offside/contracts/content-filter';
import { isHofEligible } from '@offside/contracts/hof-rules';
import { legendScore, loadHOF, saveKey } from '@offside/game/season';
import type { GameState, HofEntry } from '@offside/game/types';
import { mainTitle } from '@offside/game/titles';
import { potReveal } from '@offside/game/stats';
import { getHofDetail, getMyCareers } from './api/client.js';
import { anonName, totals } from './format.js';
import type { AppState, LegendView } from './state.js';

export interface LegendHost {
  state: AppState;
  rnOf(
    careerId: string | undefined,
    saved: RetiredNumberResult | null | undefined,
  ): RetiredNumberResult | null | undefined;
  toast(text: string): void;
  uploadRetirement(careerId: string, entry: HofEntry): void;
  /** 선수 상세를 열 때 맨 위로. */
  scrollTop(): void;
}

/** 짧은 커리어(T-10-032)는 서버 명예의 전당에 오르지 않아 공유 링크가 없다. */
const ownShareId = (h: HofEntry | null | undefined) =>
  h?.id && isHofEligible(h.age) ? h.id : null;

/** 다른 유저에게 보이는 그대로(공개하지 않은 이름은 익명). */
function publicView(e: PublicHofEntry, d: LegendView['d']): LegendView {
  return {
    name: e.name ?? anonName(e.pos, e.number),
    number: e.number,
    pos: e.pos,
    age: e.retireAge,
    lastClub: e.lastClub,
    lastClubId: e.lastClubId,
    score: e.legendScore,
    peak: e.peak,
    d,
    totals: {
      apps: e.apps,
      goals: e.goals,
      assists: e.assists,
      trophies: e.trophies,
      awards: e.awards,
      caps: e.caps,
    },
    own: null,
    shareId: null,
    title: e.title ?? null,
    rn: e.retiredNumber ? { kind: 'granted', ...e.retiredNumber } : null,
  };
}

export function createLegends(host: LegendHost) {
  function viewFromEntry(h: HofEntry): LegendView {
    return {
      name: h.name,
      number: h.number,
      pos: h.pos,
      age: h.age,
      lastClub: h.lastClub,
      lastClubId: h.lastClubId,
      score: h.score,
      peak: h.peak,
      d: h.detail ?? null,
      totals: {
        apps: h.apps,
        goals: h.goals,
        assists: h.assists,
        trophies: h.trophies,
        awards: h.awards,
        caps: h.caps,
      },
      own: h,
      shareId: ownShareId(h),
      title: h.title ?? null,
      rn: host.rnOf(h.id, h.rn),
    };
  }

  /** 방금 은퇴한 진행 중 세이브(G)로 만든다 — 스냅샷이 아니라 G를 그대로 읽는다. */
  function viewFromGame(s: GameState): LegendView {
    const t = totals(s);
    const own = loadHOF().find((x) => x.id === s.cid) ?? null;
    return {
      name: s.name,
      number: s.number,
      pos: s.pos,
      age: s.age,
      lastClub: s.club.name,
      lastClubId: s.club.id,
      score: legendScore(s),
      peak: s.peak,
      d: s,
      totals: {
        apps: t.p,
        goals: t.g,
        assists: t.a,
        trophies: s.trophies.length,
        awards: s.awards.length,
        caps: s.nat.caps,
      },
      own,
      shareId: ownShareId(own),
      title: mainTitle(s)?.id ?? null,
      pot: potReveal(s),
      rn: host.rnOf(s.cid, own?.rn),
    };
  }

  /** mine: 계정의 내 선수(T-10-069) — 다른 기기에서 은퇴해 이 기기엔 없어도 공유 바는 띄운다(서버 명예의 전당에
   * 있으니 링크가 있다). */
  function viewFromPublic(e: PublicHofEntry, d: LegendView['d'], mine: boolean): LegendView {
    // 내 기기에 있는 선수면 로컬 항목을 우선한다(이름 공개 토글 가능).
    const own = loadHOF().find((x) => x.id === e.id);
    if (own) return viewFromEntry(own);
    return { ...publicView(e, d), shareId: mine ? e.id : null };
  }

  /** T-10-069 계정에 기록된 내 선수인가 — 어디서 열든(명예의 전당·홈 라이브·구단주) 같게. 목록은 1분 메모라
   * 여러 번 열어도 다시 묻지 않는다. 연결 안 됨·실패면 false(이 기기 기록은 viewFromPublic이 따로 본다). */
  async function isMyCareer(id: string): Promise<boolean> {
    const r = await getMyCareers();
    return r.ok && r.data.entries.some((e) => e.id === id);
  }

  function show(v: LegendView) {
    const s = host.state;
    s.legend = v;
    s.legendBack = s.screen === 'hof' || s.screen === 'owner' ? s.screen : 'home';
    s.screen = 'legend';
    host.scrollTop();
  }

  function openLocalLegend(h: HofEntry) {
    show(viewFromEntry(h));
  }

  async function openPublicLegend(e: PublicHofEntry) {
    if (!e.hasDetail) return show(viewFromPublic(e, null, await isMyCareer(e.id)));
    return openPublicLegendById(e.id);
  }

  /** T-10-030 홈 라이브 피드의 은퇴 소식처럼 id만 아는 선수를 연다. */
  async function openPublicLegendById(careerId: string) {
    const [r, mine] = await Promise.all([getHofDetail(careerId), isMyCareer(careerId)]);
    if (!r.ok) {
      host.toast('상세 기록을 불러오지 못했습니다.');
      return;
    }
    show(viewFromPublic(r.data.entry, r.data.snapshot, mine));
  }

  /** 내 선수의 이름 공개 여부를 바꾼다: 로컬 ft_hof에 기록하고, 서버에는 은퇴 요약을 다시 보내 공개
   * 이름을 갱신한다(서버는 같은 커리어의 재전송을 upsert로 처리한다). 서버가 거부할 이름(링크·욕설)은
   * 보내기 전에 막는다 — 업로드 큐는 4xx를 조용히 버려서, 그대로 두면 "공개했습니다"만 뜨고 실제로는 익명이다.
   * 바꿨으면 true. */
  function setLegendPublic(h: HofEntry, on: boolean): boolean {
    if (!h.id) return false;
    if (on && !toPublicName(h.name)) {
      host.toast('이 이름은 공개할 수 없어요 — 링크나 욕설이 들어간 이름은 익명으로만 올라갑니다.');
      return false;
    }
    const hof = loadHOF();
    const saved = hof.find((x) => x.id === h.id);
    if (saved) saved.public = on;
    saveKey('ft_hof', hof);
    h.public = on;
    host.uploadRetirement(h.id, h);
    host.toast(on ? '명예의 전당에 이름을 공개했습니다.' : '명예의 전당에서 익명으로 바꿨습니다.');
    return true;
  }

  /** 공유된 선수를 받는다 — 링크를 연 사람이 선수 주인이어도 다른 사람에게 보이는 그대로 그린다. */
  async function loadSharedLegend(careerId: string): Promise<LegendView | 'missing' | 'error'> {
    const r = await getHofDetail(careerId);
    if (r.ok) return publicView(r.data.entry, r.data.snapshot);
    return r.error.retryable ? 'error' : 'missing';
  }

  return {
    viewFromEntry,
    viewFromGame,
    openLocalLegend,
    openPublicLegend,
    openPublicLegendById,
    setLegendPublic,
    loadSharedLegend,
  };
}
