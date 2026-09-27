// ───────── 은퇴 리포트: 클럽별 챕터 타임라인 · 우승 연혁 (T-10-062) ─────────
// 순수 함수만 있다 — 이미 기록된 시즌·우승·수상·이정표만 읽고 RNG를 전혀 쓰지 않는다.
import type { LegendSource } from './types.js';

export interface ChapterEvent {
  year: number;
  /** trophy: 팀 우승 · mile: 커리어 이정표 · story: 이야기 결말 */
  kind: 'trophy' | 'mile' | 'story';
  text: string;
  /** 같은 챕터에서 여러 번 든 우승은 한 줄로 묶고 해마다 적는다. */
  years: number[];
}
/** 한 클럽에서 연달아 뛴 시즌 묶음(영화의 한 장). 같은 클럽으로 돌아오면 새 장이 된다. */
export interface Chapter {
  club: string;
  leagues: string[];
  from: number;
  to: number;
  ageFrom: number;
  ageTo: number;
  seasons: number;
  apps: number;
  goals: number;
  assists: number;
  cs: number;
  events: ChapterEvent[];
}

/** 대표팀 대회 우승이 기록되는 클럽 이름(season.ts). */
export const NATIONAL_TEAM = '대한민국';
// 대표팀 쪽 이정표는 대표팀 장면으로 따로 모은다. 이정표 문구는 comps.ts checkMilestones가 만든다.
const NATIONAL_MILE = /A매치|대표팀|월드컵|센추리/;
const MINOR_MILE = /데뷔골|경기 출전|후보|입성|본선 득점|컨퍼런스리그|엘리트/;
/** 챕터에 남길 이정표 — 데뷔골·N경기 출전·후보 선정 같은 자잘한 것은 뺀다. 통산 골은 100골 단위만. */
export function isKeyMilestone(t: string): boolean {
  if (MINOR_MILE.test(t)) return false;
  const goals = /통산 (\d+)골/.exec(t);
  return !goals || Number(goals[1]) % 100 === 0;
}

export function careerChapters(s: LegendSource): Chapter[] {
  const out: Chapter[] = [];
  for (const r of s.career) {
    const last = out.at(-1);
    if (last && last.club === r.club) {
      last.to = r.year;
      last.ageTo = r.age;
      last.seasons++;
      if (!last.leagues.includes(r.league)) last.leagues.push(r.league);
      last.apps += r.apps;
      last.goals += r.goals;
      last.assists += r.assists;
      last.cs += r.cs || 0;
    } else {
      out.push({
        club: r.club,
        leagues: [r.league],
        from: r.year,
        to: r.year,
        ageFrom: r.age,
        ageTo: r.age,
        seasons: 1,
        apps: r.apps,
        goals: r.goals,
        assists: r.assists,
        cs: r.cs || 0,
        events: [],
      });
    }
  }
  const inYear = (y: number) => out.find((c) => c.from <= y && y <= c.to);
  for (const t of s.trophies) {
    const c = out.find((c) => c.club === t.club && c.from <= t.year && t.year <= c.to);
    const same = c?.events.find((e) => e.kind === 'trophy' && e.text === t.t);
    if (same) same.years.push(t.year);
    else c?.events.push({ year: t.year, kind: 'trophy', text: t.t, years: [t.year] });
  }
  for (const m of s.miles ?? []) {
    if (NATIONAL_MILE.test(m.t) || !isKeyMilestone(m.t)) continue;
    inYear(m.year)?.events.push({ year: m.year, kind: 'mile', text: m.t, years: [m.year] });
  }
  for (const st of s.storyLog ?? []) {
    inYear(st.year)?.events.push({
      year: st.year,
      kind: 'story',
      text: `${st.name} — ${st.ending}`,
      years: [st.year],
    });
  }
  const rank = { mile: 0, story: 1, trophy: 2 } as const;
  for (const c of out) c.events.sort((a, b) => a.year - b.year || rank[a.kind] - rank[b.kind]);
  return out;
}

/** 대표팀 장면: 대표팀 대회 우승과 대표팀 이정표. */
export function nationalEvents(s: LegendSource): ChapterEvent[] {
  return [
    ...(s.miles ?? [])
      .filter((m) => NATIONAL_MILE.test(m.t) && !/데뷔골|본선 득점/.test(m.t))
      .map((m) => ({ year: m.year, kind: 'mile' as const, text: m.t, years: [m.year] })),
    ...s.trophies
      .filter((t) => t.club === NATIONAL_TEAM)
      .map((t) => ({ year: t.year, kind: 'trophy' as const, text: t.t, years: [t.year] })),
  ].sort((a, b) => a.year - b.year);
}

export interface HonourLine {
  name: string;
  years: number[];
}
/** 엔딩 크레딧의 우승·수상 목록 — 같은 이름끼리 묶어 많이 든 순(같으면 먼저 든 순). */
export function honoursRoll(items: { year: number; t: string }[]): HonourLine[] {
  const by = new Map<string, number[]>();
  for (const it of items) {
    const ys = by.get(it.t);
    if (ys) ys.push(it.year);
    else by.set(it.t, [it.year]);
  }
  return [...by]
    .map(([name, years]) => ({ name, years: years.sort((a, b) => a - b) }))
    .sort((a, b) => b.years.length - a.years.length || a.years[0]! - b.years[0]!);
}
