// T-11-825 원정 투어 화면 로직(웹 · 앱 공용). 서버 응답과 내 카드 목록으로 화면에 그릴 값을 만든다. 계산은 contracts를 그대로 쓴다.
import type { TeamPlayer, TourMatchView, TourStage } from '@offside/contracts';
import { FORMATIONS, type FormationId } from '@offside/contracts/owner-team';
import {
  TOUR_LIVE,
  TOUR_MAIN_STAGES,
  TOUR_TACTICS,
  tourFatigue,
  tourTacticEdge,
  tourWeekOf,
  type TourRule,
  type TourTactic,
} from '@offside/contracts/squad-tour';
import {
  tourAutoBench,
  tourAutoPick,
  tourCapBlocked,
  tourPlayable,
  tourSlotRating,
  tourStartable,
  type TourPick,
} from '@offside/contracts/squad-tour-lineup';
import { DAY_MS, KST_MS } from '@offside/contracts/kst';
import { clubById } from '@offside/game/clubs';
import { tn } from '@offside/game/i18n/names';
import { tourText as L } from './i18n/ko/tour.js';
import { leagueName } from './market.js';

export { TOUR_TACTICS, TOUR_LIVE, TOUR_MAIN_STAGES };
export type { TourPick, TourTactic };

/** 내 카드 한 장을 편성 계산용 값으로. 판매에 올린 카드는 부르는 쪽에서 뺀다. */
export const tourPickOf = (p: TeamPlayer): TourPick => ({
  id: p.careerId,
  peak: p.peak,
  pos: p.pos,
  dpos: p.dpos,
  roles: p.roles,
  type: p.type ?? null,
  enhance: p.enhance ?? 0,
  season: p.season ?? 0,
  nation: p.nation ?? null,
  mainLeague: p.mainLeague ?? null,
});

/** 투어에 쓸 수 있는 내 카드(판매 등록 중인 카드는 뛰지 못한다). */
export const tourPicks = (players: readonly TeamPlayer[]): TourPick[] =>
  players.filter((p) => !p.listing).map(tourPickOf);

export function tourRuleText(r: TourRule): string {
  switch (r.kind) {
    case 'peakMax':
      return L.rulePeakMax({ n: r.max });
    case 'enhanceMax':
      return L.ruleEnhanceMax({ n: r.max });
    case 'plain':
      return L.rulePlain;
    case 'season':
      return r.when === 'now' ? L.ruleSeasonNow : L.ruleSeasonPast;
    case 'leagueBan':
      return L.ruleLeagueBan({ league: leagueName(r.league) });
    case 'typeCap':
      return L.ruleTypeCap({ n: r.max });
    case 'nationCap':
      return L.ruleNationCap({ n: r.max });
    case 'leagueCap':
      return L.ruleLeagueCap({ league: leagueName(r.league), n: r.max });
  }
}

export const tourTacticName = (t: TourTactic): string =>
  ({
    press: L.tacticPress,
    possession: L.tacticPossession,
    wings: L.tacticWings,
    counter: L.tacticCounter,
    park: L.tacticPark,
  })[t];
export const tourTacticDesc = (t: TourTactic): string =>
  ({
    press: L.tacticPressDesc,
    possession: L.tacticPossessionDesc,
    wings: L.tacticWingsDesc,
    counter: L.tacticCounterDesc,
    park: L.tacticParkDesc,
  })[t];
/** 상대 전술에 대한 상성(1 강함 · -1 약함 · 0 없음)과 그 문구. */
export function tourEdge(mine: TourTactic, theirs: TourTactic) {
  const edge = tourTacticEdge(mine, theirs);
  return { edge, text: edge > 0 ? L.edgeGood : edge < 0 ? L.edgeBad : L.edgeEven };
}

/** 경기 이름: 본선은 n차전(마지막은 결승), 그 뒤는 무한 원정 n. */
export const tourStageName = (stage: number): string =>
  stage === TOUR_MAIN_STAGES
    ? L.final
    : stage < TOUR_MAIN_STAGES
      ? L.stageNo({ n: stage })
      : L.endless({ n: stage - TOUR_MAIN_STAGES });

