// T-11-722 랭크 연패 안내 — 내가 건 랭크 경기를 연달아 지면 결과 화면에 한 번 알려 준다(웹 · 앱 공통, 표시만).
// 연패 동안 가장 밀린 줄을 말한다. T-11-727 기대 득점이 앞선 연패에는 고칠 곳이 없어 띄우지 않는다('골이 따라오지
// 않았다'는 안내가 지고 있는 사람에게 놀리는 말로 읽혔다). 서버를 부르지 않고 경기 응답에
// 든 기대 득점 · 줄 힘을 이 기기에 모아 판단한다(rankQueue의 다른 상대 찾기 횟수와 같은 방식).
import type { TeamMatch } from './api/team.js';
import { kstDay } from '@offside/contracts/kst';
import {
  REPORT_LINES,
  lineEdges,
  weakestLine,
  type ReportLine,
} from '@offside/contracts/owner-team';
import { matchReportText as L } from './i18n/ko/matchReport.js';

/** 이만큼 연달아 지면 알린다. */
export const STREAK_HINT_MIN = 3;
/** 평균을 내는 최근 패배 수. */
const STREAK_KEEP = 5;

type Loss = { id: string; xf: number; xa: number; e: [number, number, number] };
type StreakLog = { n: number; losses: Loss[]; shown?: { day: string; id: string } };

export type StreakHint = {
  /** 연패 수. */
  n: number;
  /** 밀린 줄이 있다(T-11-727 'luck'은 없앴다). 화면의 표시 이름으로 쓴다. */
  kind: 'weak';
  title: string;
  body: string;
  /** 고칠 곳으로 갈 줄. */
  line: ReportLine;
};

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function parse(raw: string | null | undefined): StreakLog {
  try {
    const v = JSON.parse(raw ?? '') as Partial<StreakLog>;
    const losses = (Array.isArray(v.losses) ? v.losses : []).filter(
      (x): x is Loss =>
        !!x &&
        typeof x.id === 'string' &&
        num(x.xf) &&
        num(x.xa) &&
        Array.isArray(x.e) &&
        x.e.length === 3 &&
        x.e.every(num),
    );
    const shown =
      v.shown && typeof v.shown.day === 'string' && typeof v.shown.id === 'string'
        ? v.shown
        : undefined;
    return {
      n: Number.isInteger(v.n) && v.n! >= losses.length ? v.n! : losses.length,
      losses,
      ...(shown ? { shown } : {}),
    };
  } catch {
    return { n: 0, losses: [] };
  }
}

const gap = (x: number) => String(Math.max(1, Math.round(Math.abs(x))));

function hintOf(log: StreakLog): StreakHint | null {
  const k = log.losses.length;
  const xf = log.losses.reduce((t, x) => t + x.xf, 0);
  const xa = log.losses.reduce((t, x) => t + x.xa, 0);
  const avg = (i: number) => log.losses.reduce((t, x) => t + x.e[i]!, 0) / k;
  const edges = { atk: avg(0), mid: avg(1), def: avg(2) };
  const weak = weakestLine(edges);
  // T-11-727 기대 득점이 앞섰으면 고칠 곳이 없다. 연패 기록은 그대로 두고 다음 패배에서 다시 잰다.
  if (xf > xa || !weak) return null;
  const p = { k, n: gap(edges[weak]) };
  return {
    n: log.n,
    kind: 'weak',
    title: L.streakTitle({ n: log.n }),
    body: weak === 'atk' ? L.streakAtk(p) : weak === 'mid' ? L.streakMid(p) : L.streakDef(p),
    line: weak,
  };
}

/**
 * 마감한 경기 한 판을 연패 기록에 더하고, 이 결과 화면에 보일 안내를 정한다. 내가 건 랭크 경기만 센다(친선전 · 받은 경기는
 * 기록을 건드리지 않는다). 이기거나 비기면 연패가 끊긴다. 안내는 하루(한국 시각)에 한 경기에서만 보이고, 같은 경기를 다시
 * 넣으면 같은 답을 준다. raw가 null이면 저장할 것이 없다.
 */
export function streakStep(
  raw: string | null | undefined,
  m: TeamMatch,
  now = new Date(),
): { raw: string | null; hint: StreakHint | null } {
  if (m.friendly || m.mine !== 'home') return { raw: null, hint: null };
  const me = m.home;
  const opp = m.away;
  let log = parse(raw);
  if (log.losses.at(-1)?.id !== m.id) {
    const lost = me.goals < opp.goals;
    if (!lost || me.xg === undefined || opp.xg === undefined || !me.lines || !opp.lines) {
      log = { n: 0, losses: [], ...(log.shown ? { shown: log.shown } : {}) };
    } else {
      const e = lineEdges(me.lines, opp.lines);
      const loss: Loss = {
        id: m.id,
        xf: me.xg,
        xa: opp.xg,
        e: REPORT_LINES.map((l) => Math.round(e[l] * 10) / 10) as Loss['e'],
      };
      log = { ...log, n: log.n + 1, losses: [...log.losses, loss].slice(-STREAK_KEEP) };
    }
  }
  const day = kstDay(now.toISOString());
  const due =
    log.n >= STREAK_HINT_MIN &&
    log.losses.at(-1)?.id === m.id &&
    (!log.shown || log.shown.day !== day || log.shown.id === m.id);
  const hint = due ? hintOf(log) : null;
  if (hint) log = { ...log, shown: { day, id: m.id } };
  return { raw: JSON.stringify(log), hint };
}
