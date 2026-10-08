// ───────── 은퇴 리포트: 클럽별 챕터 타임라인 · 우승 연혁 (T-10-062) ─────────
// 순수 함수만 있다 — 이미 기록된 시즌·우승·수상·이정표만 읽고 RNG를 전혀 쓰지 않는다.
import { isNationalTeam } from './nation.js';
import { sameClub, type ClubRef } from './data.js';
import type { LegendSource } from './types.js';
import { gRecordsText as L } from './i18n/ko/gRecords.js';
import { tn } from './i18n/names.js';

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
  /** T-10-066. 클럽 id(옛 기록엔 없다). 둘 다 id가 있으면 구단명이 바뀌어도 같은 챕터다. */
  clubId?: string | undefined;
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

// 대표팀 쪽 이정표는 대표팀 장면으로 따로 모은다. 이정표 문구는 comps.ts checkMilestones가 만든다.
const NATIONAL_MILE = /A매치|대표팀|월드컵|센추리/;
const MINOR_MILE = /데뷔골|경기 출전|후보|입성|본선 득점|컨퍼런스리그|엘리트/;
/** 챕터에 남길 이정표 — 데뷔골·N경기 출전·후보 선정 같은 자잘한 것은 뺀다. 통산 골은 100골 단위만. */
export function isKeyMilestone(t: string): boolean {
  if (MINOR_MILE.test(t)) return false;
  const goals = /통산 (\d+)골/.exec(t);
  return !goals || Number(goals[1]) % 100 === 0;
}

/** 거쳐 간 구단을 처음 뛴 순서대로 한 번씩(같은 구단으로 돌아와도 한 번, 현역 복무 시즌은 빼고).
 * 은퇴 리포트·공유 이미지의 엠블럼 줄. */
export function careerClubs(s: LegendSource): ClubRef[] {
  const out: ClubRef[] = [];
  for (const r of s.career) {
    if (r.mil) continue;
    const seen = out.find((o) => sameClub(o, r));
    if (seen) seen.clubId ??= r.clubId;
    else out.push({ club: r.club, clubId: r.clubId });
  }
  return out;
}

export function careerChapters(s: LegendSource): Chapter[] {
  const out: Chapter[] = [];
  for (const r of s.career) {
    const last = out.at(-1);
    if (last && sameClub(last, r)) {
      // 옛 기록(id 없음) 뒤에 id가 있는 시즌이 이어지면 챕터 엠블럼도 id로 찾게 한다.
      last.clubId ??= r.clubId;
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
        clubId: r.clubId,
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
  // 화면에 그리는 text는 지금 언어로 옮기고(tn), 같은 우승을 묶는 판정은 저장된 이름으로 한다.
  const trophyKey = new WeakMap<ChapterEvent, string>();
  for (const t of s.trophies) {
    const c = out.find((c) => sameClub(c, t) && c.from <= t.year && t.year <= c.to);
    const same = c?.events.find((e) => e.kind === 'trophy' && trophyKey.get(e) === t.t);
    if (same) same.years.push(t.year);
    else if (c) {
      const e: ChapterEvent = { year: t.year, kind: 'trophy', text: tn(t.t), years: [t.year] };
      trophyKey.set(e, t.t);
      c.events.push(e);
    }
  }
  for (const m of s.miles ?? []) {
    if (NATIONAL_MILE.test(m.t) || !isKeyMilestone(m.t)) continue;
    inYear(m.year)?.events.push({ year: m.year, kind: 'mile', text: tn(m.t), years: [m.year] });
  }
  for (const st of s.storyLog ?? []) {
    inYear(st.year)?.events.push({
      year: st.year,
      kind: 'story',
      text: L.storyEnding({ name: tn(st.name), ending: tn(st.ending) }),
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
      .map((m) => ({ year: m.year, kind: 'mile' as const, text: tn(m.t), years: [m.year] })),
    ...s.trophies
      .filter((t) => isNationalTeam(t.club))
      .map((t) => ({ year: t.year, kind: 'trophy' as const, text: tn(t.t), years: [t.year] })),
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