/** T-11-827 그 경기의 상대 구단(엠블럼용 구단과 화면 이름). 서버가 구단을 주지 않으면 null이고 화면은 '상대'로 쓴다. */
export function tourOppClub(stage: Pick<TourStage, 'club'> | null | undefined) {
  const club = stage?.club ? clubById(stage.club) : null;
  return club ? { club, name: tn(club.name) } : null;
}

/** 이번 주가 끝날 때까지 남은 일 · 시간(다음 월요일 0시, 한국 시간). */
export function tourWeekLeft(now: string): { d: number; h: number } {
  const end = Date.parse(`${tourWeekOf(now)}T00:00:00.000Z`) - KST_MS + 7 * DAY_MS;
  const ms = Math.max(0, end - Date.parse(now));
  return { d: Math.floor(ms / DAY_MS), h: Math.floor((ms % DAY_MS) / 3_600_000) };
}

/** 여정 지도에서 그 경기의 상태. */
export const tourStageState = (stage: TourStage, cleared: number): 'done' | 'next' | 'locked' =>
  stage.stage <= cleared ? 'done' : stage.stage === cleared + 1 ? 'next' : 'locked';

export type TourDraft = {
  formation: FormationId;
  slotIds: (string | null)[];
  bench: string[];
  tactic: TourTactic;
};

/** 그 경기의 자동 편성(선발 + 교체 명단). 전술은 상대 시작 전술에 강한 것 가운데 첫째. */
export function tourAutoDraft(
  stage: TourStage,
  picks: readonly TourPick[],
  season: number,
  formation: FormationId,
): TourDraft {
  const slotIds = tourAutoPick(formation, picks, stage.rules, season, stage.merc);
  return {
    formation,
    slotIds,
    bench: tourAutoBench(slotIds, picks, stage.rules, season),
    tactic: TOUR_TACTICS.find((t) => tourTacticEdge(t, stage.tactic) > 0) ?? 'possession',
  };
}

export type TourCell = {
  /** 선발 자리 번호. */
  i: number;
  id: string | null;
  /** 자리 실력(제한 반영, 빈 자리는 용병 실력). */
  rating: number;
  merc: boolean;
};

/** 선발 자리마다 그릴 값(빈 자리는 현지 용병). */
export function tourCells(
  draft: Pick<TourDraft, 'formation' | 'slotIds'>,
  picks: ReadonlyMap<string, TourPick>,
  rules: readonly TourRule[],
  merc: number,
): TourCell[] {
  return FORMATIONS[draft.formation].map((slot, i) => {
    const id = draft.slotIds[i] ?? null;
    const c = id ? picks.get(id) : undefined;
    return c
      ? { i, id, rating: tourSlotRating(slot, c, rules), merc: false }
      : { i, id: null, rating: merc, merc: true };
  });
}

/** 그 카드를 선발로 못 세우는 이유: 지난 시즌 카드(season) · 그 경기 출전 제한(rule) · 인원 제한(cap). */
export type TourBlock = 'season' | 'rule' | 'cap' | null;

/** 라커룸의 한 줄: 내 카드 한 장의 실력과 지금 있는 곳, 선발로 못 세우는 이유. */
export type TourLockerRow = {
  id: string;
  /** 고른 자리가 있으면 그 자리 실력, 없으면 가장 잘 맞는 자리 실력. */
  rating: number;
  /** 선발 자리 번호(-1 = 선발 아님). */
  at: number;
  bench: boolean;
  /** 선발로 세울 수 없는 이유(교체 명단에는 playable이면 넣을 수 있다). */
  blocked: TourBlock;
  /** 그 경기에 뛸 수 있는가(교체 명단 가능 여부). */
  playable: boolean;
};

/**
 * 라커룸 목록(팀 그라운드와 같은 방식으로 고른다). slot이 있으면 그 자리 실력 순, 없으면 가장 잘 맞는 자리 실력 순이고, 선발로 못
 * 세우는 카드는 뒤에 둔다. 인원 제한은 그 카드가 지금 서 있는 자리 · 고른 자리의 선수를 빼고 센다.
 */
