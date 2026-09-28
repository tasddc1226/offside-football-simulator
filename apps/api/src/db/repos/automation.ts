import type {
  AutomationReason,
  AutomationReport,
  AutomationSuspect,
  PlaySignals,
} from '@offside/contracts';
import { eq, gte } from 'drizzle-orm';
import type { Db } from '../client.js';
import { careers, careerSeasons } from '../schema.js';

// 자동 플레이 탐지(관찰 전용). 최근 N시간 동안 올라온 시즌을 프로필·커리어별로 모아 사람답지 않은 흐름에 점수를
// 매긴다. 게임에는 아무 영향이 없다 — 운영 도구가 보고 판단한다. 근거는 두 갈래:
// - 기기 조작 요약(PlaySignals, 시즌 업로드에 실려 온다): 자동화 브라우저, 스크립트 클릭, 입력 없는 진행, 커서 이동 없는 클릭.
// - 서버가 이미 가진 흐름: 시즌 간격의 일정함, 번호만 바꾼 연속 커리어, 쉬지 않는 업로드, 이름.
// 사람도 같은 속도로 누르면 간격이 꽤 일정하다(실측 변동계수 0.14–0.6) — 간격만으로는 약한 근거로 둔다.

const WEIGHT: Record<AutomationReason, number> = {
  webdriver: 3,
  headless: 3,
  synthetic: 3,
  noInput: 3,
  noMoves: 2,
  metronome: 2,
  steady: 1,
  serial: 2,
  nonstop: 2,
  aiName: 1,
};
const HIGH = 4;
const MEDIUM = 2;
/** 이보다 긴 간격은 쉬는 시간이라 일정함 계산에서 뺀다. */
const BREAK_MS = 10 * 60_000;
/** 일정함을 따질 최소 간격 수. */
const MIN_GAPS = 8;
/** 한 번에 읽는 시즌 수 상한(24시간 ≈ 5만 행). */
const MAX_ROWS = 60_000;

const AI_NAME =
  /gemini|제미나이|재미나이|claude|클로드|gpt|지피티|codex|코덱스|deepseek|딥시크|grok|그록|copilot|코파일럿|llama|agent|에이전트|\bbot\b|봇$/i;
const HEADLESS_UA = /headless|phantomjs|puppeteer|playwright|selenium/i;

/** User-Agent가 헤드리스·자동화 브라우저. */
export const isHeadless = (ua: string | undefined) => !!ua && HEADLESS_UA.test(ua);

export type SeasonRow = {
  careerId: string;
  profileId: string;
  name: string | null;
  status: 'active' | 'retired';
  createdAt: string;
  signalsJson: string | null;
};
type Signals = PlaySignals & { headless?: boolean };

function parseSignals(json: string | null): Signals | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Signals;
  } catch {
    return null;
  }
}

/** 쉬는 시간을 뺀 간격의 중앙값(초)과 변동계수. */
function rhythm(gapsMs: number[]): { medianGapSec: number | null; cv: number | null } {
  const g = gapsMs.filter((x) => x > 0 && x <= BREAK_MS).sort((a, b) => a - b);
  if (!g.length) return { medianGapSec: null, cv: null };
  const medianGapSec = Math.round(g[g.length >> 1]! / 100) / 10;
  if (g.length < MIN_GAPS) return { medianGapSec, cv: null };
  const mean = g.reduce((s, x) => s + x, 0) / g.length;
  const sd = Math.sqrt(g.reduce((s, x) => s + (x - mean) ** 2, 0) / g.length);
  return { medianGapSec, cv: Math.round((sd / mean) * 100) / 100 };
}

