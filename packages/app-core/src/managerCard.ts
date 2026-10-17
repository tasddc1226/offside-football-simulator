// T-11-310 감독 카드 표시(이름 · 감독 칸 효과). 팀 화면도 쓰므로 감독 엔진을 끌어오지 않는 작은 모듈로 둔다.
import { managerLines, type ManagerCardRules } from '@offside/contracts/manager-rules';
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
  const ids =
    synergy && synergyApplies(season)
      ? synergy.active.filter((a) => a.kind !== 'badge').map((a) => a.id)
      : [];
  return managerLines(card, formation, ids);
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