export function tourLocker(
  draft: TourDraft,
  picks: readonly TourPick[],
  rules: readonly TourRule[],
  season: number,
  slot: number | null = null,
): TourLockerRow[] {
  const slots = FORMATIONS[draft.formation];
  const byId = new Map(picks.map((p) => [p.id, p]));
  return picks
    .map((p): TourLockerRow => {
      const at = draft.slotIds.indexOf(p.id);
      const on = draft.slotIds
        .filter((id, k): id is string => id !== null && k !== slot && k !== at)
        .map((id) => byId.get(id))
        .filter((x): x is TourPick => !!x);
      const playable = tourPlayable(rules, p, season);
      return {
        id: p.id,
        rating:
          slot !== null
            ? tourSlotRating(slots[slot]!, p, rules)
            : Math.max(...slots.map((sl) => tourSlotRating(sl, p, rules))),
        at,
        bench: draft.bench.includes(p.id),
        playable,
        blocked: !playable
          ? 'rule'
          : !tourStartable(rules, p, season)
            ? 'season'
            : tourCapBlocked(rules, on, p)
              ? 'cap'
              : null,
      };
    })
    .sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || b.rating - a.rating);
}

/**
 * 카드를 선발 자리 i에 세운다. 그 카드가 다른 선발 자리에 있었으면 두 자리를 맞바꾸고, 교체 명단에 있었으면 명단에서 뺀다.
 * id가 null이면 자리를 비운다(현지 용병이 뛴다).
 */
export function tourAssign(draft: TourDraft, i: number, id: string | null): TourDraft {
  const slotIds = [...draft.slotIds];
  const from = id === null ? -1 : slotIds.indexOf(id);
  if (from >= 0) slotIds[from] = slotIds[i] ?? null;
  slotIds[i] = id;
  return {
    ...draft,
    slotIds,
    bench: id === null ? draft.bench : draft.bench.filter((x) => x !== id),
  };
}

/** 카드를 교체 명단에 넣거나 뺀다. 선발에 있던 카드는 자리를 비우고 명단으로 간다. 명단이 꽉 찼으면 그대로 둔다. */
export function tourToggleBench(draft: TourDraft, id: string): TourDraft {
  if (draft.bench.includes(id)) return { ...draft, bench: draft.bench.filter((x) => x !== id) };
  if (draft.bench.length >= TOUR_LIVE.bench) return draft;
  return {
    ...draft,
    slotIds: draft.slotIds.map((x) => (x === id ? null : x)),
    bench: [...draft.bench, id],
  };
}

/** 작전 타임 화면에서 자리마다: 지금 체력과 그만큼 깎인 실력. */
export const tourTired = (rating: number, stamina: number) => ({
  stamina: Math.round(stamina),
  rating: Math.round((rating - tourFatigue(stamina)) * 10) / 10,
  tired: stamina < TOUR_LIVE.stamina.tiredAt,
});

/** 다음 구간의 시작 · 끝 분(끝난 구간 수 기준). */
export const tourSpan = (done: number) => {
  const span = 90 / TOUR_LIVE.segments;
  return { from: done * span, to: (done + 1) * span };
};

/** 작전 타임 전술 버튼: 이길 가망(%)과 지금 전술 대비 차이. 가망이 높은 순. */
export function tourChances(match: TourMatchView) {
  const now = match.chances?.[match.tactic] ?? 0;
  return TOUR_TACTICS.map((t) => {
    const p = match.chances?.[t] ?? 0;
    return { tactic: t, pct: Math.round(p * 100), diff: Math.round((p - now) * 100) };
  });
}

/** 주 이름(그 주 월요일 'YYYY-MM-DD')을 화면 문구로. 이번 주는 '이번 주'. */
export function tourWeekLabel(week: string, current: string): string {
  if (week === current) return L.historyNow;
  const [, m, d] = week.split('-').map(Number);
  return L.historyWeek({ m: m ?? 0, d: d ?? 0 });
}
