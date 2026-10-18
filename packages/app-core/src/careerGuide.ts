// Display-only: derive guide entries from the existing game definitions, never change a career.
import {
  ATTR_KEYS,
  FOCUS_PICK,
  TYPES,
  focusOfType,
  typeForFocus,
  attrLabels,
  type AttrKey,
  type Pos,
} from '@offside/game/data';
import {
  DUOS,
  TEAM_NAME_MIN,
  TEAM_NAME_MAX,
  MANAGER_NAME_MIN,
  MANAGER_NAME_MAX,
} from '@offside/contracts/owner-team';
import { BASE_DETAIL, SELECTABLE_DETAIL_POSITIONS } from '@offside/contracts/positions';
import { teamSynergyText as TS } from './i18n/ko/teamSynergy.js';
import { careerGuideText as CG } from './i18n/ko/careerGuide.js';
import { teamHomeText as T } from './i18n/ko/teamHome.js';
/** 주력 능력치로 고를 수 있는 모든 조합(6개 중 FOCUS_PICK개, ATTR_KEYS 순서). */
function focusPairs(): AttrKey[][] {
  const out: AttrKey[][] = [];
  const walk = (from: number, acc: AttrKey[]) => {
    if (acc.length === FOCUS_PICK) return void out.push(acc);
    for (let i = from; i < ATTR_KEYS.length; i++) walk(i + 1, [...acc, ATTR_KEYS[i]!]);
  };
  walk(0, []);
  return out;
}

/**
 * T-11-355 선수 유형 도감. 유형마다 ①추천 주력 ②그 유형이 되는 주력 조합 전부(선수 생성과 같은 typeForFocus)
 * ③그 유형이 들어가는 듀오 시너지와 배치 자리(contracts DUOS)를 게임 정의에서 바로 만든다 — 숫자를 옮겨 적지 않는다.
 */
export function positionGuide(pos: Pos) {
  const labels = attrLabels(pos);
  const join = (ks: readonly AttrKey[]) => ks.map((k) => labels[k]).join(' · ');
  const pairs = focusPairs();
  return TYPES[pos].map((t) => ({
    id: t.id,
    name: t.name,
    desc: t.desc,
    focus: join(focusOfType(pos, t.id)),
    combos: pairs.filter((f) => typeForFocus(pos, f) === t.id).map(join),
    synergies: DUOS.flatMap((d) =>
      d.needs
        .filter((n) => n.types.includes(t.id))
        .map((n) => ({
          id: d.id,
          name: TS.synName({ id: d.id, ko: d.name }),
          slots: SELECTABLE_DETAIL_POSITIONS.filter((p) => n.slots.includes(BASE_DETAIL[p])).join(
            '·',
          ),
        })),
    ),
  }));
}

export function teamNameIssues(name: string, manager: string) {
  const issue = (value: string, field: string, min: number, max: number) =>
    value.trim().length < min || value.trim().length > max ? CG.nameRule({ field, min, max }) : '';
  return {
    name: issue(name, T.teamNameLabel, TEAM_NAME_MIN, TEAM_NAME_MAX),
    manager: issue(manager, T.managerNameLabel, MANAGER_NAME_MIN, MANAGER_NAME_MAX),
  };
}