function judgeCareer(rows: SeasonRow[]) {
  const sorted = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const sigs = sorted.map((r) => parseSignals(r.signalsJson));
  const measured = sigs.filter((s): s is Signals => !!s);
  // 기기가 잰 시즌 시간이 절반 넘게 있으면 그것을, 아니면 서버 도착 간격을 쓴다(밀린 업로드는 간격이 0에 가깝다).
  const gaps =
    measured.length * 2 > sorted.length
      ? measured.map((s) => s.ms - s.hiddenMs)
      : sorted.slice(1).map((r, i) => Date.parse(r.createdAt) - Date.parse(sorted[i]!.createdAt));
  const { medianGapSec, cv } = rhythm(gaps);

  const reasons = new Set<AutomationReason>();
  const sum = (k: 'clicks' | 'touches' | 'moves' | 'synthetic') =>
    measured.reduce((s, x) => s + x[k], 0);
  if (measured.some((s) => s.webdriver)) reasons.add('webdriver');
  if (measured.some((s) => s.headless)) reasons.add('headless');
  const clicks = sum('clicks');
  const touches = sum('touches');
  const moves = sum('moves');
  const synthetic = sum('synthetic');
  if (synthetic >= 5 && synthetic > clicks) reasons.add('synthetic');
  if (measured.filter((s) => s.clicks + s.keys + s.touches === 0).length >= 2)
    reasons.add('noInput');
  if (touches === 0 && clicks >= 20 && moves < clicks * 2) reasons.add('noMoves');
  if (cv !== null && cv < 0.08) reasons.add('metronome');
  else if (cv !== null && cv < 0.12) reasons.add('steady');
  const name = sorted.at(-1)!.name;
  if (name && AI_NAME.test(name)) reasons.add('aiName');
  return {
    careerId: sorted[0]!.careerId,
    name,
    status: sorted.at(-1)!.status,
    seasons: sorted.length,
    medianGapSec,
    cv,
    reasons: [...reasons],
  };
}

/** 이름에서 끝의 번호(#4, 2, (3))를 뗀 줄기. */
const stem = (name: string) =>
  name
    .replace(/[\s#_\-.(]*\d+\)?$/, '')
    .trim()
    .toLowerCase();

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const x of xs) {
    const list = out.get(key(x));
    if (list) list.push(x);
    else out.set(key(x), [x]);
  }
  return out;
}

/** 시즌 행들을 프로필별로 판정한다. 점수가 MEDIUM 미만인 프로필은 뺀다(점수순). */
export function judgeAutomation(rows: SeasonRow[], hours: number): AutomationSuspect[] {
  const out: AutomationSuspect[] = [];
  for (const [profileId, all] of groupBy(rows, (r) => r.profileId)) {
    const judged = [...groupBy(all, (r) => r.careerId).values()].map(judgeCareer);
    const reasons = new Set(judged.flatMap((c) => c.reasons));
    // 번호만 다른 이름으로 커리어 3개 이상.
    const stems = new Map<string, Set<string>>();
    for (const c of judged) {
      const s = c.name && stem(c.name);
      if (!s || s === c.name!.toLowerCase()) continue;
      stems.set(s, (stems.get(s) ?? new Set()).add(c.name!));
    }
    if ([...stems.values()].some((names) => names.size >= 3)) reasons.add('serial');
    const activeHours = new Set(all.map((r) => r.createdAt.slice(0, 13))).size;
    if (hours >= 10 && activeHours >= 10) reasons.add('nonstop');

    const score = [...reasons].reduce((s, r) => s + WEIGHT[r], 0);
    if (score < MEDIUM) continue;
    const times = all.map((r) => r.createdAt);
    out.push({
      profile: profileId.slice(0, 8),
      score,
      level: score >= HIGH ? 'high' : 'medium',
      reasons: [...reasons].sort((a, b) => WEIGHT[b] - WEIGHT[a]),
      seasons: all.length,
      activeHours,
      firstAt: times.reduce((a, b) => (b < a ? b : a)),
      lastAt: times.reduce((a, b) => (b > a ? b : a)),
      careers: judged.sort((a, b) => b.reasons.length - a.reasons.length || b.seasons - a.seasons),
    });
  }
  return out.sort((a, b) => b.score - a.score || b.seasons - a.seasons);
}

/** `GET /v1/admin/automation`. 최근 hours시간에 올라온 시즌(시각 인덱스)만 읽는다. */
export async function automationReport(
  db: Db,
  now: Date,
  hours: number,
): Promise<AutomationReport> {
  const since = new Date(now.getTime() - hours * 3_600_000).toISOString();
  const rows = await db
    .select({
      careerId: careerSeasons.careerId,
      profileId: careers.profileId,
      name: careers.publicName,
      status: careers.status,
      createdAt: careerSeasons.createdAt,
      signalsJson: careerSeasons.signalsJson,
    })
    .from(careerSeasons)
    .innerJoin(careers, eq(careers.id, careerSeasons.careerId))
    .where(gte(careerSeasons.createdAt, since))
    .limit(MAX_ROWS);
  return {
    generatedAt: now.toISOString(),
    hours,
    profiles: new Set(rows.map((r) => r.profileId)).size,
    suspects: judgeAutomation(rows, hours),
  };
}
