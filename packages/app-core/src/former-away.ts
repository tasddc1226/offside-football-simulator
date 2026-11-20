import { clubById, clubByName } from '@offside/game/clubs';
import { formerAwayMilestone } from '@offside/game/i18n/ko/gTurn';
import { CLUBS, LAST_PHASE } from '@offside/game/data';
import { blockMatches, leagueOf } from '@offside/game/engine';
import { tn } from '@offside/game/i18n/names';
import type { BlockResult } from '@offside/game/match';
import type {
  AfterPhase,
  CareerRecord,
  GameState,
  Pending,
  ReturnReply,
} from '@offside/game/types';
import { careerMomentText as L } from './i18n/ko/careerMoment';
import { gameText } from './i18n/ko/game';
import { gameActionsText } from './i18n/ko/gameActions';
import type { SheetController } from './sheet-controller';

type Visit = { clubId: string; rd: number; seasons: number; apps: number };
type ReturnScene = Extract<Pending, { type: 'formerAway' }>;
const idOf = (r: CareerRecord) => r.clubId ?? clubByName(r.club)?.id;
const nameOf = (id: string) => tn(clubById(id)?.name ?? id);

export function formerAwayFixture(s: GameState): Visit | null {
  const last = s.career[s.career.length - 1];
  const opp = s.season.opp;
  if (!last || last.year !== s.year - 1 || !opp?.length || s.phase < 1 || s.phase > LAST_PHASE)
    return null;
  const clubId = idOf(last);
  if (!clubId || clubId === s.club.id) return null;
  const i = opp.indexOf(clubId);
  // The existing schedule repeats the same opponent list. The return leg is the second meeting.
  const rd = opp.length + i + 1;
  const end = Math.min(s.season.played + blockMatches(s), leagueOf(s.leagueId).matches);
  if (i < 0 || rd <= s.season.played || rd > end) return null;
  const years = s.career.filter((r) => idOf(r) === clubId);
  return { clubId, rd, seasons: years.length, apps: years.reduce((total, r) => total + r.apps, 0) };
}

export function askFormerAway(sheet: SheetController, visit: Visit): Promise<ReturnReply | null> {
  return new Promise((resolve) => {
    const replies: ReturnReply[] = ['respect', 'fans', 'later'];
    sheet.showSheet(
      {
        kind: 'notice',
        eyebrow: gameText.formerAway,
        title: L.visitIntro({
          club: nameOf(visit.clubId),
          seasons: visit.seasons,
          apps: visit.apps,
        }),
        text: L.visitQuestion({ rd: visit.rd }),
      },
      replies.map((reply) => ({ label: L[reply], fn: () => resolve(reply) })),
      () => resolve(null),
    );
  });
}

export function afterFormerAway(
  visit: Visit,
  reply: ReturnReply,
  block: BlockResult | null,
  next: AfterPhase | null,
): Pending | null {
  const game = block?.games.find((g) => g.rd === visit.rd && g.opp === visit.clubId);
  if (!game) return next;
  const result = game.g ? 'goal' : game.a ? 'assist' : game.mins ? 'played' : 'bench';
  return { type: 'formerAway', clubId: visit.clubId, rd: visit.rd, reply, result, next };
}

export function showFormerAway(
  sheet: SheetController,
  s: GameState,
  p: ReturnScene,
  save: () => void,
  close: () => void,
) {
  const club = nameOf(p.clubId);
  const intro = L.visitRecall({ rd: p.rd, reply: L[p.reply] });
  function finish(ending: Parameters<typeof formerAwayMilestone>[1]) {
    if (s.pending !== p) return;
    const base =
      CLUBS.find((c) => c.id === p.clubId)?.baseName ?? clubById(p.clubId)?.name ?? p.clubId;
    s.miles = [...(s.miles ?? []), { year: s.year, t: formerAwayMilestone(base, ending) }];
    s.pending = p.next;
    save();
    close();
  }
  const result = p.result;
  const scene = {
    goal: L.visitGoal,
    assist: L.visitAssist,
    played: L.visitPlayed,
    bench: L.visitBench,
  };
  sheet.showSheet(
    { kind: 'notice', eyebrow: gameText.formerAway, title: scene[result]({ club }), text: intro },
    result === 'goal'
      ? [
          { label: L.hands, fn: () => finish('hands') },
          { label: L.run, fn: () => finish('run') },
        ]
      : [{ label: gameActionsText.ok, fn: () => finish(result) }],
  );
}
