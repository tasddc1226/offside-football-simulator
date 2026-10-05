import type { Translation } from '@offside/contracts/i18n';
import type { GTurnMsgs } from '../ko/gTurn';
import { plural } from './_gUtil';

export const gTurn: Translation<GTurnMsgs> = {
  blockLine: (p) =>
    `${p.phase}: ${p.n} ${plural(p.n, 'match', 'matches')} · ${p.w}W ${p.d}D ${p.l}L · ${p.apps} ${plural(p.apps, 'appearance', 'appearances')} · ${p.goals} ${plural(p.goals, 'goal', 'goals')}, ${p.assists} ${plural(p.assists, 'assist', 'assists')}`,
  roundRange: (p) => `R${p.a}–${p.b}`,
  hlHat: (p) => `R${p.rd}: Hat-trick! ${p.g} goals (rating ${p.rating})`,
  hlMulti: (p) => `R${p.rd}: A brace (rating ${p.rating})`,
  hlMom: (p) => `R${p.rd}: Man of the match (rating ${p.rating})`,
  hlSave: (p) => `R${p.rd}: A superb goalkeeping show, clean sheet (rating ${p.rating})`,
  hlInjury: (p) =>
    `R${p.rd}: Subbed off with ${p.big ? 'a serious injury' : 'an injury'}… expected to miss ${p.n} ${plural(p.n, 'match', 'matches')}`,
  gameStart: (p) =>
    `${p.name}, a Year 3 ${p.pos.toLowerCase()} at ${p.club}${p.nation ? ` who came from ${p.nation} to study football` : ''}, starts a football career wearing number ${p.number}.`,
  balancePatch: (p) => `Balance patch v${p.v} applies from this season.`,
  storyEnd: (p) => `[Story over] ${p.name} · ${p.ending}`,
  placeholderTeam: (p) => `${p.league} club ${p.n}`,
};
