// T-11-034 업적 달성 알림(웹·앱 공용). 업적은 서버가 은퇴·팀 저장·경기·좋아요·닉네임 뒤에 다시 세지만 알려 주지 않아
// 유저가 업적 탭을 열기 전엔 몰랐다. 이 기기가 마지막으로 본 업적별 점수를 적어 두고, 그런 쓰기가 있었으면(dirty) 다음에
// 홈·구단주·내 팀 화면에 올 때 한 번 업적을 받아 비교한다 — 새로 오른 업적이 있으면 시트(등급이 오르면 엠블럼과 함께)를
// 띄우고, 업적 탭을 열 때까지 하단 '구단주'와 내 팀 '업적' 탭에 점을, 업적 목록엔 NEW를 붙인다.
import { achGradeOf, type AchGrade } from '@offside/contracts/owner-team';
import type { ClubAchievementsResponse } from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/season';
import { ACH_SEEN_KEY, OUTBOX_KEY, achUnseenCount, clearAchDirty, isAchDirty } from './achDirty.js';
import type { ApiResult } from './api/client.js';
import type { SheetButton, SheetView } from './sheets.js';
import type { AppState } from './state.js';
import { num } from './teamText.js';
import { tn } from '@offside/game/i18n/names';
import { sheetAchieveText as L } from './i18n/ko/sheetAchieve.js';
import { achGradeName } from './teamOwner.js';

/** 이 기기에 본 기록이 없을 때(기능이 나오기 전부터 쌓은 구단주) 이보다 많이 새로 보이면 알리지 않고 기준만 잡는다. */
export const FIRST_RUN_MAX = 3;
/** 시트에 이름을 늘어놓는 업적 수(나머지는 '외 N개'). */
const LIST_MAX = 4;

/** 이 기기가 마지막으로 본 시즌 업적 — 업적별 점수와 아직 업적 탭에서 보지 않은 업적. */
export type AchSeen = {
  season: number;
  pts: Record<string, number>;
  score: number;
  unseen: string[];
};
export type AchFresh = { id: string; label: string; gained: number };
export type AchNudge = {
  fresh: AchFresh[];
  score: number;
  grade: AchGrade;
  /** 등급이 올랐으면 이전 등급. */
  from: AchGrade | null;
  next: AchGrade | null;
};

const pointsOf = (r: ClubAchievementsResponse): Record<string, number> =>
  Object.fromEntries(
    r.groups.flatMap((g) => (g.locked ? [] : g.items.map((i) => [i.id, i.points] as const))),
  );

/**
 * 받은 업적을 본 기록에 합친다. 같은 시즌이면 점수가 오른 업적이 새 업적이고, 새 시즌이면 처음부터 다시 쌓으니 점수가
 * 있는 업적 모두가 새 업적이다. 본 기록이 없으면 FIRST_RUN_MAX개 넘게 새로 보일 때 알리지 않는다.
 */
export function absorbAch(
  prev: AchSeen | null,
  r: ClubAchievementsResponse,
): { seen: AchSeen; nudge: AchNudge | null } {
  const pts = pointsOf(r);
  const same = prev?.season === r.season;
  const base = same ? prev.pts : {};
  const baseScore = same ? prev.score : 0;
  const items = new Map(r.groups.flatMap((g) => g.items.map((i) => [i.id, i] as const)));
  let fresh: AchFresh[] = Object.entries(pts)
    .filter(([id, p]) => p > (base[id] ?? 0))
    .map(([id, p]) => ({ id, label: items.get(id)?.label ?? id, gained: p - (base[id] ?? 0) }))
    .sort((a, b) => b.gained - a.gained);
  if (!prev && fresh.length > FIRST_RUN_MAX) fresh = [];
  const unseen = [...new Set([...(same ? prev.unseen : []), ...fresh.map((f) => f.id)])];
  const seen: AchSeen = { season: r.season, pts, score: r.score, unseen };
  if (!fresh.length) return { seen, nudge: null };
  const { grade, next } = achGradeOf(r.score);
  const before = achGradeOf(prev ? baseScore : r.score - fresh.reduce((s, f) => s + f.gained, 0));
  return {
    seen,
    nudge: {
      fresh,
      score: r.score,
      grade,
      next,
      from: before.grade.id !== grade.id ? before.grade : null,
    },
  };
}

