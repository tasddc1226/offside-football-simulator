import type { Translation } from '../core';
import { ordinal } from './_util';
import type { LeagueNewsMsgs } from '../ko/leagueNews';

const pick = (v: number, list: string[]) => list[Math.abs(v) % list.length]!;

export const leagueNews: Translation<LeagueNewsMsgs> = {
  title: 'OFFSIDE Daily',
  edition: (p) => `Round ${p.round} news`,
  firstSoon: 'The first paper comes out after round 1.',
  loadFail: "We couldn't load the paper.",
  quiet: 'No big stories this round.',
  where: (p) => `Tier ${p.tier}, League ${p.league} · Round ${p.round}`,
  tagUpset: 'Upset',
  tagGoalfest: 'Goal fest',
  tagDerby: 'Derby',
  tagTeamOfRound: 'Team of the round',
  tagLeader: 'Leader',
  tagStreak: 'Streak',
  tagComeback: 'Comeback',
  tagLateWinner: 'Late winner',
  tagHattrick: 'Hat-trick',
  tagFirstWin: 'First win',
  tagBig: 'Big match',
  upsetHead: (p) =>
    pick(p.v, [
      `${p.winner} overturn a ${p.gap}-point OVR gap`,
      `Giant-killers ${p.winner} down ${p.loser}`,
      `Shock result as ${p.loser} fall to ${p.winner}`,
      `${p.winner} defy the odds`,
    ]),
  upsetBody: (p) =>
    pick(p.v, [
      `${p.winner} beat ${p.loser} ${p.score}. Before kickoff, ${p.loser} were ${p.gap} OVR higher.`,
      `A ${p.gap}-point OVR deficit proved meaningless as ${p.winner} won ${p.score} against ${p.loser}.`,
      `Few saw this coming. ${p.loser} were left stunned as ${p.winner} took all three points with a ${p.score} win.`,
    ]),
  goalfestHead: (p) =>
    pick(p.v, [
      `${p.home} v ${p.away}: a ${p.goals}-goal thriller`,
      `Goals galore as ${p.home} and ${p.away} share ${p.goals}`,
      `Defences take the day off in ${p.goals}-goal epic`,
    ]),
  goalfestBody: (p) =>
    pick(p.v, [
      `${p.goals} goals flew in between ${p.home} and ${p.away}. It finished ${p.score}.`,
      `The forwards never stopped. ${p.goals} goals in 90 minutes ended ${p.score}.`,
      `Not a quiet moment in the stands: ${p.home} and ${p.away} traded ${p.goals} goals, finishing ${p.score}.`,
    ]),
  derbyHead: (p) => {
    const hi = Math.min(p.homeRank, p.awayRank);
    const lo = Math.max(p.homeRank, p.awayRank);
    return pick(p.v, [
      `${hi} v ${lo} in the table`,
      `Table showdown: ${hi} meets ${lo}`,
      `A six-pointer between ${hi} and ${lo}`,
    ]);
  },
  derbyWin: (p) =>
    pick(p.v, [
      `${p.winner} edged ${p.loser} ${p.score} to pull ahead in the race.`,
      `In a clash of neighbours, ${p.winner} came out on top, winning ${p.score} to open a gap on ${p.loser}.`,
    ]),
  derbyDraw: (p) =>
    pick(p.v, [
      `${p.home} and ${p.away} drew ${p.score}. The race goes on to the next round.`,
      `Neither side blinked. A ${p.score} draw leaves them sharing the points.`,
    ]),
  teamOfRoundHead: (p) =>
    pick(p.v, [
      `${p.team} win by ${p.margin}`,
      `${p.team} are the team of the round`,
      `Dominant ${p.team} cruise to a ${p.margin}-goal win`,
    ]),
  teamOfRoundBody: (p) =>
    pick(p.v, [
      `${p.winner} swept past ${p.loser} ${p.score}.`,
      `${p.winner} controlled the game from start to finish, and ${p.loser} collapsed ${p.score}.`,
    ]),
  leaderNewHead: (p) =>
    pick(p.v, [
      `${p.team} go top of tier ${p.tier}`,
      `New leaders in tier ${p.tier}: ${p.team}`,
      `${p.team} climb to the summit`,
    ]),
  leaderKeepHead: (p) =>
    pick(p.v, [
      `${p.team} stay top`,
      `Unshaken ${p.team} remain first`,
      `${p.team} keep up their charge`,
    ]),
  leaderNewBody: (p) => `${p.team} moved to first in tier ${p.tier} with ${p.points} points.`,
  leaderKeepBody: (p) => `${p.team} held first in tier ${p.tier} with ${p.points} points.`,
  streakHead: (p) =>
    pick(p.v, [
      `${p.team} make it ${p.n} in a row`,
      `Unstoppable ${p.team} reach ${p.n} straight wins`,
      `${p.team} on a ${p.n}-game winning run`,
    ]),
  streakBody: (p) => `${p.team} have won ${p.n} straight matches.`,
  comebackHead: (p) =>
    pick(p.v, [
      `${p.team} come from ${p.n} down to win`,
      `Never say die: ${p.team} complete the comeback`,
      `${p.team} turn it around`,
    ]),
  comebackBody: (p) =>
    pick(p.v, [
      `${p.winner} trailed by ${p.n} but beat ${p.loser} ${p.score}.`,
      `${p.loser} struck first, but ${p.winner} hit back to complete a ${p.score} comeback win.`,
    ]),
  lateHead: (p) =>
    pick(p.v, [
      `${p.minute}th-minute drama as ${p.team} snatch it`,
      `${p.team} win it at the death`,
      `${p.team} have the last word`,
    ]),
  lateBody: (p) =>
    pick(p.v, [
      `${p.name} settled it in the ${p.minute}th minute as ${p.winner} beat ${p.loser} ${p.score}.`,
      `The game looked headed for a draw until the ${p.minute}th minute, when ${p.name} struck to give ${p.winner} a ${p.score} win.`,
    ]),
  hattrickHead: (p) =>
    pick(p.v, [
      `${p.name}’s ${p.goals}-goal show`,
      `Hat-trick hero ${p.name} fires ${p.team}`,
      `${p.goals} goals for ${p.name}`,
    ]),
  hattrickBody: (p) =>
    pick(p.v, [
      `${p.name} of ${p.team} scored ${p.goals} in one match. It finished ${p.score}.`,
      `${p.name} showed no mercy in front of goal, scoring ${p.goals} to steal the show (${p.score}).`,
    ]),
  firstWinHead: (p) =>
    pick(p.v, [
      `${p.team} get their first win after ${p.n} games`,
      `First win at last for ${p.team}`,
      `${p.team} finally taste victory`,
    ]),
  firstWinBody: (p) =>
    pick(p.v, [
      `${p.winner} beat ${p.loser} ${p.score} for their first win in ${p.n} games.`,
      `Winless all season, ${p.winner} finally celebrated. The ${p.score} win could be the turning point.`,
    ]),
  youth: 'a youth player',
  xgLine: (p) => `Expected goals were ${p.hx} to ${p.ax}.`,
  articleTitle: 'Match report',
  articleDraw: (p) => `${p.home} and ${p.away} draw ${p.score}`,
  articleDrawBody: (p) => `${p.home} and ${p.away} shared the points at ${p.score}.`,
  articleLucky: (p) => `${p.winner} win despite being outplayed`,
  articleLuckyBody: (p) =>
    `Expected goals read ${p.loser} ${p.lx}, ${p.winner} ${p.wx}, but the ${p.score} win went to ${p.winner}.`,
  articleRout: (p) => `${p.winner} win by ${p.margin}`,
  articleUpset: (p) => `${p.winner} topple the stronger ${p.loser}`,
  articleNarrow: (p) => `${p.winner} edge it by one`,
  articleWin: (p) => `${p.winner} beat ${p.loser} ${p.score}`,
  articleWinBody: (p) => `${p.winner} beat ${p.loser} ${p.score}.`,
  articleFirst: (p) => `${p.name} opened the scoring in the ${p.minute}th minute.`,
  articleLate: (p) => `${p.name}'s goal in the ${p.minute}th minute settled it.`,
  articleBrace: (p) => (p.n >= 3 ? `${p.name} scored a hat-trick.` : `${p.name} scored twice.`),
  articleGoalless: 'Neither side found the net.',
  readArticle: 'Read report',
  shareAct: 'Share to lounge',
  shareAria: (p) => `Share the ${p.home} v ${p.away} report to the lounge`,
  chatTag: 'OFFSIDE Daily',
  chatOpen: 'View in league',
  bigTitle: 'Big match prediction',
  bigWhen: (p) => `Kickoff ${p.when} · No rewards, just your hit record.`,
  rankOvr: (p) => `${ordinal(p.rank)} · OVR ${p.ovr}`,
  pickHome: 'Home win',
  pickDraw: 'Draw',
  pickAway: 'Away win',
  picked: (p) => `My pick: ${p.pick}`,
  pickLogin: 'Sign in to make a prediction.',
  pickSaved: 'Prediction saved.',
  pickFail: "We couldn't save your prediction.",
  pickSplit: (p) =>
    `${p.n} ${p.n === 1 ? 'pick' : 'picks'} · Home ${p.home}% · Draw ${p.draw}% · Away ${p.away}%`,
  record: (p) => `My hits ${p.hit}/${p.total}`,
  lastBig: (p) => `Last big match ${p.home} ${p.score} ${p.away}`,
  rivalTag: 'Rival',
  derbyTag: 'Derby',
  rivalLine: (p) => `Rival ${p.team} · ${p.gap} pts apart · Head to head ${p.w}W ${p.d}D ${p.l}L`,
};
