// T-11-335 서버 최초 기록 화면의 단계 묶기 · 한 번에 넘은 단계 · 많이 세운 선수. 홈 카드(firsts.ts)가 첫 화면 청크에 있어
// 기록실 화면만 쓰는 계산은 여기 따로 둔다.
import type { ServerFirst } from '@offside/contracts';
import { byDay, type AchievedFirst, type Holder } from './firsts.js';

// 끝없는 단계(통산 100·150·200…골, 레전드 점수 840·1,000…)는 한 단계가 한 줄이라 분류 탭이 수십 줄씩 길어졌다.
// 같은 기록의 단계를 한 줄로 묶어 가장 높이 오른 단계 · 다음 목표 · 진행 단계만 보이고, 펼치면 단계를 다 본다.

/** 단계 기록의 묶음 키 — id 끝 숫자를 뗀다(goals150 → goals). 숫자가 없으면 id 그대로. */
export const seriesKey = (id: string): string => id.replace(/\d+$/, '') || id;
const stepNo = (id: string): number => Number(/\d+$/.exec(id)?.[0] ?? 0);

export interface FirstSeries {
  key: string;
  /** 규칙 순서(낮은 단계부터). 단계가 없는 기록은 하나. */
  steps: ServerFirst[];
  /** 달성한 가장 높은 단계. 아무도 못 채웠으면 null. */
  top: AchievedFirst | null;
  /** top 위로 아직 아무도 못 채운 첫 단계. 다 채웠으면 null. */
  next: ServerFirst | null;
  done: number;
}

const isAchieved = (x: ServerFirst): x is AchievedFirst => !!x.holder && !!x.achievedAt;

/** 분류 탭: 같은 묶음 키가 이어지는 기록을 한 묶음으로(서버가 규칙 순서로 보낸다). */
export function seriesList(items: ServerFirst[]): FirstSeries[] {
  const groups: ServerFirst[][] = [];
  for (const x of items) {
    const last = groups[groups.length - 1];
    if (last && seriesKey(last[0]!.id) === seriesKey(x.id) && last[0]!.cat === x.cat) last.push(x);
    else groups.push([x]);
  }
  return groups.map((steps) => {
    let ti = -1;
    steps.forEach((x, i) => {
      if (isAchieved(x)) ti = i;
    });
    const top = ti >= 0 ? (steps[ti] as AchievedFirst) : null;
    return {
      key: seriesKey(steps[0]!.id),
      steps,
      top,
      next: steps.slice(ti + 1).find((x) => !isAchieved(x)) ?? null,
      done: steps.filter(isAchieved).length,
    };
  });
}

/** 최근 기록 한 줄. 같은 날 같은 선수가 한 기록의 여러 단계를 넘었으면 가장 높은 단계 하나로 묶고 steps에 개수를 둔다. */
export interface RecentFirst {
  item: AchievedFirst;
  steps: number;
}

/** 최근 기록 탭: 한국 날짜별로 묶고, 그날 같은 선수 · 같은 기록의 단계는 한 줄로(가장 늦게 넘은 자리에). */
export function recentDays(list: AchievedFirst[]): { day: string; items: RecentFirst[] }[] {
  return byDay(list).map((d) => {
    const out: RecentFirst[] = [];
    const at = new Map<string, RecentFirst>();
    for (const x of d.items) {
      const k = `${x.holder.careerId}|${x.cat}|${seriesKey(x.id)}`;
      const hit = at.get(k);
      if (!hit) {
        const e = { item: x, steps: 1 };
        at.set(k, e);
        out.push(e);
      } else {
        hit.steps++;
        if (stepNo(x.id) > stepNo(hit.item.id)) hit.item = x;
      }
    }
    return { day: d.day, items: out };
  });
}

/** 이 시즌 기록을 가장 많이 세운 선수(개수 많은 순, 같으면 최근에 세운 순). */
export function topHolders(list: AchievedFirst[], n = 3): { holder: Holder; count: number }[] {
  const m = new Map<string, { holder: Holder; count: number }>();
  for (const x of list) {
    const e = m.get(x.holder.careerId);
    if (e) e.count++;
    else m.set(x.holder.careerId, { holder: x.holder, count: 1 });
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, n);
}
