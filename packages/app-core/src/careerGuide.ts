// Display-only: derive guide entries from the existing game definitions, never change a career.
import { TYPES, focusOfType, attrLabels, type Pos } from '@offside/game/data';
import {
  TEAM_NAME_MIN,
  TEAM_NAME_MAX,
  MANAGER_NAME_MIN,
  MANAGER_NAME_MAX,
} from '@offside/contracts/owner-team';
import { careerGuideText as CG } from './i18n/ko/careerGuide.js';
import { teamHomeText as T } from './i18n/ko/teamHome.js';
export function positionGuide(pos: Pos) {
  const labels = attrLabels(pos);
  return TYPES[pos].map((t) => ({
    id: t.id,
    name: t.name,
    desc: t.desc,
    focus: focusOfType(pos, t.id)
      .map((k) => labels[k])
      .join(' · '),
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
