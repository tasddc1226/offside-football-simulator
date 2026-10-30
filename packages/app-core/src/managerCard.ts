// T-11-310 감독 카드 표시(이름 · 감독 칸 효과). 팀 화면도 쓰므로 감독 엔진을 끌어오지 않는 작은 모듈로 둔다.
import {
  MANAGER_LINE_MAX,
  MANAGER_LINE_MIN,
  managerBreakdown,
  managerLines,
  type ManagerCardRules,
  type ManagerPart,
} from '@offside/contracts/manager-rules';
import { gManagerText as G } from '@offside/game/i18n/ko/gManager';
import {
  synergyApplies,
  type FormationId,
  type PosGroup,
  type SynergyLines,
  type TeamSynergy,
} from '@offside/contracts/owner-team';
import { playerName } from './format.js';
import { managerText as M } from './i18n/ko/manager.js';

/** 카드 이름(이 기기에 있는 선수 이름 → 공개 이름 → 포지션 · 등번호). */
export const managerName = (
  c: { careerId: string; publicName: string | null; number: number | null; pos: PosGroup },
  local: ReadonlyMap<string, string>,
) => playerName(local.get(c.careerId) ?? c.publicName, c.pos, c.number);

const sign = (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v < 0 ? `−${(-v).toFixed(1)}` : '0');

/** 감독 칸 효과(시너지 없이 숙련 · 성향만). 0인 줄은 뺀다. */
export function coachEffectText(card: ManagerCardRules, formation: FormationId): string {
  const l = managerLines(card, formation, []);
  const parts = [
    [M.lineAtk, l.atk],
    [M.lineMid, l.mid],
    [M.lineDef, l.def],
  ] as const;
  const shown = parts.filter(([, v]) => Math.abs(v) >= 0.05);
  return shown.length ? shown.map(([k, v]) => `${k} ${sign(v)}`).join(' · ') : '–';
}

/**
 * T-11-323 팀 화면 줄 힘에 더할 감독 보정. 경기 계산(api team/sim.ts withCoach)과 같게 숙련 · 성향에 더해, 시너지 반영
 * 시즌이면 켜진 시너지(배지 빼고)와 짝이 맞는 특기도 넣는다. 감독 칸이 비면 0이다.
 */
export function coachLineBonus(
  card: ManagerCardRules | null | undefined,
  formation: FormationId,
  synergy: TeamSynergy | null,
  season: number,
): SynergyLines {
  return managerLines(card, formation, coachSynergyIds(synergy, season));
}

const coachSynergyIds = (synergy: TeamSynergy | null, season: number) =>
  synergy && synergyApplies(season)
    ? synergy.active.filter((a) => a.kind !== 'badge').map((a) => a.id)
    : [];

const partName = (p: ManagerPart) =>
  p.src === 'mastery'
    ? M.mastery({ grade: p.grade })
    : p.src === 'style'
      ? M.partStyle({ name: G[`style_${p.style}`] })
      : G[`special_${p.special}`];

/** 줄 하나의 감독 보정 내역. capped면 합이 상한 · 하한을 넘어 잘렸다. */
export type CoachBreakdownRow = {
  line: 'atk' | 'mid' | 'def';
  label: string;
  total: string;
  /** 갈래별 값(0인 갈래는 뺀다). 예: 숙련 S +1.0 · 공격 성향 +1.0 */
  parts: string;
  /** 잘렸으면 합과 상한 안내, 아니면 null. */
  capped: string | null;
};

/**
 * T-11-382 팀 화면 감독 칸의 보정 내역. 줄 칸 태그(coachLineBonus)와 같은 값을 갈래별로 풀고, 줄마다 상한(+3.0) · 하한(−1.5)에
 * 걸려 잘린 몫과 짝 시너지가 꺼져 더하지 않은 특기를 알린다. 감독 칸이 비면 null.
 */
export function coachBreakdown(
  card: ManagerCardRules | null | undefined,
  formation: FormationId,
  synergy: TeamSynergy | null,
  season: number,
): { rows: CoachBreakdownRow[]; off: string[] } | null {
  if (!card) return null;
  const b = managerBreakdown(card, formation, coachSynergyIds(synergy, season));
  const on = b.parts.filter((p) => p.src !== 'special' || p.on);
  const rows: CoachBreakdownRow[] = [];
  for (const [line, label] of [
    ['atk', M.lineAtk],
    ['mid', M.lineMid],
    ['def', M.lineDef],
  ] as const) {
    const parts = on.filter((p) => Math.abs(p.lines[line]) >= 0.05);
    if (!parts.length && Math.abs(b.total[line]) < 0.05) continue;
    const raw = b.raw[line];
    const total = b.total[line];
    rows.push({
      line,
      label,
      total: sign(total),
      parts: parts.map((p) => `${partName(p)} ${sign(p.lines[line])}`).join(' · '),
      capped:
        Math.abs(raw - total) < 0.005
          ? null
          : raw > total
            ? M.breakdownCapped({ raw: sign(raw), max: sign(MANAGER_LINE_MAX) })
            : M.breakdownFloor({ raw: sign(raw), min: sign(MANAGER_LINE_MIN) }),
    });
  }
  const off = b.parts.flatMap((p) => (p.src === 'special' && !p.on ? [partName(p)] : []));
  return { rows, off };
}

/** 줄 칸에 붙일 감독 보정 표기(+1.0 · −0.5). 0에 가까우면 null. */
export const coachLineTag = (v: number): string | null => (Math.abs(v) >= 0.05 ? sign(v) : null);

/** 팀 화면 감독 칸 한 줄: 이름 · 등급 · 지금 포메이션 효과. */
export const coachSummary = (
  c: ManagerCardRules & {
    careerId: string;
    publicName: string | null;
    number: number | null;
    pos: PosGroup;
    grade: string;
  },
  formation: FormationId,
  local: ReadonlyMap<string, string>,
) => `${managerName(c, local)} · ${M.grade({ grade: c.grade })} · ${coachEffectText(c, formation)}`;
