import type { Translation } from '@offside/contracts/i18n';
import type { gMomentsText } from '../ko/gMoments';
export const gMoments: Translation<typeof gMomentsText> = {
  kidTitle: 'A young fan asks for an autograph',
  kidText: (p) =>
    `On your way to the team bus after the match, a young fan holds out a pen. "${p.name}, can I have your autograph?"`,
  kidShirtLabel: 'Give them the shirt off your back',
  kidShirtResult:
    'The kid jumped up and down holding your shirt. A video from the crowd spread on social media the next day.',
  kidSignLabel: 'Sign for them despite being exhausted',
  kidSignResult:
    'You signed for every kid in the line before boarding the bus. Your legs were heavy, but your mood was light.',

  wcTitle: 'Left out of the World Cup squad',
  wcText:
    'Your name was missing from last summer’s World Cup squad. At the pre-season press conference, a reporter asks how you feel.',
  wcQuitLabel: 'Criticize the manager and refuse future call-ups',
  wcQuitResult:
    '"I won’t play under this manager." Headlines poured out and opinion split. You will refuse national team call-ups for the next two seasons.',
  wcCalmLabel: 'Express regret and focus on the season',
  wcCalmResult:
    '"It hurts, but I wasn’t good enough." You kept it short and headed to training. The national team staff saw the answer too.',

  legendTitle: 'A national team legend criticizes you',
  legendText:
    'A former national team legend, now a pundit, criticized you on air. "For all the hype, that player hasn’t shown us anything."',
  legendReplyLabel: 'Hit back on social media',
  legendReplyOk:
    'You posted screenshots of your recent stats. The comments swung your way, and the pundit held back on the next broadcast.',
  legendReplyFail:
    'Your reply turned into a public spat. Every poor moment in your next match brings that post back up.',
  legendIgnoreLabel: 'Ignore it',
  legendIgnoreResult:
    'You went to training without a word. A few days later, the story had moved on.',

  hatTitle: 'Hat-trick and Man of the Match',
  hatText:
    'You scored a hat-trick and were named Man of the Match. A reporter holds out a microphone as you lift the trophy.',
  hatTeamLabel: 'Credit your teammates',
  hatTeamResult:
    '"My teammates made all three goals." In the dressing room, your teammates were waiting with the match ball.',
  hatFatherLabel: 'Dedicate the goals to your father',
  hatFatherResult:
    '"These are for my dad, who bought me my first ball." The broadcast caught your father standing and waving in the stands.',

  papTitle: 'Paparazzi',
  papText:
    'Walking down the street with your partner, you lock eyes with a paparazzi lens. The shutter keeps clicking.',
  papSmileLabel: 'Smile for the camera',
  papSmileResult:
    'You waved and kept walking. The photo ran in the papers the next day, and most comments said you looked relaxed.',
  papRunLabel: 'Grab your partner’s hand and run',
  papRunOk:
    'You slipped away down an alley. Only blurry shots remained, and the story faded quickly.',
  papRunFail:
    'Your backs were caught on camera as you ran. Articles titled "Runaway Date" flooded the news.',

  coachTitle: 'Your first coach passes away',
  coachText:
    'You hear that the coach who first discovered you as a youth player has passed away. The funeral is on match day.',
  coachFuneralLabel: 'Skip the match and go to the funeral',
  coachFuneralResult:
    'You stayed until the end. The coach’s family handed you a framed photo of your debut.',
  coachDedicateLabel: 'Dedicate the match to your coach',
  coachDedicateOk:
    'After the match, you pointed to the sky and kissed your black armband. The photo made the front page the next day.',
  coachDedicateFail:
    'Your legs felt heavy. You were subbed off midway through the second half and sat on the bench touching your black armband.',
};