const pendingRetirement = () =>
  (loadKey<{ kind: string }[]>(OUTBOX_KEY) ?? []).some((i) => i.kind === 'retirement');

/** 업적 시트 본문(sheets.ts 'achieve'). */
export function achieveView(n: AchNudge): Extract<SheetView, { kind: 'achieve' }> {
  const shown = n.fresh.slice(0, LIST_MAX);
  return {
    kind: 'achieve',
    eyebrow: n.from ? 'Grade up' : 'Achievement',
    title: n.from ? L.gradeUp({ grade: achGradeName(n.grade) }) : L.achieved({ n: n.fresh.length }),
    grade: { id: n.grade.id, name: achGradeName(n.grade) },
    from: n.from ? { id: n.from.id, name: achGradeName(n.from) } : null,
    items: shown.map((f) => ({ label: tn(f.label), gained: f.gained })),
    more: n.fresh.length - shown.length,
    gained: n.fresh.reduce((s, f) => s + f.gained, 0),
    score: n.score,
    next: n.next
      ? L.nextGrade({ name: achGradeName(n.next), pts: num(n.next.min - n.score) })
      : null,
  };
}

export interface AchNudgeHost {
  state: AppState;
  /** 지금 시즌 업적(api/team fetchClubAchievements). */
  fetch(): Promise<ApiResult<ClubAchievementsResponse>>;
  sheetOpen(): boolean;
  showSheet(view: SheetView, buttons: SheetButton[]): void;
  closeSheet(): void;
  /** 내 팀 업적 탭을 연다. */
  openAchievements(): void;
}

export function createAchNudge(host: AchNudgeHost) {
  const { state } = host;
  const loadSeen = () => loadKey<AchSeen>(ACH_SEEN_KEY);
  const saveSeen = (s: AchSeen) => {
    void saveKey(ACH_SEEN_KEY, s);
    state.achNew = s.unseen.length;
  };
  let busy = false;

  /** 앱을 열 때 — 지난번에 보지 않은 업적 점을 되살린다. */
  function restore() {
    state.achNew = achUnseenCount();
  }

  /**
   * 쓰기가 있었으면 업적을 받아 비교하고 새 업적을 알린다. 시트가 떠 있거나 은퇴가 아직 올라가지 않았으면 다음 기회로
   * 미룬다. 구단주가 아니면(403) 표시만 지운다.
   */
  async function check() {
    if (busy || !isAchDirty() || host.sheetOpen() || pendingRetirement()) return;
    busy = true;
    try {
      const r = await host.fetch();
      if (!r.ok) {
        if (!r.error.retryable) clearAchDirty();
        return;
      }
      clearAchDirty();
      const { seen, nudge } = absorbAch(loadSeen(), r.data);
      saveSeen(seen);
      if (!nudge || host.sheetOpen()) return;
      host.showSheet(achieveView(nudge), [
        {
          label: L.viewAch,
          cls: 'btn-primary',
          fn: () => {
            host.closeSheet();
            host.openAchievements();
          },
        },
        { label: L.close, fn: host.closeSheet },
      ]);
    } finally {
      busy = false;
    }
  }

  /**
   * 업적 탭이 지금 시즌 업적을 받았을 때 — 본 것으로 적고 NEW를 붙일 업적 id를 돌려준다. 지난 시즌을 고른 화면은 본 기록을
   * 건드리지 않는다.
   */
  function viewed(r: ClubAchievementsResponse): ReadonlySet<string> {
    const prev = loadSeen();
    if (prev && r.season < prev.season) return new Set();
    const { seen } = absorbAch(prev, r);
    // 본 기록이 없던 첫 화면은 이미 쌓인 업적을 모두 NEW로 보이지 않는다.
    const fresh = prev ? seen.unseen : [];
    saveSeen({ ...seen, unseen: [] });
    clearAchDirty();
    return new Set(fresh);
  }

  return { restore, check, viewed };
}
